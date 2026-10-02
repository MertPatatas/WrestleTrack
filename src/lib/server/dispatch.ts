import 'server-only';
import type { Show } from '../../data/types';
import { isLang, type Lang } from '../../i18n/config';
import { translate, type MessageKey } from '../../i18n/messages';
import { sanitizePrefs, type NotificationPrefs } from '../notifications/prefs';
import { buildSchedule } from '../schedule/build';
import type { ScheduleResponse } from '../schedule/load';
import { utcToZoned } from '../schedule/time';
import { db, type ProfileRow, type SubscriptionRow } from './db';
import { sendToSubscriptions, type PushPayload } from './push';

// Se ejecuta cada 5 minutos (Upstash QStash → /api/push/dispatch).
// Margen de tolerancia: si una ejecución se retrasa o falla, la siguiente aún envía lo pendiente.
const WINDOW_MS = 15 * 60_000;
const DIGEST_WINDOW_MIN = 15;
const PROMO_NAMES: Record<string, string> = { wwe: 'WWE', aew: 'AEW', cmll: 'CMLL', aaa: 'AAA', njpw: 'NJPW', other: '' };

export function profileLang(p: ProfileRow | undefined): Lang {
  if (p && isLang(p.language)) return p.language;
  if (p?.device_language && isLang(p.device_language)) return p.device_language;
  return 'es';
}

function profileTimeZone(p: ProfileRow): string {
  return p.time_zone !== 'auto' ? p.time_zone : (p.device_time_zone ?? 'Europe/Madrid');
}

function profileLocale(p: ProfileRow, lang: Lang): string {
  return p.device_locale?.slice(0, 2).toLowerCase() === lang ? p.device_locale : lang === 'es' ? 'es-ES' : 'en-US';
}

function wants(show: Show, p: ProfileRow, prefs: NotificationPrefs): boolean {
  if (!p.favorites.includes(show.promotion)) return false;
  if (prefs.kinds === 'weekly') return show.kind === 'weekly';
  if (prefs.kinds === 'special') return show.kind !== 'weekly';
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
    url: '/shows',
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
    url: '/shows',
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
}

export async function dispatch(data: Pick<ScheduleResponse, 'episodes' | 'events'>, now = Date.now()): Promise<DispatchResult> {
  const sql = await db();
  const shows = buildSchedule(now, { pastDays: 1, futureDays: 8, episodes: data.episodes, autoEvents: data.events });

  // ---- Eventos recién anunciados ----
  const upcomingSpecials = shows.filter((s) => s.kind !== 'weekly' && new Date(s.startsAt).getTime() > now);
  const keys = [...new Set(upcomingSpecials.map(eventKey))];
  const firstRun = ((await sql.query('select count(*)::int as n from seen_events')) as { n: number }[])[0].n === 0;
  const inserted = keys.length
    ? ((await sql.query(
        'insert into seen_events (key) select unnest($1::text[]) on conflict do nothing returning key',
        [keys],
      )) as { key: string }[])
    : [];
  // En la primera ejecución solo se registran: no son anuncios nuevos
  const newKeys = new Set(firstRun ? [] : inserted.map((r) => r.key));
  const newEvents = upcomingSpecials.filter((s) => newKeys.has(eventKey(s)));

  // ---- Usuarios con algún dispositivo suscrito ----
  const profiles = (await sql.query(
    'select p.* from profiles p where exists (select 1 from push_subscriptions s where s.user_id = p.user_id)',
  )) as ProfileRow[];
  if (profiles.length === 0) return { users: 0, notifications: 0, newEvents: newEvents.length };
  const subs = (await sql.query('select * from push_subscriptions where user_id = any($1)', [
    profiles.map((p) => p.user_id),
  ])) as SubscriptionRow[];

  let notifications = 0;

  await Promise.all(
    profiles.map(async (p) => {
      const prefs = sanitizePrefs({
        kinds: p.notify_kinds as NotificationPrefs['kinds'],
        leads: p.notify_leads,
        announce: p.notify_announce,
        digest: p.digest as NotificationPrefs['digest'],
        digestHour: p.digest_hour,
      });
      const lang = profileLang(p);
      const ctx: Ctx = {
        lang,
        tz: profileTimeZone(p),
        locale: profileLocale(p, lang),
        t: (key, vars) => translate(lang, key, vars),
      };
      const mine = shows.filter((s) => wants(s, p, prefs));
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
          if (p.favorites.includes(s.promotion)) {
            pending.push({ key: `a:${eventKey(s)}`, payload: announcement(s, ctx), ttl: 24 * 3600 });
          }
        }
      }

      // Resumen diario o semanal, a la hora local elegida
      if (prefs.digest !== 'off') {
        const local = utcToZoned(now, ctx.tz);
        const [h, m] = local.time.split(':').map(Number);
        const isMonday = new Date(`${local.date}T12:00:00Z`).getUTCDay() === 1;
        if (h === prefs.digestHour && m < DIGEST_WINDOW_MIN && (prefs.digest === 'daily' || isMonday)) {
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
        const claimed = (await sql.query(
          'insert into notification_log (user_id, key) values ($1, $2) on conflict do nothing returning key',
          [p.user_id, item.key],
        )) as unknown[];
        if (claimed.length === 0) continue;
        const { sent } = await sendToSubscriptions(userSubs, item.payload, item.ttl);
        if (sent > 0) notifications++;
      }
    }),
  );

  // Limpieza del registro de avisos
  await sql.query(`delete from notification_log where sent_at < now() - interval '30 days'`);

  return { users: profiles.length, notifications, newEvents: newEvents.length };
}
