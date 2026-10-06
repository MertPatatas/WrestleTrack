import 'server-only';
import type { MatchSide, Person, Show } from '../../data/types';
import { matchShow } from '../recaps/match';
import { fetchPreviewCard, listPreviewArticles } from '../recaps/solowrestling';
import { isPersonName, peopleFromText, sidesFromText } from '../wrestlers/people';
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
  group?: string; // parte del evento si tiene varias ("Night 1", "Pre-show"...)
  sides?: MatchSide[]; // quién está en cada lado (para las fotos)
  segment?: boolean; // segmento anunciado, no un combate ("X hará una aparición")
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

/**
 * Lados de un combate en wikitexto, con el artículo de cada luchador sacado de sus enlaces:
 * "[[The Elite (professional wrestling)|The Elite]] ([[Kenny Omega]] and [[Hangman Page|Page]]) vs. [[Bandido (wrestler)|Bandido]]"
 * Los acompañantes "(with …)" no cuentan; de un equipo con miembros, salen los miembros.
 */
function sidesFromWikitext(raw: string): MatchSide[] {
  const text = raw.replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>|<!--[\s\S]*?-->/gi, '');
  const parts = text.split(/\s+vs\.?\s+/i);
  if (parts.length < 2) return [];
  return parts.map((sideRaw) => {
    // Enlaces → marcadores, para poder quitar paréntesis sin romper "[[Pac (wrestler)|Pac]]"
    const links: Person[] = [];
    const side = sideRaw
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, shown?: string) => {
        links.push({ name: cleanWiki(shown ?? target), wiki: target.split('#')[0].trim() });
        return `§${links.length - 1}§`;
      })
      .replace(/\((?:with|w\/)\s[^)]*\)/gi, '')
      .replace(/\(c\)/gi, '');
    const team = side.match(/^[^(]*\((.+)\)\s*$/);
    const scope = team ? team[1] : side;
    const people = [...scope.matchAll(/§(\d+)§/g)].map((m) => links[Number(m[1])]).filter((p) => p && isPersonName(p.name));
    const label = trimSeparators(cleanWiki(sideRaw));
    return { label, people: people.length ? people.slice(0, 4) : peopleFromText(label) };
  });
}

