import 'server-only';
import type { AutoEpisode, SpecialEvent } from '../../data/schedule';
import type { AnalysisVideo, Recap, RecapItem, RecapsResponse, Show } from '../../data/types';
import { buildSchedule } from '../schedule/build';
import { parseWikiCard } from '../schedule/card';
import { loadSchedule } from '../schedule/load';
import { api as wikiApi } from '../schedule/sources/wikipedia';
import { db, dbConfigured } from '../server/db';
import { matchShow } from './match';
import { fetchArticleResults, listResultArticles } from './solowrestling';
import { fetchAnalysisVideos } from './youtube';

// "Ponme al día": revisa las fuentes como mucho cada media hora (desde el aviso horario de
// /api/push/dispatch o, si hace tiempo que no se revisan, al abrir la sección) y guarda en la base
// de datos los resultados y vídeos que encuentra, porque las fuentes solo muestran los últimos días.

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 14; // shows de los que se buscan resultados y vídeos
const KEEP_DAYS = 21; // lo que devuelve la API
const MIN_INTERVAL_MS = 30 * 60_000;
const MAX_ARTICLES = 8; // artículos descargados por revisión
const MAX_WIKI = 3;
const META_KEY = 'recaps_at';

// ---------------------------------------------------------------- Almacén

interface Store {
  recapTimes(since: string): Promise<Map<string, number>>;
  saveRecap(recap: Recap): Promise<void>;
  saveVideos(videos: AnalysisVideo[]): Promise<void>;
  read(since: string): Promise<Omit<RecapsResponse, 'updatedAt'>>;
  checkedAt(): Promise<number | null>;
  setCheckedAt(at: number): Promise<void>;
}

interface RecapRow {
  show_id: string;
  promotion: Recap['promotion'];
  name: string;
  event_date: string;
  items: RecapItem[];
  lang: Recap['lang'];
  source_name: string;
  source_url: string;
  updated_at: Date;
}

interface VideoRow {
  video_id: string;
  title: string;
  channel: string;
  channel_id: string;
  lang: AnalysisVideo['lang'];
  published_at: Date;
  show_id: string;
}

