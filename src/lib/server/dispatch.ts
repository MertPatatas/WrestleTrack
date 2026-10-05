import 'server-only';
import { isSpecial, type Show } from '../../data/types';
import { isLang, sanitizeFavorites, type Lang } from '../../i18n/config';
import { translate, type MessageKey } from '../../i18n/messages';
import { LEAD_OPTIONS, type NotificationPrefs } from '../notifications/prefs';
import { buildSchedule } from '../schedule/build';
import type { ScheduleResponse } from '../schedule/load';
import { utcToZoned } from '../schedule/time';
import { db, type ProfileRow, type SubscriptionRow } from './db';
import { rowPrefs } from './profile';
import { sendToSubscriptions, type PushPayload } from './push';

// Se ejecuta cada 5 minutos (Upstash QStash → /api/push/dispatch).
// Margen de tolerancia: si una ejecución se retrasa o falla, la siguiente aún envía lo pendiente.
const WINDOW_MS = 10 * 60_000;
// Revisión horaria (anuncios y resúmenes): los primeros minutos de cada hora UTC
const HOURLY_WINDOW_MIN = 10;
const PROMO_NAMES: Record<string, string> = { wwe: 'WWE', aew: 'AEW', cmll: 'CMLL', aaa: 'AAA', njpw: 'NJPW', other: '' };

function profileLang(p: ProfileRow): Lang {
  if (isLang(p.language)) return p.language;
  if (isLang(p.device_language)) return p.device_language;
  return 'es';
}

function profileTimeZone(p: ProfileRow): string {
  return p.time_zone !== 'auto' ? p.time_zone : (p.device_time_zone ?? 'Europe/Madrid');
}

function profileLocale(p: ProfileRow, lang: Lang): string {
  return p.device_locale?.slice(0, 2).toLowerCase() === lang ? p.device_locale : lang === 'es' ? 'es-ES' : 'en-US';
}

