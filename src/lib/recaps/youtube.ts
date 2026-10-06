import 'server-only';
import { isAnalysisTitle } from './match';

// VÍDEOS DE ANÁLISIS: canales que suben una review o resumen de cada programa.
// Se leen de su feed RSS público (los ~15 últimos vídeos), sin clave de API.
// Para añadir un canal: su id "UC…" (aparece en la dirección del canal o en el código de su página).

export interface Channel {
  id: string;
  name: string;
  lang: 'es' | 'en';
}

export const CHANNELS: Channel[] = [
  { id: 'UCn4fZiy_ZSQpXev1MO3_BNA', name: 'Falbak', lang: 'es' },
  { id: 'UCz5DkZXywjvhhubijsJ_NpA', name: 'Rolsogames', lang: 'es' },
  { id: 'UCUwXj8PfFuLGSuFTkYxkZEQ', name: 'WhatCulture Wrestling', lang: 'en' },
  { id: 'UCRSW0_U9cdAQU5FEOXs-DJw', name: 'WrestleTalk', lang: 'en' },
  { id: 'UC5YhP-H5snGgi6dOE8vj-aA', name: 'Simon Miller', lang: 'en' },
];

export interface FeedVideo {
  id: string;
  title: string;
  publishedAt: number;
  channel: Channel;
}

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

async function channelVideos(channel: Channel): Promise<FeedVideo[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, {
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`youtube ${channel.name}: HTTP ${res.status}`);
  const xml = await res.text();
  const videos: FeedVideo[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = m[1];
    const id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    const title = decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim();
    const publishedAt = Date.parse(entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? '');
    // Los Shorts no son análisis (y su enlace es /shorts/…)
    if (!id || !title || !Number.isFinite(publishedAt) || /\/shorts\//.test(entry)) continue;
    if (!isAnalysisTitle(title)) continue;
    videos.push({ id, title, publishedAt, channel });
  }
  return videos;
}

/** Vídeos de análisis recientes de todos los canales (los canales que fallen se ignoran). */
export async function fetchAnalysisVideos(): Promise<FeedVideo[]> {
  const results = await Promise.allSettled(CHANNELS.map(channelVideos));
  const videos: FeedVideo[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') videos.push(...r.value);
    else console.warn('[recaps]', r.reason instanceof Error ? r.reason.message : r.reason);
  }
  return videos;
}
