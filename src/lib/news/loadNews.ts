import type { NewsItem, PromotionId } from '../../data/types';
import { parseFeed, type ParsedItem } from './parse';
import { feedSources, type FeedSource } from './sources';
import { isBlocked, isExcluded, tagPromotion } from './tag';

export interface SourceStatus {
  id: string;
  name: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface NewsResponse {
  items: NewsItem[];
  sources: SourceStatus[];
  updatedAt: string;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_ITEMS = 100;
const USER_AGENT = 'WrestleTrack/0.1 (lector de noticias; enlaza a la fuente original)';

let cache: { at: number; data: NewsResponse } | null = null;
let inflight: Promise<NewsResponse> | null = null;

async function fetchFeed(source: FeedSource): Promise<ParsedItem[]> {
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
    },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = parseFeed(await res.text());
  if (items.length === 0) throw new Error('sin artículos legibles (¿no es un feed RSS?)');
  return items;
}

function describeError(reason: unknown): string {
  if (reason instanceof Error) {
    if (reason.name === 'TimeoutError') return 'tiempo de espera agotado';
    const cause = (reason as Error & { cause?: { code?: string } }).cause;
    return cause?.code ? `${reason.message} (${cause.code})` : reason.message;
  }
  return String(reason);
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith('utm_')) u.searchParams.delete(key);
    }
    return (u.origin + u.pathname.replace(/\/+$/, '') + u.search).toLowerCase();
  } catch {
    return url;
  }
}

function hashId(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface Candidate {
  item: ParsedItem;
  source: FeedSource;
  hints: PromotionId[];
  categories: Set<string>;
}

async function build(): Promise<NewsResponse> {
  const results = await Promise.allSettled(feedSources.map((s) => fetchFeed(s)));

  const sources: SourceStatus[] = [];
  const merged = new Map<string, Candidate>();

  results.forEach((result, i) => {
    const source = feedSources[i];
    if (result.status === 'rejected') {
      sources.push({ id: source.id, name: source.name, ok: false, count: 0, error: describeError(result.reason) });
      return;
    }
    sources.push({ id: source.id, name: source.name, ok: true, count: result.value.length });

    for (const item of result.value) {
      const key = normalizeUrl(item.link);
      const previous = merged.get(key);
      if (!previous) {
        merged.set(key, {
          item,
          source,
          hints: source.promotion ? [source.promotion] : [],
          categories: new Set(item.categories),
        });
      } else {
        if (source.promotion && !previous.hints.includes(source.promotion)) previous.hints.push(source.promotion);
        item.categories.forEach((c) => previous.categories.add(c));
        if (!previous.item.image && item.image) previous.item.image = item.image;
      }
    }
  });

  const now = Date.now();
  const items: NewsItem[] = [];
  for (const { item, source, hints, categories } of merged.values()) {
    if (new Date(item.publishedAt).getTime() > now + 24 * 3600_000) continue; // fechas futuras
    if (isBlocked(item.title)) continue;

    const cats = [...categories];
    const { promotion, score } = tagPromotion({ title: item.title, categories: cats, summary: item.summary, hints });
    if (score === 0 && isExcluded(item.title, cats)) continue;

    items.push({
      id: hashId(item.link),
      promotion,
      title: item.title,
      excerpt: item.summary,
      source: source.name,
      url: item.link,
      publishedAt: item.publishedAt,
      image: item.image,
      lang: source.lang,
    });
  }

  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { items: items.slice(0, MAX_ITEMS), sources, updatedAt: new Date().toISOString() };
}

export async function loadNews(): Promise<NewsResponse> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;

  inflight = build()
    .then((data) => {
      // Si todo falla, se mantiene lo último que funcionó
      if (data.items.length === 0 && cache) return cache.data;
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
