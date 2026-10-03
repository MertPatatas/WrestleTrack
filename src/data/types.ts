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

export type StorylineStatus = 'en_curso' | 'cerrada';

export interface StorylineUpdate {
  showName: string;
  date: string; // ISO 8601
  advanced: boolean;
  summary: string;
}

export interface Storyline {
  id: string;
  promotion: PromotionId;
  title: string;
  subtitle: string;
  status: StorylineStatus;
  updates: StorylineUpdate[]; // la más reciente primero
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
  tapedOn?: string; // 'YYYY-MM-DD' del evento en que se grabó, si se emite otro día
  auto?: boolean; // detectado automáticamente (Wikipedia)
  venue?: string; // recinto y/o ciudad
  broadcast?: string; // cadena o plataforma
  note?: string;
}
