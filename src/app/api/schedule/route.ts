import { NextResponse } from 'next/server';
import type { AutoEpisode, SpecialEvent } from '../../../data/schedule';
import { fetchNjpwBigEvents } from '../../../lib/schedule/sources/njpw';
import { fetchTvmaze } from '../../../lib/schedule/sources/tvmaze';
import { fetchWikipediaEvents } from '../../../lib/schedule/sources/wikipedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export interface ScheduleSourceStatus {
  id: 'tvmaze' | 'njpw' | 'wikipedia';
  ok: boolean;
  count: number;
  error?: string;
}

export interface ScheduleResponse {
  episodes: AutoEpisode[]; // episodios semanales (TVmaze)
  events: SpecialEvent[]; // eventos especiales, de la fuente más fiable a la menos
  sources: ScheduleSourceStatus[];
  updatedAt: string;
}

const TTL_MS = 6 * 3600_000;

// Lo último que funcionó de cada fuente: si una falla, se reutiliza su copia anterior
let last: { tvmaze?: { episodes: AutoEpisode[]; events: SpecialEvent[] }; njpw?: SpecialEvent[]; wikipedia?: SpecialEvent[] } = {};
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
    // Orden = prioridad al quitar duplicados: TVmaze y NJPW traen hora; Wikipedia solo fecha
    events: [...(last.tvmaze?.events ?? []), ...(last.njpw ?? []), ...(last.wikipedia ?? [])],
    sources,
    updatedAt: new Date().toISOString(),
  };
}

async function load(): Promise<ScheduleResponse> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = build()
    .then((data) => {
      // Si alguna fuente falló, se vuelve a intentar antes (en 15 min) en vez de esperar 6 h
      const allOk = data.sources.every((s) => s.ok);
      cache = { at: allOk ? Date.now() : Date.now() - TTL_MS + 15 * 60_000, data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function GET() {
  const data = await load();
  const allOk = data.sources.every((s) => s.ok);
  return NextResponse.json(data, {
    headers: {
      // La CDN guarda la respuesta y sirve la antigua mientras refresca
      'Cache-Control': allOk
        ? 'public, s-maxage=21600, stale-while-revalidate=86400'
        : 'public, s-maxage=900, stale-while-revalidate=86400',
    },
  });
}
