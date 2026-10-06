import 'server-only';
import { BEAT_KINDS, type AdminStoryline, type BeatKind, type PromotionId, type Recap } from '../../data/types';
import { readRecaps } from '../recaps/collect';
import { fetchArticleText } from '../recaps/solowrestling';
import { api as wikiApi } from '../schedule/sources/wikipedia';
import { db } from '../server/db';
import { askGeminiJson, geminiConfigured } from './gemini';
import {
  addBeat,
  createStoryline,
  listAll,
  markJob,
  processedShows,
  proposeChanges,
  type BeatDraft,
  type StorylineDraft,
} from './store';

// BORRADORES DE STORYLINES con Gemini. Todo lo que genera queda pendiente de revisión:
//   - Tras cada show: lee la crónica de Solowrestling y propone avances en las storylines que
//     ya existen (y storylines nuevas si empieza una historia).
//   - A petición del administrador: una storyline histórica ("The Bloodline") a partir de su
//     artículo de Wikipedia, para dar contexto a las actuales.

const DAY_MS = 86_400_000;
const PROMOTIONS: PromotionId[] = ['wwe', 'aew', 'cmll', 'aaa', 'njpw', 'other'];
const RETRY_ERRORS_AFTER_MS = 3 * 3600_000;

// ---------------------------------------------------------------- Validación de la respuesta

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const strList = (v: unknown, max: number, each = 80): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => str(x, each)).filter(Boolean))].slice(0, max) : [];
const isoDay = (v: unknown): string | undefined => {
  const s = str(v, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  return undefined;
};
const kindOf = (v: unknown): BeatKind => ((BEAT_KINDS as readonly string[]).includes(v as string) ? (v as BeatKind) : 'other');
const importanceOf = (v: unknown): 1 | 2 | 3 => (v === 3 || v === '3' ? 3 : v === 1 || v === '1' ? 1 : 2);
const promotionOf = (v: unknown, fallback: PromotionId): PromotionId =>
  PROMOTIONS.includes(v as PromotionId) ? (v as PromotionId) : fallback;

function beatOf(v: unknown, base: Partial<BeatDraft>): BeatDraft | null {
  const b = (v ?? {}) as Record<string, unknown>;
  const title = str(b.title, 120);
  const text = str(b.text, 900);
  const date = isoDay(b.date) ?? base.date;
  if (!title || !text || !date) return null;
  return { ...base, date, title, text, kind: kindOf(b.kind), importance: importanceOf(b.importance), showName: str(b.showName, 80) || base.showName };
}

// ---------------------------------------------------------------- Instrucciones comunes

const STYLE = `Eres el redactor de WrestleTrack, una web en español que explica las storylines (historias guionizadas) de la lucha libre profesional a aficionados que no han visto todos los shows.
Escribes en español neutro, claro y ameno, en tercera persona y en pasado para lo ocurrido. Usas los nombres de los luchadores tal cual (en inglés si es su nombre artístico) y los términos habituales (face, heel, promo, title match...).
Te limitas a los hechos que aparecen en el texto que te dan: no inventes resultados, fechas ni detalles. Las storylines son ficción guionizada; descríbelas como tal sin romper la ilusión innecesariamente.
Respondes SOLO con JSON válido, sin texto adicional.`;

const BEAT_FORMAT = `Cada avance ("beat") es un objeto:
{ "title": "frase corta de lo que pasó (máx. 90 caracteres)", "text": "1-3 frases: qué pasó y por qué importa para la historia", "kind": uno de ${JSON.stringify(BEAT_KINDS)}, "importance": 1 (detalle menor), 2 (avance normal) o 3 (momento clave: traición, cambio de título, anuncio del combate decisivo...) }`;

// ---------------------------------------------------------------- Tras cada show

interface ShowResponse {
  updates?: { storylineId?: unknown; beat?: unknown; summary?: unknown; closed?: unknown }[];
  newStorylines?: { title?: unknown; summary?: unknown; participants?: unknown; related?: unknown; beat?: unknown }[];
}

function showPrompt(recap: Recap, coverage: string, stories: AdminStoryline[]): string {
  const active = stories
    .filter((s) => s.promotion === recap.promotion && s.status === 'active')
    .slice(0, 30)
    .map((s) => ({
      id: s.id,
      title: s.title,
      participants: s.participants,
      summary: s.summary,
      lastBeats: s.beats.slice(-3).map((b) => `${b.date}: ${b.title}`),
    }));
  const closed = stories.filter((s) => s.status === 'closed').slice(0, 40).map((s) => ({ id: s.id, title: s.title }));

  return `SHOW: ${recap.name} (${recap.promotion.toUpperCase()}), emitido el ${recap.eventDate}.

STORYLINES EN CURSO de esta empresa (JSON):
${JSON.stringify(active, null, 1)}

STORYLINES TERMINADAS (para relacionarlas como contexto):
${JSON.stringify(closed)}

CRÓNICA COMPLETA DEL SHOW (Solowrestling):
"""
${coverage}
"""

TAREA:
1. Para cada storyline EN CURSO que avance en este show, añade un elemento a "updates" con:
   - "storylineId": su id exacto de la lista.
   - "beat": el avance (formato abajo). Un solo beat por storyline y show, resumiendo todo lo de esa noche.
   - "summary": nuevo resumen de 2-4 frases de en qué punto está la historia tras este show (o null si no cambia).
   - "closed": true solo si la historia ha terminado claramente (p. ej. se resolvió en un combate final y pasan página).
2. En "newStorylines", añade solo historias NUEVAS que empiecen o se desarrollen claramente aquí (rivalidades, alianzas, traiciones, persecución de un título con continuidad). NO incluyas combates sueltos sin historia ni segmentos aislados. No dupliques storylines que ya estén en la lista (aunque cambie el enfoque, usa "updates"). Cada una con:
   - "title": nombre corto y reconocible ("Cody Rhodes vs. Gunther", "La traición de X a Y").
   - "summary": 2-4 frases de qué va la historia y en qué punto está.
   - "participants": nombres de los implicados.
   - "related": ids de storylines (en curso o terminadas) que sirven de contexto, o [].
   - "beat": lo que pasó en este show.
3. Si nada avanza, devuelve listas vacías.

${BEAT_FORMAT}

Formato de respuesta:
{ "updates": [ { "storylineId": "...", "beat": {...}, "summary": "..." | null, "closed": false } ], "newStorylines": [ { "title": "...", "summary": "...", "participants": [], "related": [], "beat": {...} } ] }`;
}

export interface ProcessResult {
  showId?: string;
  show?: string;
  updates: number;
  created: number;
  skipped?: string;
  error?: string;
}

/** Procesa el show más antiguo con crónica que la IA aún no haya leído. */
export async function processNextShow(now = Date.now()): Promise<ProcessResult> {
  if (!geminiConfigured()) return { updates: 0, created: 0, skipped: 'Falta GEMINI_API_KEY' };
  const q = await db();
  const done = await processedShows();
  const recentErrors = new Set(
    (
      await q.query<{ show_id: string }>(`select show_id from app.storyline_jobs where status = 'error' and processed_at > $1`, [
        new Date(now - RETRY_ERRORS_AFTER_MS),
      ])
    ).map((r) => r.show_id),
  );
  // Solo crónicas completas: del día anterior o antes, y de Solowrestling (las de Wikipedia son solo resultados)
  const yesterday = new Date(now - DAY_MS).toISOString().slice(0, 10);
  const { recaps } = await readRecaps(now);
  const next = recaps
    .filter((r) => r.source.name === 'Solowrestling' && r.eventDate <= yesterday && !done.has(r.showId) && !recentErrors.has(r.showId))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
  if (!next) return { updates: 0, created: 0, skipped: 'No hay shows nuevos que procesar' };

  try {
    const [coverage, stories] = await Promise.all([fetchArticleText(next.source.url), listAll()]);
    if (coverage.length < 500) throw new Error('Crónica demasiado corta o no reconocida');
    const raw = (await askGeminiJson(showPrompt(next, coverage, stories), STYLE)) as ShowResponse;

    const base: Partial<BeatDraft> = { date: next.eventDate, showId: next.showId, showName: next.name, sourceUrl: next.source.url };
    const known = new Map(stories.map((s) => [s.id, s]));
    let updates = 0;
    let created = 0;

    for (const u of Array.isArray(raw.updates) ? raw.updates : []) {
      const story = known.get(str(u.storylineId, 80));
      const beat = beatOf(u.beat, base);
      if (!story || !beat) continue;
      if (story.beats.some((b) => b.showId === next.showId)) continue; // ya tiene este show
      await addBeat(story.id, beat);
      const summary = str(u.summary, 900);
      if (summary || u.closed === true) {
        await proposeChanges(story.id, { ...(summary ? { summary } : {}), ...(u.closed === true ? { status: 'closed' as const } : {}) });
      }
      updates++;
    }

    for (const n of (Array.isArray(raw.newStorylines) ? raw.newStorylines : []).slice(0, 5)) {
      const title = str(n.title, 120);
      const summary = str(n.summary, 900);
      const beat = beatOf(n.beat, base);
      if (!title || !summary || !beat) continue;
      const draft: StorylineDraft = {
        promotion: next.promotion,
        title,
        summary,
        participants: strList(n.participants, 12),
        status: 'active',
        startedOn: next.eventDate,
        related: strList(n.related, 6).filter((id) => known.has(id)),
      };
      const id = await createStoryline(draft);
      await addBeat(id, beat);
      created++;
    }

    await markJob(next.showId, next.source.url, 'done', `${updates} avances, ${created} nuevas`);
    return { showId: next.showId, show: `${next.name} ${next.eventDate}`, updates, created };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markJob(next.showId, next.source.url, 'error', message);
    return { showId: next.showId, show: `${next.name} ${next.eventDate}`, updates: 0, created: 0, error: message };
  }
}

// ---------------------------------------------------------------- Storylines históricas

interface HistoryResponse {
  promotion?: unknown;
  title?: unknown;
  summary?: unknown;
  participants?: unknown;
  status?: unknown;
  startedOn?: unknown;
  endedOn?: unknown;
  related?: unknown;
  beats?: unknown[];
}

const WIKI_PAGE = /^https:\/\/en\.wikipedia\.org\/wiki\/([^?#]+)$/;

/** Artículo de Wikipedia para un tema: el indicado, o el primer resultado de la búsqueda. */
async function findArticle(topic: string, url?: string): Promise<{ title: string; url: string }> {
  const fromUrl = url?.match(WIKI_PAGE)?.[1];
  if (fromUrl) {
    const title = decodeURIComponent(fromUrl).replace(/_/g, ' ');
    return { title, url: url! };
  }
  const json = await wikiApi({ action: 'query', list: 'search', srsearch: `${topic} professional wrestling`, srlimit: '1' });
  const title: string | undefined = json.query?.search?.[0]?.title;
  if (!title) throw new Error(`No se encontró en Wikipedia ningún artículo sobre "${topic}"`);
  return { title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` };
}

async function articleText(title: string): Promise<string> {
  const json = await wikiApi({ action: 'query', prop: 'extracts', explaintext: '1', redirects: '1', titles: title });
  const text: string = json.query?.pages?.[0]?.extract ?? '';
  // Fuera las secciones que no cuentan la historia
  return text.replace(/\n== (See also|References|Notes|External links|Championships and accomplishments)[\s\S]*$/i, '').slice(0, 70_000);
}

/** Crea (sin publicar) una storyline histórica con su cronología a partir de Wikipedia. */
export async function generateHistorical(topic: string, url?: string): Promise<{ id: string; title: string; beats: number; source: string }> {
  if (!geminiConfigured()) throw new Error('Falta GEMINI_API_KEY');
  const article = await findArticle(topic, url);
  const [text, stories] = await Promise.all([articleText(article.title), listAll()]);
  if (text.length < 800) throw new Error(`El artículo "${article.title}" es demasiado corto`);

  const prompt = `TEMA PEDIDO: ${topic}
ARTÍCULO DE WIKIPEDIA: ${article.title}

STORYLINES QUE YA EXISTEN EN LA WEB (para "related"):
${JSON.stringify(stories.map((s) => ({ id: s.id, title: s.title })))}

TEXTO DEL ARTÍCULO:
"""
${text}
"""

TAREA: crea UNA storyline que explique esta historia a alguien que no la vivió, centrada en "${topic}".
- "promotion": una de ${JSON.stringify(PROMOTIONS)} (donde ocurrió sobre todo).
- "title": nombre reconocible ("The Bloodline", "La traición de Seth Rollins a The Shield").
- "summary": 3-5 frases: de qué va, cómo evolucionó y cómo terminó (o en qué punto sigue).
- "participants": los protagonistas (máx. 12).
- "status": "closed" si terminó, "active" si sigue hoy.
- "startedOn" / "endedOn": fechas 'YYYY-MM-DD' (si solo sabes el mes, día 01; endedOn null si sigue).
- "related": ids de la lista anterior que estén relacionados, o [].
- "beats": entre 8 y 25 momentos clave en orden cronológico, cada uno con "date" ('YYYY-MM-DD', día 01 si solo sabes el mes), "showName" (evento o programa donde pasó, si se sabe) y el formato de abajo. Prioriza los giros de la historia (alianzas, traiciones, cambios de título, regresos, el combate final).

${BEAT_FORMAT}

Formato de respuesta:
{ "promotion": "...", "title": "...", "summary": "...", "participants": [], "status": "closed", "startedOn": "...", "endedOn": "...", "related": [], "beats": [ { "date": "...", "showName": "...", "title": "...", "text": "...", "kind": "...", "importance": 2 } ] }`;

  const raw = (await askGeminiJson(prompt, STYLE)) as HistoryResponse;
  const title = str(raw.title, 120) || topic;
  const summary = str(raw.summary, 1200);
  if (!summary) throw new Error('La IA no devolvió un resumen');
  const known = new Set(stories.map((s) => s.id));
  const beats = (Array.isArray(raw.beats) ? raw.beats : [])
    .map((b) => beatOf(b, { sourceUrl: article.url }))
    .filter((b): b is BeatDraft => b !== null)
    .slice(0, 30);
  const status = raw.status === 'active' ? 'active' : 'closed';
  const id = await createStoryline({
    promotion: promotionOf(raw.promotion, 'wwe'),
    title,
    summary,
    participants: strList(raw.participants, 12),
    status,
    startedOn: isoDay(raw.startedOn) ?? beats[0]?.date,
    endedOn: status === 'closed' ? (isoDay(raw.endedOn) ?? beats[beats.length - 1]?.date) : undefined,
    related: strList(raw.related, 6).filter((r) => known.has(r)),
  });
  for (const b of beats) await addBeat(id, b);
  return { id, title, beats: beats.length, source: article.url };
}