/** Bloques de la plantilla "Pro wrestling results table" (uno por noche o por pre-show). */
function resultTables(wikitext: string): string[] {
  const blocks: string[] = [];
  const pattern = /\{\{\s*Pro ?wrestling results table/gi;
  for (let m = pattern.exec(wikitext); m; m = pattern.exec(wikitext)) {
    // Fin de la plantilla, contando las llaves de plantillas anidadas
    let depth = 0;
    let end = m.index;
    for (let i = m.index; i < wikitext.length - 1; i++) {
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
    if (end <= m.index) break;
    blocks.push(wikitext.slice(m.index, end));
    pattern.lastIndex = end;
  }
  return blocks;
}

// "Singles match / " (la nota que seguía se quitó o estaba vacía) → "Singles match"
const trimSeparators = (text: string) => text.replace(/^(?:\s*\/\s*)+|(?:\s*\/\s*)+$/g, '').trim();

/**
 * Combates de las tablas de resultados de un artículo. Si hay varias (noches, pre-show), cada
 * combate lleva el título de la suya en "group"; con night, solo la de esa noche si se distingue.
 */
export function parseWikiCard(wikitext: string, night?: number): CardMatch[] {
  let tables = resultTables(wikitext).map((block) => {
    const field = (name: string) => block.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n]*)`, 'i'))?.[1] ?? '';
    const matches: CardMatch[] = [];
    for (let n = 1; n <= 40; n++) {
      const raw = field(`match${n}`);
      if (!raw) continue;
      const participants = trimSeparators(cleanWiki(raw));
      const sides = sidesFromWikitext(raw);
      if (!participants) continue;
      // {{small|…}} suele ser una aclaración útil ("el ganador se clasifica para…"): se conserva el texto
      const stip = field(`stip${n}`).replace(/\{\{\s*small\s*\|([^{}]*)\}\}/gi, '$1');
      matches.push({ title: trimSeparators(cleanWiki(stip)) || undefined, participants, ...(sides.length >= 2 ? { sides } : {}) });
    }
    return { caption: trimSeparators(cleanWiki(field('caption'))), matches };
  });
  tables = tables.filter((tb) => tb.matches.length);
  if (night !== undefined) {
    const own = tables.filter((tb) => new RegExp(`\\bnight ${night}\\b`, 'i').test(tb.caption));
    if (own.length) tables = own;
  }
  const grouped = tables.length > 1;
  return tables.flatMap((tb) => tb.matches.map((m) => (grouped && tb.caption ? { ...m, group: tb.caption } : m)));
}

async function wikipediaCard(url: string, night?: number): Promise<EventCard | null> {
  const title = decodeURIComponent(url.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  if (!title) return null;
  const json = await wikiApi({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' });
  const matches = parseWikiCard(json.parse?.wikitext ?? '', night);
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

const CMLL_SLUGS: Record<string, string> = {
  'cmll-martes': 'martes-arena-mexico',
  'cmll-viernes': 'viernes-espectacular',
  'cmll-domingo': 'domingo-familiar',
};

async function cmllCard(weeklyId: string, date: string): Promise<EventCard | null> {
  const slug = CMLL_SLUGS[weeklyId];
  if (!slug) return null;
  const posts = JSON.parse(
    await getText(`https://cmll.com/wp-json/wp/v2/lucha?slug=${slug}&_fields=content,modified,link`),
  ) as { content: { rendered: string }; modified: string; link: string }[];
  const post = posts[0];
  if (!post) return null;
  // La web solo tiene la cartelera de la próxima función: tiene que haberse publicado en los 8 días
  // anteriores (o el mismo día: las funciones son de noche en CDMX, ya de madrugada en UTC)
  const ageDays = (Date.parse(`${date}T12:00:00Z`) + 86_400_000 - Date.parse(`${post.modified}Z`)) / 86_400_000;
  if (ageDays < 0 || ageDays > 9) return null;

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

// ---------------------------------------------------------------- Previas de Solowrestling

/** "Previa WWE NXT 6 de octubre de 2026": cartelera de un show semanal (en español). */
async function solowrestlingCard(show: Show): Promise<EventCard | null> {
  const day = Date.parse(`${show.eventDate}T12:00:00Z`);
  // Se compara con el propio show (con su fecha, sin hora: basta para los semanales)
  const target = { ...show, startsAt: new Date(day).toISOString(), endsAt: new Date(day + 6 * 3600_000).toISOString() } as Show;
  const preview = (await listPreviewArticles())
    .filter((a) => matchShow(a.title, a.publishedAt, [target]))
    .sort((a, b) => b.publishedAt - a.publishedAt)[0];
  if (!preview) return null;
  const items = await fetchPreviewCard(preview.url);
  if (!items.length) return null;
  return {
    matches: items.map((i) => ({ title: i.title, participants: i.participants, ...(i.segment ? { segment: true } : {}) })),
    source: { name: 'Solowrestling', url: preview.url },
  };
}

// ---------------------------------------------------------------- Selección de fuente

async function resolve(show: Show): Promise<EventCard | null> {
  const weekly = show.id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  const wikiUrl = show.url?.includes('wikipedia.org/wiki/') ? show.url : undefined;
  if (show.kind === 'weekly') {
    // Semanal convertido en evento especial (p. ej. "Dynamite: Grand Slam France"): su artículo
    // de Wikipedia trae la cartelera completa; si aún no la tiene, la fuente habitual
    if (wikiUrl) {
      const card = await wikipediaCard(wikiUrl, show.night).catch(() => null);
      if (card) return card;
    }
    if (weekly.startsWith('cmll-')) return cmllCard(weekly, show.eventDate);
    if (weekly === 'dynamite' || weekly === 'collision') {
      const card = await aewCard(weekly === 'dynamite' ? 'Dynamite' : 'Collision', show.eventDate).catch(() => null);
      if (card) return card;
    }
    // Raw, SmackDown, NXT, AAA (y AEW si su blog aún no tiene la previa): previa de Solowrestling
    return solowrestlingCard(show);
  }
  if (show.id.startsWith('njpw-')) return njpwCard(show.id.slice(5));
  if (wikiUrl) return wikipediaCard(wikiUrl, show.night);
  return null;
}

/** Cartelera de un show (con caché de 30 min). null si ninguna fuente la publica. */
export async function loadCard(show: Show): Promise<EventCard | null> {
  const hit = cache.get(`${show.id}:${show.night ?? ''}`);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.card;
  let card: EventCard | null = null;
  try {
    card = await resolve(show);
  } catch (err) {
    console.warn(`[card] ${show.id}:`, err instanceof Error ? err.message : err);
    if (hit) return hit.card; // si la fuente falla, la última copia buena
  }
  // Fuentes sin enlaces (AEW, CMLL, NJPW): los lados se sacan del texto
  for (const m of card?.matches ?? []) m.sides ??= sidesFromText(m.participants);
  cache.set(`${show.id}:${show.night ?? ''}`, { at: Date.now(), card });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return card;
}
