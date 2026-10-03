import 'server-only';
import type { Show } from '../../data/types';
import { api as wikiApi, clean as cleanWiki } from './sources/wikipedia';

// CARTELERA de un show, de la fuente que la publique:
//   - PPV/PLE con artículo en Wikipedia: tabla de combates del artículo.
//   - NJPW: API oficial (la misma que usa su web).
//   - AEW Dynamite/Collision: previa oficial en el blog de AEW.
//   - CMLL viernes y domingo (Arena México): cartelera de la web oficial.
// Solo para shows que aún no han terminado: después las fuentes muestran resultados (spoilers).

export interface CardMatch {
  title?: string; // estipulación o tipo de combate ("Campeonato Mundial", "Ladder match"...)
  participants: string; // "A vs. B"
}

export interface EventCard {
  matches: CardMatch[];
  note?: string; // aviso de la fuente ("todos los combates por anunciar"...)
  source: { name: string; url: string };
}

const UA = 'WrestleTrack/0.1 (calendario de lucha libre; https://github.com/MertPatatas/WrestleTrack)';
const TTL_MS = 30 * 60_000;
const MAX_MATCHES = 20;

const cache = new Map<string, { at: number; card: EventCard | null }>();

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000), cache: 'no-store' });
  if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
  return res.text();
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&#8217;|&lsquo;|&#8216;/g, "'")
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

