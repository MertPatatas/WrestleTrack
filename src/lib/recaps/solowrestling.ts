import 'server-only';
import type { RecapItem } from '../../data/types';
import { isResultsTitle, normalize } from './match';

// RESULTADOS de Solowrestling (en español): publica la cobertura de cada Raw, SmackDown, NXT,
// Dynamite, Collision, AAA y de los grandes eventos. Sus artículos vienen en dos formatos:
//   - Con un apartado "Resumen de …": lista de una línea por combate o segmento.
//   - Crónica en directo: cada combate ("A vs. B") termina con "Ganador: …".
// Solo se guardan los resultados (quién ganó a quién), con enlace al artículo completo.

const UA = 'WrestleTrack/0.1 (calendario de lucha libre; https://github.com/MertPatatas/WrestleTrack)';
const MAX_ITEMS = 25;

export interface ArticleRef {
  title: string;
  url: string;
  publishedAt: number;
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!res.ok) throw new Error(`solowrestling: HTTP ${res.status}`);
  return res.text();
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&#8217;|&lsquo;|&#8216;|&apos;/g, "'")
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&([a-z])(acute|tilde|uml);/gi, (_, c: string, k: string) =>
      (c + ({ acute: '́', tilde: '̃', uml: '̈' } as Record<string, string>)[k.toLowerCase()]).normalize('NFC'),
    )
    .replace(/&iexcl;/g, '¡')
    .replace(/&iquest;/g, '¿')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

// El id numérico identifica el artículo aunque cambie la dirección (con o sin www)
const articleId = (url: string) => url.match(/\/new\/(\d+)/)?.[1] ?? url;

/** Artículos de resultados recientes: sitemap de noticias (unos 5 días) + RSS (los 50 últimos). */
export async function listResultArticles(): Promise<ArticleRef[]> {
  return listArticles(isResultsTitle);
}

/** Previas ("Previa WWE NXT 6 de octubre de 2026: cartelera y horarios"), con caché de 20 min. */
let previews: { at: number; list: ArticleRef[] } | null = null;
export async function listPreviewArticles(): Promise<ArticleRef[]> {
  if (previews && Date.now() - previews.at < 20 * 60_000) return previews.list;
  const list = await listArticles((title) => /^previa\b/i.test(title.trim()));
  previews = { at: Date.now(), list };
  return list;
}

async function listArticles(accept: (title: string) => boolean): Promise<ArticleRef[]> {
  const found = new Map<string, ArticleRef>();
  const add = (title: string, url: string | undefined, date: string | undefined) => {
    if (!url || !title || !accept(title)) return;
    const publishedAt = Date.parse(date ?? '');
    if (!Number.isFinite(publishedAt)) return;
    found.set(articleId(url), { title, url: url.replace('://solowrestling.com', '://www.solowrestling.com'), publishedAt });
  };

  const [sitemap, rss] = await Promise.allSettled([
    getText('https://solowrestling.com/GOOGLESITEMAP110-E.XML'),
    getText('https://solowrestling.com/rss/SWRSS.xml'),
  ]);
  if (sitemap.status === 'fulfilled') {
    for (const m of sitemap.value.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const block = m[1];
      add(
        decode(block.match(/<news:title>([\s\S]*?)<\/news:title>/)?.[1] ?? '').trim(),
        block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim(),
        block.match(/<news:publication_date>([^<]+)</)?.[1],
      );
    }
  }
  if (rss.status === 'fulfilled') {
    for (const m of rss.value.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1];
      add(
        decode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim(),
        block.match(/<link>([^<]+)<\/link>/)?.[1]?.trim(),
        block.match(/<pubDate>([^<]+)</)?.[1],
      );
    }
  }
  if (sitemap.status === 'rejected' && rss.status === 'rejected') throw sitemap.reason;
  return [...found.values()];
}

/** HTML → líneas de texto; los títulos empiezan por "## ", las viñetas por "* " y la negrita va entre **. */
function toLines(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')
    .replace(/<(h[1-6])[^>]*>/gi, '\n## ')
    .replace(/<li[^>]*>/gi, '\n* ')
    .replace(/<(p|br|div|ul|ol|section|article)[^>]*>/gi, '\n')
    .replace(/<\/?(strong|b)(\s[^>]*)?>/gi, '**')
    .replace(/<[^>]+>/g, '');
  return decode(text)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').replace(/\*\*\s*\*\*/g, '').trim())
    .filter(Boolean);
}

