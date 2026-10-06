export type PromotionId = 'wwe' | 'aew' | 'cmll' | 'aaa' | 'njpw' | 'other';

export interface Promotion {
  id: PromotionId;
  name: string;
  short: string;
}

export interface NewsItem {
  id: string;
  promotion: PromotionId;
  title: string;
  excerpt: string;
  source: string;
  url: string;
  publishedAt: string; // ISO 8601
  image?: string; // miniatura que ofrece la propia fuente
  lang?: 'en' | 'es';
}

export type StorylineStatus = 'active' | 'closed';

export const BEAT_KINDS = ['match', 'promo', 'attack', 'announcement', 'title_change', 'turn', 'return', 'other'] as const;
export type BeatKind = (typeof BEAT_KINDS)[number];

/** Un avance de una storyline: lo que pasó en un show (o en una fecha, en las históricas). */
export interface StorylineBeat {
  id: number;
  date: string; // 'YYYY-MM-DD'
  showId?: string;
  showName?: string;
  title: string;
  text: string;
  kind: BeatKind;
  importance: 1 | 2 | 3; // 3 = momento clave
  sourceUrl?: string;
  status?: 'pending' | 'approved' | 'rejected'; // solo en la administración
}

export interface Storyline {
  id: string;
  promotion: PromotionId;
  title: string;
  summary: string; // en qué punto está la historia (o cómo terminó)
  participants: string[];
  status: StorylineStatus;
  startedOn?: string; // 'YYYY-MM-DD'
  endedOn?: string;
  related: string[]; // ids de storylines que dan contexto
  beats: StorylineBeat[]; // de la más antigua a la más reciente
  updatedAt: string; // ISO 8601
}

/** Storyline en la administración: con lo pendiente de revisar. */
export interface AdminStoryline extends Storyline {
  published: boolean;
  pending: { summary?: string; status?: StorylineStatus } | null;
}

/** Un combate (o un segmento destacado) de los resultados de un show ya emitido. */
export interface RecapItem {
  title?: string; // estipulación o título en juego
  text: string; // "A vs. B", o la frase del resumen ("A venció a B…")
  result?: string; // "Ganador: A"
  segment?: boolean; // no es un combate (promo, ataque, anuncio…)
}

/** Resultados de un show ya emitido. */
export interface Recap {
  showId: string;
  promotion: PromotionId;
  name: string;
  eventDate: string; // 'YYYY-MM-DD'
  items: RecapItem[];
  lang: 'es' | 'en';
  source: { name: string; url: string };
  updatedAt: string; // ISO 8601
}

/** Vídeo de análisis o resumen de un show (YouTube). */
export interface AnalysisVideo {
  id: string; // id del vídeo de YouTube
  title: string;
  channel: string;
  channelId: string;
  lang: 'es' | 'en';
  publishedAt: string; // ISO 8601
  showId: string;
}

export interface RecapsResponse {
  recaps: Recap[];
  videos: AnalysisVideo[];
  updatedAt: string | null; // última revisión de las fuentes
}

/** Foto de un luchador, siempre con licencia libre o subida por un administrador. */
export interface WrestlerPhoto {
  url: string;
  source: 'wikipedia' | 'openverse' | 'upload' | 'manual';
  credit?: string; // autor
  creditUrl?: string; // página de la foto (para la atribución)
  license?: string; // "CC BY-SA 4.0"
  licenseUrl?: string;
  focusX: number; // dónde está la cara, en % (para recortar en círculo)
  focusY: number;
}

/** Una persona en una cartelera o storyline; wiki = título exacto de su artículo, si se conoce. */
export interface Person {
  name: string;
  wiki?: string;
}

/** Un lado de un combate: lo que se lee ("The Elite") y quiénes son (para las fotos). */
export interface MatchSide {
  label: string;
  people: Person[];
}

export type ShowKind = 'weekly' | 'ple' | 'other';

export interface Show {
  id: string;
  promotion: PromotionId;
  name: string;
  night?: number; // en eventos de varias noches, cuál es (1, 2...)
  kind: ShowKind;
  startsAt: string; // ISO 8601 (UTC)
  endsAt: string; // ISO 8601 (UTC), estimado a partir de la duración habitual
  eventDate: string; // 'YYYY-MM-DD' en la zona horaria del evento (la fecha que anuncia la promoción)
  timeTbd?: boolean; // fecha confirmada pero hora aún sin anunciar
  timeApprox?: boolean; // hora habitual de la promoción, aún no confirmada para este evento
  url?: string; // página con más información
  image?: string; // cartel o imagen promocional del evento
  tapedOn?: string; // 'YYYY-MM-DD' del evento en que se grabó, si se emite otro día
  auto?: boolean; // detectado automáticamente (Wikipedia)
  special?: boolean; // semanal que es a la vez un evento especial (p. ej. "Dynamite: Grand Slam France")
  venue?: string; // recinto y/o ciudad
  broadcast?: string; // cadena o plataforma
  note?: string;
}

/** Evento especial (PLE, gran evento o semanal convertido en especial). */
export function isSpecial(show: Pick<Show, 'kind' | 'special'>): boolean {
  return show.kind !== 'weekly' || Boolean(show.special);
}
