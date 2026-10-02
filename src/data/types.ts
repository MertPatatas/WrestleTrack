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
  kind: ShowKind;
  startsAt: string; // ISO 8601 (UTC)
  venue?: string;
}
