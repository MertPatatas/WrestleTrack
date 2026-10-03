import 'server-only';
import type { AutoEpisode, SpecialEvent } from '../../data/schedule';
import { fetchNjpwBigEvents } from './sources/njpw';
import { fetchTvmaze, type TvmazeResult } from './sources/tvmaze';
import { fetchWikipediaEvents } from './sources/wikipedia';

export interface ScheduleSourceStatus {
  id: 'tvmaze' | 'njpw' | 'wikipedia';
  ok: boolean;
  count: number;
  error?: string;
}

export interface ScheduleResponse {
  episodes: AutoEpisode[]; // episodios semanales (TVmaze)
  events: SpecialEvent[]; // eventos especiales, de la fuente más fiable a la menos
  showImages: Record<string, string>; // póster de cada show semanal (TVmaze)
  sources: ScheduleSourceStatus[];
  updatedAt: string;
}

const TTL_MS = 6 * 3600_000;

// Lo último que funcionó de cada fuente: si una falla, se reutiliza su copia anterior
const last: { tvmaze?: TvmazeResult; njpw?: SpecialEvent[]; wikipedia?: SpecialEvent[] } = {};
let cache: { at: number; data: ScheduleResponse } | null = null;
let inflight: Promise<ScheduleResponse> | null = null;

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function build(): Promise<ScheduleResponse> {
  const [tv, nj, wiki] = await Promise.allSettled([fetchTvmaze(), fetchNjpwBigEvents(), fetchWikipediaEvents()]);
  const sources: ScheduleSourceStatus[] = [];

  if (tv.status === 'fulfilled') last.tvmaze = tv.value;
  sources.push({
    id: 'tvmaze',
    ok: tv.status === 'fulfilled',
    count: (last.tvmaze?.episodes.length ?? 0) + (last.tvmaze?.events.length ?? 0),
    error: tv.status === 'rejected' ? message(tv.reason) : undefined,
  });

  if (nj.status === 'fulfilled') last.njpw = nj.value;
  sources.push({ id: 'njpw', ok: nj.status === 'fulfilled', count: last.njpw?.length ?? 0, error: nj.status === 'rejected' ? message(nj.reason) : undefined });

  if (wiki.status === 'fulfilled') last.wikipedia = wiki.value;
  sources.push({ id: 'wikipedia', ok: wiki.status === 'fulfilled', count: last.wikipedia?.length ?? 0, error: wiki.status === 'rejected' ? message(wiki.reason) : undefined });

  for (const s of sources) if (!s.ok) console.warn(`[schedule] ${s.id} no respondió: ${s.error}`);

  return {
    episodes: last.tvmaze?.episodes ?? [],
    showImages: last.tvmaze?.showImages ?? {},
    // Orden = prioridad al quitar duplicados: TVmaze y NJPW traen hora; Wikipedia solo fecha
    events: [...(last.tvmaze?.events ?? []), ...(last.njpw ?? []), ...(last.wikipedia ?? [])],
    sources,
    updatedAt: new Date().toISOString(),
  };
}

/** Datos automáticos del calendario, con caché en memoria de 6 h (15 min si alguna fuente falló). */
export async function loadSchedule(): Promise<ScheduleResponse> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = build()
    .then((data) => {
      const allOk = data.sources.every((s) => s.ok);
      cache = { at: allOk ? Date.now() : Date.now() - TTL_MS + 15 * 60_000, data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