// "MÍSTICO Y EL UNITED EMPIRE" → "Místico y el United Empire" (las carteleras del CMLL van en mayúsculas)
function titleCase(text: string): string {
  if (text !== text.toUpperCase()) return text;
  const small = /^(y|e|de|del|la|el|los|las|vs\.?|a|en)$/i;
  const roman = /^(ii|iii|iv|vi|vii|viii|ix|xi|xii)([.,)]?)$/i;
  const words = text.toLowerCase().split(' ');
  return words
    .map((w, i) => {
      if (roman.test(w)) return w.toUpperCase();
      // Tras una coma o un paréntesis empieza otro nombre: "el Cobarde" → "El Cobarde"
      const startsName = i === 0 || /[,(]$/.test(words[i - 1]) || w.startsWith('(');
      if (!startsName && small.test(w)) return w;
      return w.replace(/(^|[(‘'"-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
    })
    .join(' ')
    .replace(/\bJr\b/g, 'Jr')
    .replace(/\bVs\b/g, 'vs.');
}

// ---------------------------------------------------------------- Wikipedia

/** Combates de la plantilla "Pro wrestling results table" de un artículo. */
export function parseWikiCard(wikitext: string): CardMatch[] {
  const start = wikitext.search(/\{\{\s*Pro ?wrestling results table/i);
  if (start < 0) return [];
  // Fin de la plantilla, contando las llaves de plantillas anidadas
  let depth = 0;
  let end = start;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
      depth++;
      i++;
    } else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--;
      i++;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const block = wikitext.slice(start, end);
  const field = (name: string) => block.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n]*)`, 'i'))?.[1] ?? '';
  const matches: CardMatch[] = [];
  for (let n = 1; n <= 40; n++) {
    const raw = field(`match${n}`);
    if (!raw) continue;
    const participants = cleanWiki(raw);
    if (!participants) continue;
    const title = cleanWiki(field(`stip${n}`)) || undefined;
    matches.push({ title, participants });
  }
  return matches;
}

async function wikipediaCard(url: string): Promise<EventCard | null> {
  const title = decodeURIComponent(url.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  if (!title) return null;
  const json = await wikiApi({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' });
  const matches = parseWikiCard(json.parse?.wikitext ?? '');
  return matches.length ? { matches: matches.slice(0, MAX_MATCHES), source: { name: 'Wikipedia', url } } : null;
}

// ---------------------------------------------------------------- NJPW

interface NjpwPlayer {
  name: string;
}
interface NjpwMatch {
  title: string;
  sub_title: string;
  players_top_left_list: NjpwPlayer[] | null;
  players_top_right_list: NjpwPlayer[] | null;
  players_bottom_left_list: NjpwPlayer[] | null;
  players_bottom_right_list: NjpwPlayer[] | null;
}

async function njpwCard(postId: string): Promise<EventCard | null> {
  const list = JSON.parse(await getText(`https://app.njpw1972.com/tournament/card_results/${postId}.json`)) as NjpwMatch[];
  const team = (players: NjpwPlayer[] | null) =>
    (players ?? []).map((p) => decode(p.name ?? '')).filter(Boolean).join(' & ');
  const matches: CardMatch[] = [];
  let note: string | undefined;
  for (const m of list) {
    const sides = [m.players_top_left_list, m.players_top_right_list, m.players_bottom_left_list, m.players_bottom_right_list]
      .map(team)
      .filter(Boolean);
    if (sides.length >= 2) matches.push({ title: decode(m.sub_title) || undefined, participants: sides.join(' vs. ') });
    else if (m.title) note = decode(m.title.replace(/^※/, ''));
  }
  if (!matches.length && !note) return null;
  return { matches: matches.slice(0, MAX_MATCHES), note, source: { name: 'NJPW', url: `https://www.njpw1972.com/tornament/card/${postId}` } };
}

// ---------------------------------------------------------------- AEW (previas oficiales)

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

async function aewCard(show: 'Dynamite' | 'Collision', date: string): Promise<EventCard | null> {
  const feed = await getText('https://www.allelitewrestling.com/blog-feed.xml');
  const [y, m, d] = date.split('-').map(Number);
  const dateText = `${MONTHS[m - 1]} ${d}, ${y}`;
  const items = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((it) => ({
    title: decode((it[1].match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? '').replace(/<[^>]+>/g, '')),
    link: it[1].match(/<link>([^<]+)<\/link>/)?.[1]?.trim(),
  }));
  // "AEW Collision Preview: October 3, 2026 – ..." o "AEW Dynamite & Collision Preview: ..."
  const preview = items.find(
    (it) => it.link && new RegExp(`\\b${show}\\b[^:]*Preview:\\s*${dateText}`, 'i').test(it.title),
  );
  if (!preview?.link) return null;

  const html = await getText(preview.link);
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
    .replace(/<(h[1-6]|p|li|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const seen = new Set<string>();
  const matches: CardMatch[] = [];
  for (const raw of text.split('\n')) {
    const line = decode(raw);
    if (line.length < 8 || line.length > 220 || !/\bvs\.?\s/i.test(line) || /preview/i.test(line) || seen.has(line)) continue;
    seen.add(line);
    // "AEW Continental Title Eliminator Match: Jon Moxley (c) vs. Jake Doyle"
    const parts = line.match(/^([^:]{3,90}):\s+(.+\bvs\.?\s.+)$/i);
    matches.push(parts ? { title: parts[1], participants: parts[2] } : { participants: line });
  }
  return matches.length ? { matches: matches.slice(0, MAX_MATCHES), source: { name: 'AEW', url: preview.link } } : null;
}

// ---------------------------------------------------------------- CMLL (Arena México)

const CMLL_SLUGS: Record<string, string> = { 'cmll-viernes': 'viernes-espectacular', 'cmll-domingo': 'domingo-familiar' };

async function cmllCard(weeklyId: string, date: string): Promise<EventCard | null> {
  const slug = CMLL_SLUGS[weeklyId];
  if (!slug) return null;
  const posts = JSON.parse(
    await getText(`https://cmll.com/wp-json/wp/v2/lucha?slug=${slug}&_fields=content,modified,link`),
  ) as { content: { rendered: string }; modified: string; link: string }[];
  const post = posts[0];
  if (!post) return null;
  // La web solo tiene la cartelera de la próxima función: tiene que ser de los 8 días anteriores
  const ageDays = (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${post.modified}Z`)) / 86_400_000;
  if (ageDays < 0 || ageDays > 8) return null;

  const matches: CardMatch[] = [];
  for (const p of post.content.rendered.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const lines = p[1].split(/<br\s*\/?>/i).map((l) => decode(l.replace(/<[^>]+>/g, ''))).filter(Boolean);
    const vs = lines.findIndex((l) => /^vs\.?$/i.test(l));
    if (vs > 0 && vs < lines.length - 1) {
      // Si antes del "VS" hay más de una línea, la primera es el tipo de lucha
      const title = vs >= 2 ? lines[0] : undefined;
      const left = lines.slice(vs >= 2 ? 1 : 0, vs).join(' ');
      const right = lines.slice(vs + 1).join(' ');
      matches.push({ title: title && titleCase(title), participants: `${titleCase(left)} vs. ${titleCase(right)}` });
    } else if (lines.length >= 3 && /campal|rey|torneo|eliminaci/i.test(lines[0])) {
      // Batalla campal o torneo: nombre y lista de participantes
      matches.push({ title: titleCase(lines[0]), participants: lines.slice(1).map(titleCase).join(', ') });
    }
  }
  return matches.length ? { matches: matches.slice(0, MAX_MATCHES), source: { name: 'CMLL', url: post.link } } : null;
}

// ---------------------------------------------------------------- Selección de fuente

async function resolve(show: Show): Promise<EventCard | null> {
  const weekly = show.id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  if (show.kind === 'weekly') {
    if (weekly === 'dynamite' || weekly === 'collision') {
      return aewCard(weekly === 'dynamite' ? 'Dynamite' : 'Collision', show.eventDate);
    }
    if (weekly.startsWith('cmll-')) return cmllCard(weekly, show.eventDate);
    return null;
  }
  if (show.id.startsWith('njpw-')) return njpwCard(show.id.slice(5));
  if (show.url?.includes('wikipedia.org/wiki/')) return wikipediaCard(show.url);
  return null;
}

/** Cartelera de un show (con caché de 30 min). null si ninguna fuente la publica. */
export async function loadCard(show: Show): Promise<EventCard | null> {
  const hit = cache.get(show.id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.card;
  let card: EventCard | null = null;
  try {
    card = await resolve(show);
  } catch (err) {
    console.warn(`[card] ${show.id}:`, err instanceof Error ? err.message : err);
    if (hit) return hit.card; // si la fuente falla, la última copia buena
  }
  cache.set(show.id, { at: Date.now(), card });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return card;
}