const plain = (line: string) =>
  line
    .replace(/^(\* |## )/, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Toda la línea va en negrita ("**Combate por parejas**"). */
const isBold = (line: string) => /^\*\*[^*]+\*\*\s*:?$/.test(line.replace(/\*\*\s*\*\*/g, ''));

const RESULT_VERBS =
  /\b(?:vencio|vencieron|derroto|derrotaron|retuvo|retuvieron|gano|ganaron|se impuso|se impusieron|empataron|empate|sin resultado|descalificacion|cuenta fuera|sin decision)\b/;

/** Apartado "Resumen de …": una viñeta por combate o segmento. */
function fromSummary(lines: string[]): RecapItem[] {
  const start = lines.findIndex((l) => /^## Resumen de /i.test(l));
  if (start < 0) return [];
  const items: RecapItem[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (!line.startsWith('* ')) continue;
    const text = plain(line);
    if (text.length < 8) continue;
    items.push(RESULT_VERBS.test(normalize(text)) ? { text } : { text, segment: true });
  }
  return items;
}

const WINNER = /^(?:ganador|ganadora|ganadores|ganadoras|vencedor|vencedora|vencedores|vencedoras)\b[^:]{0,90}:\s*\S/i;
const NO_WINNER = /^(?:combate sin resultado|sin resultado|sin decision|empate|doble descalificacion|doble cuenta fuera|no contest)\b/;

/** Crónica en directo: combate ("A vs. B", con el título en la línea anterior) y su "Ganador: …". */
function fromLiveCoverage(lines: string[]): RecapItem[] {
  const end = lines.findIndex((l) => /^## Sobre el autor|^Síguenos en Google News|^\*\*Fin de la transmisi/i.test(l));
  const body = end > 0 ? lines.slice(0, end) : lines;
  const items: RecapItem[] = [];
  let current: RecapItem | null = null;

  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    if (line.startsWith('## ') || line.startsWith('* ')) continue; // titulares y combates anunciados
    const text = plain(line);
    const n = normalize(text);

    if (current && (WINNER.test(text) || NO_WINNER.test(n))) {
      current.result = text.replace(/\s*\.$/, '');
      items.push(current);
      current = null;
      continue;
    }
    // Línea de combate: corta, con "vs." y sin ser una frase de la narración
    if (/\svs\.?\s/i.test(text) && text.length <= 260 && !/[.!?]$/.test(text)) {
      const prev = body[i - 1] ?? '';
      const prevText = plain(prev);
      const title =
        isBold(prev) && !/\svs\.?\s/i.test(prevText) && prevText.length <= 120 && !/^[¡!]|[!.]$/.test(prevText)
          ? prevText.replace(/:$/, '')
          : undefined;
      current = { title, text };
    }
  }
  return items;
}

/**
 * Texto de la crónica completa (promos, ataques, combates…), para que la IA identifique cómo
 * avanzan las storylines. Desde el título del artículo hasta el final de la cobertura.
 */
export async function fetchArticleText(url: string, maxChars = 24_000): Promise<string> {
  const lines = toLines(await getText(url));
  const first = lines.findIndex((l) => /^## .*(cobertura|resultados)/i.test(l));
  const end = lines.findIndex(
    (l, i) => i > first && /^## Sobre el autor|^Síguenos en Google News|^Please enable JavaScript|^\*\*Etiquetas relacionadas/i.test(l),
  );
  const body = lines.slice(Math.max(first, 0), end > 0 ? end : undefined);
  return body
    .map((l) => l.replace(/\*\*/g, ''))
    .filter((l) => l.length > 2 && !/^Noticia relacionada$|^Imagen:/i.test(l))
    .join('\n')
    .slice(0, maxChars);
}

/**
 * Cartelera de una previa: el apartado "## Cartelera …", una viñeta por combate
 * ("**Título:** A vs. B" o "A vs. B") o por segmento anunciado (sin "vs.").
 */
export async function fetchPreviewCard(url: string): Promise<{ title?: string; participants: string; segment?: boolean }[]> {
  const lines = toLines(await getText(url));
  const start = lines.findIndex((l) => /^## Cartelera\b/i.test(l));
  if (start < 0) return [];
  const items: { title?: string; participants: string; segment?: boolean }[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (!line.startsWith('* ')) continue;
    // "* **Combate por …:** A vs. B" (los dos puntos pueden ir dentro o fuera de la negrita)
    const titled = line.match(/^\* \*\*(.+?):?\*\*:?\s*(.+)$/);
    const title = titled ? plain(titled[1]).replace(/:$/, '') : undefined;
    const text = plain(titled ? titled[2] : line);
    if (text.length < 4) continue;
    items.push(/\svs\.?\s/i.test(text) ? { title, participants: text } : { title, participants: text, segment: true });
  }
  return items.slice(0, MAX_ITEMS);
}

/** Resultados de un artículo de Solowrestling (vacío si no se reconoce el formato). */
export async function fetchArticleResults(url: string): Promise<RecapItem[]> {
  const lines = toLines(await getText(url));
  const summary = fromSummary(lines);
  // El resumen sirve si tiene al menos dos líneas y algún combate
  const items = summary.length >= 2 && summary.some((i) => !i.segment) ? summary : fromLiveCoverage(lines);
  return items.slice(0, MAX_ITEMS);
}
