import type { PromotionId, Show } from './types';

// MARCAS: dentro de WWE, cada show semanal lleva el logo y el color de su marca (Raw, SmackDown,
// NXT); los grandes eventos (PLE), el de WWE. El resto de empresas usan su propio logo.
// El filtro por empresa sigue siendo por promoción: "WWE" muestra las tres marcas y sus PLE.

export type BrandId = PromotionId | 'raw' | 'smackdown' | 'nxt';

// Eventos especiales de NXT que no llevan "NXT" en el nombre
const NXT_EVENTS = /\bnxt\b|halloween havoc|stand (?:&|and) deliver|vengeance day|new year'?s evil|deadline|roadblock|heatwave|great american bash|no mercy/i;

const WEEKLY_BRANDS: Record<string, BrandId> = { raw: 'raw', smackdown: 'smackdown', nxt: 'nxt' };

/** Marca de un show (para su logo y su color). */
export function brandOf(show: Pick<Show, 'id' | 'promotion' | 'kind' | 'name'>): BrandId {
  if (show.promotion !== 'wwe') return show.promotion;
  const weekly = WEEKLY_BRANDS[show.id.replace(/-\d{4}-\d{2}-\d{2}$/, '')];
  if (weekly) return weekly;
  return NXT_EVENTS.test(show.name) ? 'nxt' : 'wwe';
}

/** Marca a partir del id de un show y su promoción (cuando no se tiene el show completo). */
export function brandOfId(showId: string, promotion: PromotionId, name = ''): BrandId {
  return brandOf({ id: showId, promotion, kind: 'weekly', name });
}
