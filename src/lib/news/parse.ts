import { cleanExcerpt, cleanText, decodeEntities, stripCdata } from './text';

export interface ParsedItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: string; // ISO 8601
  image?: string;
  categories: string[];
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : null;
}

function attr(tagSource: string, name: string): string | null {
  const m = tagSource.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[1] ?? m[2] ?? null) : null;
}

const isHttp = (u: string) => /^https?:\/\//i.test(u);

function extractLink(block: string): string {
  // RSS: <link>https://...</link>
  const text = tag(block, 'link');
  if (text) {
    const url = cleanText(text);
    if (isHttp(url)) return url;
  }
  // Atom: <link rel="alternate" href="https://..."/>
  let fallback = '';
  for (const m of block.matchAll(/<link\b([^>]*)>/gi)) {
    const href = attr(m[1], 'href');
    if (!href) continue;
    const rel = attr(m[1], 'rel');
    if (!rel || rel === 'alternate') return decodeEntities(href);
    fallback = fallback || decodeEntities(href);
  }
  const guid = tag(block, 'guid');
  if (guid && isHttp(cleanText(guid))) return cleanText(guid);
  return fallback;
}

function extractDate(block: string): string | null {
  for (const name of ['pubDate', 'published', 'updated', 'dc:date']) {
    const raw = tag(block, name);
    if (!raw) continue;
    const time = Date.parse(cleanText(raw));
    if (!Number.isNaN(time)) return new Date(time).toISOString();
  }
  return null;
}

function normalizeImage(raw: string): string | undefined {
  let url = decodeEntities(raw).trim();
  if (url.startsWith('//')) url = 'https:' + url;
  if (url.startsWith('http://')) url = 'https://' + url.slice(7);
  if (!url.startsWith('https://')) return undefined;
  if (/feedburner|doubleclick|\/pixel|[?&](w|width)=1(&|$)/i.test(url)) return undefined;
  return url;
}

function extractImage(block: string): string | undefined {
  const candidates: string[] = [];

  for (const m of block.matchAll(/<media:(?:content|thumbnail)\b([^>]*)>/gi)) {
    const url = attr(m[1], 'url');
    const type = attr(m[1], 'type') ?? '';
    const medium = attr(m[1], 'medium') ?? '';
    if (url && !type.startsWith('video') && medium !== 'video') candidates.push(url);
  }
  for (const m of block.matchAll(/<enclosure\b([^>]*)>/gi)) {
    const url = attr(m[1], 'url');
    if (url && (attr(m[1], 'type') ?? '').startsWith('image')) candidates.push(url);
  }

  // Primera imagen dentro del contenido HTML (escapado o en CDATA)
  const html = stripCdata(
    tag(block, 'content:encoded') ?? tag(block, 'description') ?? tag(block, 'content') ?? tag(block, 'summary') ?? '',
  );
  const img = decodeEntities(html).match(/<img\b[^>]*?\bsrc=["']([^"']+)["']/i);
  if (img) candidates.push(img[1]);

  for (const c of candidates) {
    const url = normalizeImage(c);
    if (url) return url;
  }
  return undefined;
}

function extractCategories(block: string): string[] {
  const out: string[] = [];
  for (const m of block.matchAll(/<category\b([^>]*?)(?:\/>|>([\s\S]*?)<\/category>)/gi)) {
    const value = m[2] !== undefined ? cleanText(m[2]) : (attr(m[1], 'term') ?? '');
    if (value) out.push(value);
  }
  return out;
}

export function parseFeed(xml: string): ParsedItem[] {
  const blocks =
    xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];

  const items: ParsedItem[] = [];
  for (const block of blocks) {
    const title = cleanText(tag(block, 'title') ?? '');
    const link = extractLink(block);
    const publishedAt = extractDate(block);
    if (!title || !isHttp(link) || !publishedAt) continue;

    const rawSummary =
      tag(block, 'description') ?? tag(block, 'summary') ?? tag(block, 'content:encoded') ?? tag(block, 'content') ?? '';

    items.push({
      title,
      link,
      summary: cleanExcerpt(rawSummary),
      publishedAt,
      image: extractImage(block),
      categories: extractCategories(block),
    });
  }
  return items;
}
