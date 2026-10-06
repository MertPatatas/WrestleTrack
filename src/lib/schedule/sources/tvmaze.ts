import {
  tvmazeSpecials,
  weeklyShows,
  type AutoEpisode,
  type SpecialEvent,
  type TvmazeSpecialSource,
  type WeeklyShow,
} from '../../../data/schedule';
import { DAY_MS, utcToZoned } from '../time';

// TVmaze (https://www.tvmaze.com/api): API pública y gratuita de programación de TV.
// Da los episodios futuros de cada programa con su hora de emisión (airstamp, en UTC)
// y un título que suele incluir el recinto y el nombre del especial:
//   "#365 - Grand Slam France: Adidas Arena in Paris, France"
//   "Money in the Bank 2026 - Smoothie King Center in New Orleans, LA"

const API = 'https://api.tvmaze.com';
const USER_AGENT = 'WrestleTrack/0.1 (calendario de lucha libre; https://github.com/MertPatatas/WrestleTrack)';

interface TvmazeEpisode {
  name: string | null;
  airdate: string; // 'YYYY-MM-DD' en la zona de la cadena
  airtime: string; // 'HH:MM' o '' si no se sabe
  airstamp: string | null; // ISO UTC (sin airtime TVmaze pone una hora de relleno)
}

async function episodes(showId: number): Promise<TvmazeEpisode[]> {
  const res = await fetch(`${API}/shows/${showId}/episodes?specials=1`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`TVmaze ${showId}: HTTP ${res.status}`);
  return (await res.json()) as TvmazeEpisode[];
}

// "Adidas Arena in Paris, France" → "Adidas Arena, Paris"
function venueFrom(text: string): string | undefined {
  const m = text.match(/^(.+?) in ([^,]+)/);
  return m ? `${m[1].trim()}, ${m[2].trim()}` : undefined;
}

/** Separa el título de un episodio semanal en nombre especial y recinto. */
export function parseWeeklyTitle(raw: string | null): { special?: string; venue?: string } {
  const text = (raw ?? '').replace(/^#?\d+\s*(?:-\s*)?/, '').trim(); // quita "#365 - " o "40"
  if (!text) return {};
  const special = text.match(/^([^:]+):\s*(.+ in .+)$/);
  if (special) return { special: special[1].trim(), venue: venueFrom(special[2]) };
  if (/ in /.test(text)) return { venue: venueFrom(text) };
  // Títulos que describen un combate ("Main Event: A vs. B (c)…"), genéricos o fechas: no son un nombre especial
  if (/\bvs\.?\s|\(c\)|^main event\b|^episode\b|^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d/i.test(text)) return {};
  return { special: text };
}

/** Separa el título de un evento especial: "Crown Jewel 2026 - Riyadh Season Stadium in Riyadh, ..." */
export function parseSpecialTitle(raw: string): { name: string; venue?: string } {
  const [head, ...rest] = raw.split(' - ');
  const name = head.replace(/\s+\d{4}$/, '').trim();
  return { name, venue: rest.length ? venueFrom(rest.join(' - ')) : undefined };
}

// Episodios que no son el show en sí (previas, resúmenes)
const NOT_MAIN = /\b(buy[- ]in|pre-?show|kickoff|countdown|zero hour|preview|recap|post-?show)\b/i;

function inWindow(e: TvmazeEpisode, from: number, to: number): boolean {
  const t = Date.parse(e.airstamp ?? `${e.airdate}T12:00:00Z`);
  return t >= from && t <= to;
}

async function weeklyEpisodes(show: WeeklyShow, from: number, to: number): Promise<AutoEpisode[]> {
  const out: AutoEpisode[] = [];
  for (const e of await episodes(show.tvmaze!)) {
    if (!e.airdate || !inWindow(e, from, to) || NOT_MAIN.test(e.name ?? '')) continue;
    // Con hora: se pasa a la zona del show. Sin hora: su fecha y la hora habitual.
    const local = e.airtime && e.airstamp ? utcToZoned(Date.parse(e.airstamp), show.timeZone) : null;
    const { special, venue } = parseWeeklyTitle(e.name);
    out.push({
      show: show.id,
      date: local?.date ?? e.airdate,
      time: local?.time,
      name: special ? `${show.name}: ${special}` : undefined,
      venue,
    });
  }
  return out;
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function specialEvents(src: TvmazeSpecialSource, from: number, to: number): Promise<SpecialEvent[]> {
  const out: SpecialEvent[] = [];
  for (const e of await episodes(src.tvmaze)) {
    if (!e.name || !e.airdate || !inWindow(e, from, to) || NOT_MAIN.test(e.name)) continue;
    const parsed = parseSpecialTitle(e.name);
    const name = src.prefix && !parsed.name.startsWith(src.prefix.trim()) ? src.prefix + parsed.name : parsed.name;
    const local = e.airtime && e.airstamp ? utcToZoned(Date.parse(e.airstamp), src.timeZone) : null;
    out.push({
      id: `tvmaze-${src.tvmaze}-${slug(name)}-${e.airdate}`,
      promotion: src.promotion,
      name,
      kind: 'ple',
      date: local?.date ?? e.airdate,
      time: local?.time ?? src.defaultTime,
      approx: !local && Boolean(src.defaultTime),
      timeZone: src.timeZone,
      durationMin: src.durationMin,
      venue: parsed.venue,
      auto: true,
    });
  }
  return out;
}

export interface TvmazeResult {
  episodes: AutoEpisode[];
  events: SpecialEvent[];
  showImages: Record<string, string>; // póster actual de cada show semanal (id de weeklyShows → URL)
}

/** Póster principal del programa en TVmaze (lo actualizan cuando cambia la imagen del show). */
async function showPoster(showId: number): Promise<string | null> {
  const res = await fetch(`${API}/shows/${showId}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const show = (await res.json()) as { image?: { original?: string; medium?: string } | null };
  return show.image?.original ?? show.image?.medium ?? null;
}

/** Episodios semanales y eventos especiales entre hace pastDays y dentro de futureDays. */
export async function fetchTvmaze(now = Date.now(), pastDays = 15, futureDays = 120): Promise<TvmazeResult> {
  const from = now - pastDays * DAY_MS;
  const to = now + futureDays * DAY_MS;
  const weekly = weeklyShows.filter((s) => s.tvmaze);

  // Si un programa falla, se sigue con el resto (ese show usará sus reglas)
  const [weeklyResults, specialResults, posterResults] = await Promise.all([
    Promise.allSettled(weekly.map((s) => weeklyEpisodes(s, from, to))),
    Promise.allSettled(tvmazeSpecials.map((s) => specialEvents(s, from, to))),
    Promise.allSettled(weekly.map((s) => showPoster(s.tvmaze!))),
  ]);
  const showImages: Record<string, string> = {};
  posterResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) showImages[weekly[i].id] = r.value;
  });
  const failed = [...weeklyResults, ...specialResults].filter((r) => r.status === 'rejected');
  if (failed.length === weeklyResults.length + specialResults.length) {
    throw new Error(String((failed[0] as PromiseRejectedResult).reason));
  }
  return {
    episodes: weeklyResults.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    events: specialResults.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    showImages,
  };
}
