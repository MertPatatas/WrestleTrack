import type { PromotionId } from '../../data/types';

type Known = Exclude<PromotionId, 'other'>;
const ORDER: Known[] = ['wwe', 'aew', 'cmll', 'aaa', 'njpw'];

// Palabras que identifican cada promoción. "AAA" y "RAW" distinguen mayúsculas
// para no confundirse con palabras normales.
const RULES: Record<Known, RegExp[]> = {
  wwe: [
    /\bWWE\b/gi, /\bSmackDown\b/gi, /\bNXT\b/gi, /\bWrestleMania\b/gi, /\bRoyal Rumble\b/gi,
    /\bSummerSlam\b/gi, /\bSurvivor Series\b/gi, /\bMonday Night Raw\b/gi, /\bCrown Jewel\b/gi,
    /\bMoney in the Bank\b/gi, /\bElimination Chamber\b/gi, /\bSaturday Night'?s Main Event\b/gi,
    /\bRAW\b/g,
  ],
  aew: [
    /\bAEW\b/gi, /\bAll Elite Wrestling\b/gi, /\bDouble or Nothing\b/gi, /\bFull Gear\b/gi,
    /\bDynamite\b/g,
  ],
  cmll: [
    /\bCMLL\b/gi, /Consejo Mundial de Lucha Libre/gi, /Arena M[eé]xico/gi, /Arena Coliseo/gi,
    /Super Viernes|Viernes Espectacular/gi,
  ],
  aaa: [
    /\bAAA\b/g, /Triple ?Man[ií]a/gi, /Lucha Libre AAA/gi, /Rey de Reyes/gi,
    /H[eé]roes Inmortales/gi, /Verano de Esc[aá]ndalo/gi,
  ],
  njpw: [
    /\bNJPW\b/gi, /New Japan/gi, /\bG1 Climax\b/gi, /Wrestle Kingdom/gi, /Wrestling Dontaku/gi,
    /King of Pro-Wrestling/gi, /Power Struggle/gi, /Best of the Super Juniors/gi,
  ],
};

function count(text: string, rules: RegExp[]): number {
  let n = 0;
  for (const rule of rules) n += text.match(rule)?.length ?? 0;
  return n;
}

export interface TagInput {
  title: string;
  categories: string[];
  summary: string;
  hints: PromotionId[]; // promoción de los feeds por categoría donde apareció
}

export interface TagResult {
  promotion: PromotionId;
  score: number;
}

// Puntúa cada promoción (título y categorías pesan más que el extracto).
// Si no hay coincidencias, usa la pista del feed; si tampoco, "General".
export function tagPromotion(input: TagInput): TagResult {
  const cats = input.categories.join(' | ');
  let best: Known | null = null;
  let bestScore = 0;

  for (const id of ORDER) {
    const rules = RULES[id];
    const score =
      3 * count(input.title, rules) + 3 * count(cats, rules) + Math.min(count(input.summary, rules), 2);
    const hinted = input.hints.includes(id);
    const bestHinted = best !== null && input.hints.includes(best);
    if (score > bestScore || (score === bestScore && score > 0 && hinted && !bestHinted)) {
      best = id;
      bestScore = score;
    }
  }

  if (best) return { promotion: best, score: bestScore };
  const hint = input.hints.find((h) => h !== 'other');
  return { promotion: hint ?? 'other', score: 0 };
}

// Publicidad y apuestas: se descartan siempre. "Lucha de apuestas" (máscara o
// cabellera) es un combate de lucha libre, por eso no se filtra "apuestas" a secas.
const BLOCKED_TITLE =
  /\b(casinos?|sportsbook|apuestas deportivas|cripto(?:monedas?)?|bitcoin|gambling|betting|tragamonedas|bono de bienvenida|c[oó]digo promocional)\b/i;

export function isBlocked(title: string): boolean {
  return BLOCKED_TITLE.test(title);
}

// Contenido que no es wrestling (MMA, boxeo, fútbol...). Solo se descarta si
// no menciona ninguna promoción.
const EXCLUDED_CATEGORY =
  /\b(ufc|mma|bellator|pfl|k-1|box|boxeo|f[uú]tbol|cine|videojuegos|ol[ií]mpica)\b/i;
const EXCLUDED_TITLE = /\b(UFC|MMA|Bellator|PFL|Octagon)\b/;

export function isExcluded(title: string, categories: string[]): boolean {
  return EXCLUDED_TITLE.test(title) || categories.some((c) => EXCLUDED_CATEGORY.test(c));
}