const dbStore: Store = {
  async recapTimes(since) {
    const rows = await (await db()).query<{ show_id: string; updated_at: Date }>(
      'select show_id, updated_at from app.recaps where event_date >= $1',
      [since],
    );
    return new Map(rows.map((r) => [r.show_id, r.updated_at.getTime()]));
  },
  async saveRecap(r) {
    await (await db()).query(
      `insert into app.recaps (show_id, promotion, name, event_date, items, lang, source_name, source_url, updated_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, now())
       on conflict (show_id) do update set items = excluded.items, name = excluded.name, lang = excluded.lang,
         source_name = excluded.source_name, source_url = excluded.source_url, updated_at = now()`,
      [r.showId, r.promotion, r.name, r.eventDate, JSON.stringify(r.items), r.lang, r.source.name, r.source.url],
    );
  },
  async saveVideos(videos) {
    const q = await db();
    for (const v of videos) {
      await q.query(
        `insert into app.videos (video_id, title, channel, channel_id, lang, published_at, show_id)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (video_id) do update set title = excluded.title, show_id = excluded.show_id`,
        [v.id, v.title, v.channel, v.channelId, v.lang, v.publishedAt, v.showId],
      );
    }
  },
  async read(since) {
    const q = await db();
    const [recaps, videos] = await Promise.all([
      q.query<RecapRow>('select * from app.recaps where event_date >= $1 order by event_date desc limit 120', [since]),
      q.query<VideoRow>('select * from app.videos where published_at >= $1 order by published_at desc limit 200', [since]),
    ]);
    return {
      recaps: recaps.map((r) => ({
        showId: r.show_id,
        promotion: r.promotion,
        name: r.name,
        eventDate: r.event_date,
        items: r.items,
        lang: r.lang,
        source: { name: r.source_name, url: r.source_url },
        updatedAt: r.updated_at.toISOString(),
      })),
      videos: videos.map((v) => ({
        id: v.video_id,
        title: v.title,
        channel: v.channel,
        channelId: v.channel_id,
        lang: v.lang,
        publishedAt: v.published_at.toISOString(),
        showId: v.show_id,
      })),
    };
  },
  async checkedAt() {
    const [row] = await (await db()).query<{ value: string }>('select value from app.meta where key = $1', [META_KEY]);
    return row ? Number(row.value) : null;
  },
  async setCheckedAt(at) {
    await (await db()).query(
      `insert into app.meta (key, value, updated_at) values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [META_KEY, String(at)],
    );
  },
};

// Sin base de datos (desarrollo local): en memoria
const memory = { recaps: new Map<string, Recap>(), videos: new Map<string, AnalysisVideo>(), checkedAt: null as number | null };
const memoryStore: Store = {
  async recapTimes(since) {
    return new Map([...memory.recaps.values()].filter((r) => r.eventDate >= since).map((r) => [r.showId, Date.parse(r.updatedAt)]));
  },
  async saveRecap(r) {
    memory.recaps.set(r.showId, r);
  },
  async saveVideos(videos) {
    for (const v of videos) memory.videos.set(v.id, v);
  },
  async read(since) {
    return {
      recaps: [...memory.recaps.values()].filter((r) => r.eventDate >= since).sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
      videos: [...memory.videos.values()]
        .filter((v) => v.publishedAt.slice(0, 10) >= since)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    };
  },
  async checkedAt() {
    return memory.checkedAt;
  },
  async setCheckedAt(at) {
    memory.checkedAt = at;
  },
};

const store = (): Store => (dbConfigured() ? dbStore : memoryStore);
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// ---------------------------------------------------------------- Fuentes

/** Resultados de un evento especial en su artículo de Wikipedia (en inglés), si ya los tiene. */
async function wikipediaResults(show: Show): Promise<RecapItem[]> {
  const title = decodeURIComponent(show.url?.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  if (!title) return [];
  const json = await wikiApi({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' });
  const matches = parseWikiCard(json.parse?.wikitext ?? '');
  // Antes del evento la tabla tiene la cartelera ("A vs. B"); después, "A defeated B"
  if (!matches.some((m) => /\b(?:defeated|won|retained|drew|no contest|went to a)\b/i.test(m.participants))) return [];
  return matches.map((m) => ({ title: m.title, text: m.participants }));
}

function recapOf(show: Show, items: RecapItem[], lang: Recap['lang'], source: Recap['source'], now: number): Recap {
  return {
    showId: show.id,
    promotion: show.promotion,
    name: show.night ? `${show.name} (${show.night})` : show.name,
    eventDate: show.eventDate,
    items,
    lang,
    source,
    updatedAt: new Date(now).toISOString(),
  };
}

export interface RefreshResult {
  skipped?: boolean;
  recaps: number;
  videos: number;
}

/** Busca resultados y vídeos nuevos (como mucho cada 30 min, salvo force). */
export async function refreshRecaps(
  data: { episodes: AutoEpisode[]; events: SpecialEvent[] },
  { now = Date.now(), force = false }: { now?: number; force?: boolean } = {},
): Promise<RefreshResult> {
  const s = store();
  const last = await s.checkedAt();
  if (!force && last && now - last < MIN_INTERVAL_MS) return { skipped: true, recaps: 0, videos: 0 };
  await s.setCheckedAt(now); // antes de empezar: evita revisiones simultáneas

  const shows = buildSchedule(now, { pastDays: WINDOW_DAYS, futureDays: 1, episodes: data.episodes, autoEvents: data.events }).filter(
    (show) => Date.parse(show.startsAt) <= now,
  );
  const since = isoDate(now - (WINDOW_DAYS + 1) * DAY_MS);
  const known = await s.recapTimes(since);
  let recaps = 0;

  // Hay que (re)descargar si no se tiene, o si el show acabó hace poco (la crónica se va completando)
  const needs = (show: Show) => {
    const at = known.get(show.id);
    if (!at) return true;
    const end = Date.parse(show.endsAt);
    return at < end + 3 * 3600_000 && now - at > 45 * 60_000 && now - end < 2 * DAY_MS;
  };

  // 1. Solowrestling: el artículo más reciente de cada show
  try {
    const byShow = new Map<string, { show: Show; url: string; publishedAt: number }>();
    for (const a of await listResultArticles()) {
      const show = matchShow(a.title, a.publishedAt, shows);
      if (!show || !needs(show)) continue;
      const prev = byShow.get(show.id);
      if (!prev || a.publishedAt > prev.publishedAt) byShow.set(show.id, { show, url: a.url, publishedAt: a.publishedAt });
    }
    for (const { show, url } of [...byShow.values()].slice(0, MAX_ARTICLES)) {
      try {
        const items = await fetchArticleResults(url);
        if (!items.some((i) => !i.segment)) continue;
        await s.saveRecap(recapOf(show, items, 'es', { name: 'Solowrestling', url }, now));
        known.set(show.id, now);
        recaps++;
      } catch (err) {
        console.warn(`[recaps] ${url}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.warn('[recaps] solowrestling:', err instanceof Error ? err.message : err);
  }

  // 2. Wikipedia, para los eventos especiales que Solowrestling no cubra
  const wiki = shows.filter(
    (show) =>
      show.kind !== 'weekly' &&
      show.url?.startsWith('https://en.wikipedia.org/wiki/') &&
      !known.has(show.id) &&
      now - Date.parse(show.endsAt) > 6 * 3600_000,
  );
  for (const show of wiki.slice(0, MAX_WIKI)) {
    try {
      const items = await wikipediaResults(show);
      if (!items.length) continue;
      await s.saveRecap(recapOf(show, items, 'en', { name: 'Wikipedia', url: show.url! }, now));
      recaps++;
    } catch (err) {
      console.warn(`[recaps] wikipedia ${show.id}:`, err instanceof Error ? err.message : err);
    }
  }

  // 3. Vídeos de análisis
  let videos: AnalysisVideo[] = [];
  try {
    videos = (await fetchAnalysisVideos()).flatMap((v) => {
      const show = matchShow(v.title, v.publishedAt, shows);
      return show
        ? [{ id: v.id, title: v.title, channel: v.channel.name, channelId: v.channel.id, lang: v.channel.lang, publishedAt: new Date(v.publishedAt).toISOString(), showId: show.id }]
        : [];
    });
    await s.saveVideos(videos);
  } catch (err) {
    console.warn('[recaps] youtube:', err instanceof Error ? err.message : err);
  }

  return { recaps, videos: videos.length };
}

/** Resultados y vídeos de las últimas semanas (para /api/recaps). */
export async function readRecaps(now = Date.now()): Promise<RecapsResponse> {
  const s = store();
  const [data, checked] = await Promise.all([s.read(isoDate(now - KEEP_DAYS * DAY_MS)), s.checkedAt()]);
  return { ...data, updatedAt: checked ? new Date(checked).toISOString() : null };
}

/** true si hace más de 30 min de la última revisión. */
export async function recapsStale(now = Date.now()): Promise<boolean> {
  const checked = await store().checkedAt();
  return !checked || now - checked >= MIN_INTERVAL_MS;
}

/** Revisión con el calendario cargado aquí mismo (cuando se abre la sección y los datos son viejos). */
export async function refreshRecapsNow(): Promise<RefreshResult> {
  return refreshRecaps(await loadSchedule());
}
