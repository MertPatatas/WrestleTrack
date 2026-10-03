import type { SpecialEvent } from '../../../data/schedule';
import type { PromotionId } from '../../../data/types';

// Detección automática de eventos especiales a partir de Wikipedia (API pública).
// Cada evento grande tiene su artículo con una ficha "Infobox wrestling event"
// (promoción, fecha, recinto, ciudad). Wikipedia no publica la hora: esos eventos
// se usa como última fuente, para los eventos que no traen TVmaze ni NJPW (p. ej. AAA).

const API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'WrestleTrack/0.1 (calendario de lucha libre; https://github.com/MertPatatas/WrestleTrack)';
const MAX_TITLES = 400; // tope de seguridad por si una categoría crece mucho

type Params = Record<string, string>;

export async function api(params: Params): Promise<any> {
  const query = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  const res = await fetch(`${API}?${query}`, {
    headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Wikipedia: ${json.error.code}`);
  return json;
}

// Categorías donde Wikipedia agrupa los eventos (se recorre también un nivel de subcategorías,
// p. ej. "2026 WWE pay-per-view events"). Se usan el año actual y el siguiente.
function rootCategories(now: Date): string[] {
  const y = now.getUTCFullYear();
  return [
    'Category:Scheduled professional wrestling shows',
    `Category:${y} in professional wrestling`,
    `Category:${y + 1} in professional wrestling`,
  ];
}

async function categoryMembers(category: string, type: 'page' | 'subcat'): Promise<string[]> {
  const out: string[] = [];
  let cont: Params | null = {};
  while (cont) {
    const json: any = await api({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmtype: type,
      cmlimit: 'max',
      ...cont,
    });
    for (const m of json.query?.categorymembers ?? []) out.push(m.title);
    cont = json.continue ?? null;
  }
  return out;
}

async function collectTitles(now: Date): Promise<string[]> {
  const titles = new Set<string>();
  for (const root of rootCategories(now)) {
    const [pages, subcats] = await Promise.all([categoryMembers(root, 'page'), categoryMembers(root, 'subcat')]);
    pages.forEach((t) => titles.add(t));
    // Solo subcategorías de eventos (evita "Deaths", "Debuts"...)
    for (const sub of subcats.filter((s) => /events|shows|pay-per-view|network/i.test(s))) {
      (await categoryMembers(sub, 'page')).forEach((t) => titles.add(t));
    }
  }
  return [...titles].slice(0, MAX_TITLES);
}

// ---------- Lectura de la ficha ----------

function infobox(content: string): string | null {
  return content.match(/\{\{\s*Infobox[^\n|]*wrestling event[\s\S]*?\n\}\}/i)?.[0] ?? null;
}

function field(box: string, name: string): string {
  return box.match(new RegExp(`\\n\\s*\\|\\s*${name}\\s*=\\s*([^\\n]*)`, 'i'))?.[1]?.trim() ?? '';
}

export function clean(raw: string): string {
  // Plantillas anidadas: se quitan de dentro hacia fuera
  let text = raw;
  for (let i = 0; i < 3 && /\{\{/.test(text); i++) text = text.replace(/\{\{[^{}]*\}\}/g, '');
  return text
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Fechas concretas del campo "date" (una por noche). Si solo pone el mes, no devuelve nada. */
export function parseWikiDates(raw: string): string[] {
  const dates = new Set<string>();

  // {{Start date|2026|10|10}}
  for (const m of raw.matchAll(/\{\{\s*start[ _]date[^|}]*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/gi)) {
    dates.add(iso(Number(m[1]), Number(m[2]), Number(m[3])));
  }

  const text = clean(raw).toLowerCase();
  const month = `(${MONTHS.join('|')})`;
  // "October 10, 2026" y rangos "June 10–11, 2026"
  for (const m of text.matchAll(new RegExp(`${month}\\s+(\\d{1,2})(?:\\s*[–-]\\s*(\\d{1,2}))?,?\\s+(\\d{4})`, 'g'))) {
    const mo = MONTHS.indexOf(m[1]) + 1;
    const from = Number(m[2]);
    const to = m[3] ? Math.min(Number(m[3]), from + 6) : from;
    for (let d = from; d <= to; d++) dates.add(iso(Number(m[4]), mo, d));
  }
  // "10 October 2026" y "10–11 October 2026"
  for (const m of text.matchAll(new RegExp(`(\\d{1,2})(?:\\s*[–-]\\s*(\\d{1,2}))?\\s+${month}\\s+(\\d{4})`, 'g'))) {
    const mo = MONTHS.indexOf(m[3]) + 1;
    const from = Number(m[1]);
    const to = m[2] ? Math.min(Number(m[2]), from + 6) : from;
    for (let d = from; d <= to; d++) dates.add(iso(Number(m[4]), mo, d));
  }
  return [...dates].sort();
}

// AAA va antes que WWE: sus eventos aparecen como "Lucha Libre AAA Worldwide / WWE"
const PROMOTION_RULES: [PromotionId, RegExp][] = [
  ['aaa', /\bAAA\b/],
  ['cmll', /Consejo Mundial|\bCMLL\b/i],
  ['njpw', /New Japan|\bNJPW\b/i],
  ['aew', /All Elite Wrestling|\bAEW\b/],
  ['wwe', /\bWWE\b/],
];

export function wikiPromotion(raw: string): PromotionId | null {
  return PROMOTION_RULES.find(([, re]) => re.test(raw))?.[0] ?? null;
}

// Zona horaria aproximada del lugar: solo se usa para ordenar eventos sin hora dentro de su día
function guessTimeZone(place: string): string {
  if (/japan/i.test(place)) return 'Asia/Tokyo';
  if (/mexico|méxico|jalisco|nuevo león|monterrey|guadalajara/i.test(place)) return 'America/Mexico_City';
  if (/saudi|riyadh|jeddah/i.test(place)) return 'Asia/Riyadh';
  if (/perth|western australia/i.test(place)) return 'Australia/Perth';
  if (/australia/i.test(place)) return 'Australia/Sydney';
  if (/england|scotland|wales|united kingdom|london/i.test(place)) return 'Europe/London';
  if (/france|germany|spain|italy|belgium|netherlands|paris|berlin|madrid/i.test(place)) return 'Europe/Paris';
  if (/arizona/i.test(place)) return 'America/Phoenix';
  if (/california|nevada|washington|oregon/i.test(place)) return 'America/Los_Angeles';
  if (/texas|illinois|minnesota|missouri|louisiana|tennessee|wisconsin|oklahoma/i.test(place)) return 'America/Chicago';
  return 'America/New_York';
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Convierte un artículo de Wikipedia en eventos (uno por noche). */
export function eventsFromArticle(title: string, content: string): SpecialEvent[] {
  const box = infobox(content);
  if (!box) return [];
  const promotion = wikiPromotion(clean(field(box, 'promotion')));
  if (!promotion) return [];

  const dates = parseWikiDates(field(box, 'date'));
  if (dates.length === 0) return [];

  const trim = (s: string) => s.replace(/^[\s,/]+|[\s,/]+$/g, '');
  // El nombre a veces trae una segunda línea ("Crown Jewel<br>Riyadh"): se queda la primera
  const name = trim(clean(field(box, 'name')).split(' / ')[0]) || title.replace(/\s*\(\d{4}\)$/, '');
  // Cartel del evento ("image = Money in the Bank 2026 poster.jpg"). Special:FilePath redirige
  // a una versión de 1000 px del archivo, sin tener que consultar la API.
  const imageFile = field(box, 'image')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\[\[|\]\]$/g, '')
    .replace(/^(File|Image|Archivo):/i, '')
    .split('|')[0]
    .trim();
  const image = /\.(jpe?g|png|webp|gif)$/i.test(imageFile)
    ? `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile.replace(/ /g, '_'))}?width=1000`
    : undefined;
  const venue = trim(clean(field(box, 'venue')).replace(/\bTBA\b/g, ''));
  const city = trim(clean(field(box, 'city')).replace(/\bTBA\b/g, ''));
  const place = [venue, city.split(',')[0]].filter(Boolean).join(', ');

  return dates.map((date, i) => ({
    id: `wiki-${slug(title)}-${date}`,
    promotion,
    name,
    night: dates.length > 1 ? i + 1 : undefined,
    kind: 'ple' as const,
    date,
    timeZone: guessTimeZone(`${venue} ${city}`),
    venue: place || undefined,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    image,
    auto: true,
  }));
}

/** Eventos de nuestras promociones anunciados en Wikipedia con fecha desde hoy (UTC). */
export async function fetchWikipediaEvents(now: Date = new Date()): Promise<SpecialEvent[]> {
  const titles = await collectTitles(now);
  const today = now.toISOString().slice(0, 10);
  const events: SpecialEvent[] = [];

  for (let i = 0; i < titles.length; i += 50) {
    const json = await api({
      action: 'query',
      titles: titles.slice(i, i + 50).join('|'),
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
    });
    for (const page of json.query?.pages ?? []) {
      const content: string = page.revisions?.[0]?.slots?.main?.content ?? '';
      for (const e of eventsFromArticle(page.title, content)) if (e.date >= today) events.push(e);
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
