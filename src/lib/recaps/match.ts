import type { Show } from '../../data/types';

// Asocia el título de un artículo o un vídeo ("WWE RAW 28 Septiembre 2026 | Review y Resumen",
// "AEW Dynamite Review LIVE (Sep 30 2026)", "Money in the Bank 2026: cobertura y resultados"...)
// con el show del calendario del que habla.

const DAY_MS = 86_400_000;

/** Minúsculas, sin acentos y solo letras/números separados por un espacio. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ES_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);

/** Fecha que menciona el título ('YYYY-MM-DD'), en español o en inglés. */
export function titleDate(title: string): string | null {
  const n = normalize(title).replace(/\bsetiembre\b/g, 'septiembre');
  // "28 de septiembre de 2026", "28 Septiembre 2026"
  const es = n.match(new RegExp(`\\b(\\d{1,2}) (?:de )?(${ES_MONTHS.join('|')}) (?:de |del )?(\\d{4})\\b`));
  if (es) return isoDay(Number(es[3]), ES_MONTHS.indexOf(es[2]) + 1, Number(es[1]));
  // "Sep 28 2026", "September 28th, 2026"
  const en = n.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)? (\d{4})\b/);
  if (en) return isoDay(Number(en[3]), EN_MONTHS.indexOf(en[1]) + 1, Number(en[2]));
  // "28 September 2026"
  const en2 = n.match(/\b(\d{1,2})(?:st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{4})\b/);
  if (en2) return isoDay(Number(en2[3]), EN_MONTHS.indexOf(en2[2]) + 1, Number(en2[1]));
  return null;
}

// Cómo se nombra cada show semanal en los títulos (sobre el texto normalizado)
const WEEKLY_PATTERNS: Record<string, RegExp> = {
  raw: /\b(?:monday night )?raw\b/,
  smackdown: /\bsmack ?down\b/,
  nxt: /\bnxt\b(?! (?:live|level up|house|europe))/,
  dynamite: /\bdynamite\b/,
  collision: /\bcollision\b/,
  aaa: /\b(?:lucha libre aaa|aaa en fox|aaa on fox|aaa)\b/,
  'cmll-martes': /\bmartes (?:de )?arena mexico\b/,
  'cmll-viernes': /\bviernes espectacular\b/,
  'cmll-domingo': /\bdomingo familiar\b/,
};

const STOP = new Set(['wwe', 'aew', 'njpw', 'cmll', 'aaa', 'x', 'vs', 'the', 'of', 'in', 'at', 'de', 'del', 'la', 'el', 'en', 'night', 'noche', 'dia', 'day']);

/** Palabras que identifican un evento especial ("Money in the Bank" → money, bank). */
function keyWords(name: string): string[] {
  return normalize(name)
    .split(' ')
    .filter((w) => w && !STOP.has(w) && !/^\d{4}$/.test(w));
}

function nameMatches(show: Show, words: Set<string>): boolean {
  const key = keyWords(show.name);
  if (key.length === 0 || key.join('').length < 4) return false;
  const hits = key.filter((w) => words.has(w)).length;
  // Nombres largos ("Wrestle Kingdom 21 in Tokyo Dome") basta con la mayoría de las palabras
  return key.length >= 4 ? hits / key.length >= 0.75 : hits === key.length;
}

const weeklyIdOf = (show: Show) => show.id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);

/** El show encaja en fecha: la del título (±1 día por zonas horarias) o, sin ella, la de publicación. */
function dateFits(show: Show, date: string | null, publishedAt: number): boolean {
  if (date) return Math.abs(dayDiff(show.eventDate, date)) <= 1;
  const start = Date.parse(show.startsAt);
  const end = Date.parse(show.endsAt);
  return publishedAt >= start - DAY_MS && publishedAt <= end + 4 * DAY_MS;
}

/** El más cercano a la fecha de referencia (la del título o la de publicación). */
function closest(shows: Show[], date: string | null, publishedAt: number): Show | null {
  const ref = date ? Date.parse(`${date}T12:00:00Z`) : publishedAt;
  let best: Show | null = null;
  for (const s of shows) {
    const d = Math.abs(Date.parse(s.startsAt) - ref);
    if (!best || d < Math.abs(Date.parse(best.startsAt) - ref)) best = s;
  }
  return best;
}

/**
 * Show del que habla un título, entre los del calendario ya empezados.
 * Primero los eventos especiales (su nombre es más específico) y después los semanales.
 */
export function matchShow(title: string, publishedAt: number, shows: Show[]): Show | null {
  const n = normalize(title);
  const words = new Set(n.split(' '));
  const date = titleDate(title);

  const specials = shows.filter((s) => s.kind !== 'weekly' && nameMatches(s, words) && dateFits(s, date, publishedAt));
  if (specials.length) return closest(specials, date, publishedAt);

  // Si el título nombra varios semanales, manda el que aparece primero
  let firstAt = Infinity;
  let weeklyId: string | null = null;
  for (const [id, pattern] of Object.entries(WEEKLY_PATTERNS)) {
    const at = n.search(pattern);
    if (at >= 0 && at < firstAt) {
      firstAt = at;
      weeklyId = id;
    }
  }
  if (!weeklyId) return null;
  const weekly = shows.filter((s) => s.kind === 'weekly' && weeklyIdOf(s) === weeklyId && dateFits(s, date, publishedAt));
  return closest(weekly, date, publishedAt);
}

/** Vídeo de análisis o resumen de un show (no previas ni predicciones). */
export function isAnalysisTitle(title: string): boolean {
  const n = normalize(title);
  if (/\b(?:preview|previa|predictions?|predicciones|prediccion|shorts|live stream|watch along|watchalong)\b/.test(n)) return false;
  return /\b(?:review|reviews|resumen|recap|reaccion|reaction|analisis|analysis|results|resultados|lo bueno y lo malo|grades|calificaciones|hot takes?)\b/.test(n);
}

/** Artículo de resultados de un show (no previas ni audiencias). */
export function isResultsTitle(title: string): boolean {
  const n = normalize(title);
  return /\bresultados\b/.test(n) && !/\b(?:previa|audiencia|audiencias|apuestas|pronosticos)\b/.test(n);
}