function wants(show: Show, favorites: string[], prefs: NotificationPrefs): boolean {
  if (!favorites.includes(show.promotion)) return false;
  if (prefs.kinds === 'weekly') return show.kind === 'weekly';
  if (prefs.kinds === 'special') return isSpecial(show);
  return true;
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Clave estable de un evento especial aunque cambie de fuente (mes en vez de día: las fuentes difieren en ±1 día). */
function eventKey(s: Show): string {
  return `${s.promotion}:${normalize(s.name)}:${s.night ?? ''}:${s.eventDate.slice(0, 7)}`;
}

function displayName(s: Show, lang: Lang): string {
  return s.night ? `${s.name} · ${translate(lang, 'shows.night', { n: s.night })}` : s.name;
}

interface Ctx {
  lang: Lang;
  tz: string;
  locale: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const timeOf = (s: Show, c: Ctx) =>
  s.timeTbd
    ? c.t('push.tbd')
    : new Date(s.startsAt).toLocaleTimeString(c.locale, { hour: '2-digit', minute: '2-digit', timeZone: c.tz });

const dateOf = (s: Show, c: Ctx) =>
  s.timeTbd
    ? new Date(`${s.eventDate}T12:00:00Z`).toLocaleDateString(c.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    : new Date(s.startsAt).toLocaleDateString(c.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: c.tz });

function leadText(min: number, c: Ctx): string {
  const key = ({ 15: 'push.lead15', 60: 'push.lead60', 180: 'push.lead180', 1440: 'push.lead1440' } as const)[min as 15];
  return key ? c.t(key) : `${min} min`;
}

function reminder(s: Show, lead: number, c: Ctx): PushPayload {
  const name = displayName(s, c.lang);
  const details = [PROMO_NAMES[s.promotion], `${dateOf(s, c)} ${timeOf(s, c)}`, s.venue].filter(Boolean).join(' · ');
  return {
    title: lead === 0 ? c.t('push.startsNow', { name }) : c.t('push.startsIn', { name, lead: leadText(lead, c) }),
    body: details,
    url: `/shows/${encodeURIComponent(s.id)}`,
    tag: `show-${s.id}`,
  };
}

function announcement(s: Show, c: Ctx): PushPayload {
  return {
    title: c.t('push.announceTitle'),
    body: c.t('push.announceBody', {
      name: `${PROMO_NAMES[s.promotion]} ${displayName(s, c.lang)}`.trim(),
      date: `${dateOf(s, c)}${s.timeTbd ? '' : ` ${timeOf(s, c)}`}`,
    }),
    url: `/shows/${encodeURIComponent(s.id)}`,
    tag: `announce-${s.id}`,
  };
}

function digest(shows: Show[], weekly: boolean, c: Ctx): PushPayload | null {
  if (shows.length === 0) return null;
  const MAX = 6;
  const lines = shows
    .slice(0, MAX)
    .map((s) => `${weekly ? `${dateOf(s, c)} ` : ''}${timeOf(s, c)} ${displayName(s, c.lang)}`);
  if (shows.length > MAX) lines.push(c.t('push.more', { n: shows.length - MAX }));
  return {
    title: c.t(weekly ? 'push.digestWeekly' : 'push.digestDaily'),
    body: lines.join('\n'),
    url: '/shows',
    tag: 'digest',
  };
}

export interface DispatchResult {
  users: number;
  notifications: number;
  newEvents: number;
  skipped?: boolean; // no tocaba nada: no se ha despertado la base de datos
}

/** ¿Algún show está en el momento de alguno de los recordatorios posibles? */
function reminderDue(shows: Show[], now: number): boolean {
  return shows.some((s) => {
    if (s.timeTbd) return false;
    const start = new Date(s.startsAt).getTime();
    return LEAD_OPTIONS.some((lead) => {
      const at = start - lead * 60_000;
      return at <= now && at > now - WINDOW_MS;
    });
  });
}

export async function dispatch(data: Pick<ScheduleResponse, 'episodes' | 'events'>, now = Date.now()): Promise<DispatchResult> {
  const shows = buildSchedule(now, { pastDays: 1, futureDays: 8, episodes: data.episodes, autoEvents: data.events });

  // Solo se consulta la base de datos si toca algo: un recordatorio, o la revisión horaria de
  // anuncios y resúmenes. El resto de ejecuciones no hacen nada (menos carga en el plan gratuito).
  const hourly = new Date(now).getUTCMinutes() < HOURLY_WINDOW_MIN;
  if (!hourly && !reminderDue(shows, now)) return { users: 0, notifications: 0, newEvents: 0, skipped: true };

  const sql = await db();

  // ---- Eventos recién anunciados (en la revisión horaria) ----
  let newEvents: Show[] = [];
  if (hourly) {
    // Todo lo anunciado (no solo los próximos días): si no, un evento ya conocido parecería
    // nuevo al acercarse, y uno anunciado para dentro de meses no se detectaría
    const upcomingSpecials = buildSchedule(now, {
      pastDays: 0,
      futureDays: 400,
      episodes: data.episodes,
      autoEvents: data.events,
    }).filter((s) => s.kind !== 'weekly' && new Date(s.startsAt).getTime() > now);
    const keys = [...new Set(upcomingSpecials.map(eventKey))];
    const firstRun = (await sql.query<{ n: number }>('select count(*)::int as n from app.seen_events'))[0].n === 0;
    const inserted = keys.length
      ? await sql.query<{ key: string }>(
          'insert into app.seen_events (key) select unnest($1::text[]) on conflict do nothing returning key',
          [keys],
        )
      : [];
    // En la primera ejecución solo se registran: no son anuncios nuevos
    const newKeys = new Set(firstRun ? [] : inserted.map((r) => r.key));
    newEvents = upcomingSpecials.filter((s) => newKeys.has(eventKey(s)));
  }

  // ---- Usuarios con algún dispositivo suscrito ----
  const profiles = await sql.query<ProfileRow>(
    'select p.* from app.profiles p where exists (select 1 from app.push_subscriptions s where s.user_id = p.user_id)',
  );
  if (profiles.length === 0) return { users: 0, notifications: 0, newEvents: newEvents.length };
  const subs = await sql.query<SubscriptionRow>('select * from app.push_subscriptions where user_id = any($1::uuid[])', [
    profiles.map((p) => p.user_id),
  ]);

  let notifications = 0;

  await Promise.all(
    profiles.map(async (p) => {
      const prefs = rowPrefs(p);
      const favorites: string[] = sanitizeFavorites(p.favorites);
      const lang = profileLang(p);
      const ctx: Ctx = {
        lang,
        tz: profileTimeZone(p),
        locale: profileLocale(p, lang),
        t: (key, vars) => translate(lang, key, vars),
      };
      const mine = shows.filter((s) => wants(s, favorites, prefs));
      const pending: { key: string; payload: PushPayload; ttl: number }[] = [];

      // Recordatorios
      for (const s of mine) {
        if (s.timeTbd) continue;
        const start = new Date(s.startsAt).getTime();
        for (const lead of prefs.leads) {
          const at = start - lead * 60_000;
          if (at <= now && at > now - WINDOW_MS) {
            pending.push({ key: `r:${s.id}:${lead}`, payload: reminder(s, lead, ctx), ttl: Math.max(300, Math.round((start - now) / 1000) + 600) });
          }
        }
      }

      // Anuncios (solo PPV/PLE)
      if (prefs.announce && prefs.kinds !== 'weekly') {
        for (const s of newEvents) {
          if (favorites.includes(s.promotion)) {
            pending.push({ key: `a:${eventKey(s)}`, payload: announcement(s, ctx), ttl: 24 * 3600 });
          }
        }
      }

      // Resumen diario o semanal, a la hora local elegida
      if (prefs.digest !== 'off') {
        // Se envía en la revisión horaria que cae dentro de la hora local elegida
        // (en zonas con media hora, como India, llega a las hh:30)
        const local = utcToZoned(now, ctx.tz);
        const h = Number(local.time.slice(0, 2));
        const isMonday = new Date(`${local.date}T12:00:00Z`).getUTCDay() === 1;
        if (hourly && h === prefs.digestHour && (prefs.digest === 'daily' || isMonday)) {
          const weekly = prefs.digest === 'weekly';
          const horizon = now + (weekly ? 7 : 1) * 24 * 3600_000;
          const list = mine.filter((s) => {
            const t = new Date(s.startsAt).getTime();
            return t > now && t <= horizon;
          });
          const payload = digest(list, weekly, ctx);
          if (payload) pending.push({ key: `d:${prefs.digest}:${local.date}`, payload, ttl: 6 * 3600 });
        }
      }

      if (pending.length === 0) return;
      const userSubs = subs.filter((s) => s.user_id === p.user_id);

      for (const item of pending) {
        // Se apunta antes de enviar: si dos ejecuciones coinciden, solo una lo envía
        const claimed = await sql.query(
          'insert into app.notification_log (user_id, key) values ($1, $2) on conflict do nothing returning key',
          [p.user_id, item.key],
        );
        if (claimed.length === 0) continue;
        const { sent } = await sendToSubscriptions(userSubs, item.payload, item.ttl);
        if (sent > 0) notifications++;
      }
    }),
  );

  // Limpieza del registro de avisos
  await sql.query(`delete from app.notification_log where sent_at < now() - interval '30 days'`);

  return { users: profiles.length, notifications, newEvents: newEvents.length };
}
