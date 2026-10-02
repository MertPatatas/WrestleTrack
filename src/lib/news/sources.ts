import type { PromotionId } from '../../data/types';

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  lang: 'en' | 'es';
  // Pista cuando el feed es de una categoría concreta (se usa si el texto no menciona ninguna promoción)
  promotion?: PromotionId;
}

// Direcciones habituales de cada sitio. Si alguna cambia o falla, la API lo indica
// en /api/news (campo "sources") y el resto de fuentes sigue funcionando.
export const feedSources: FeedSource[] = [
  { id: 'cageside', name: 'Cageside Seats', url: 'https://www.cagesideseats.com/rss/current.xml', lang: 'en' },
  { id: 'wrestlinginc', name: 'Wrestling Inc', url: 'https://www.wrestlinginc.com/feed/', lang: 'en' },
  { id: 'ringside', name: 'Ringside News', url: 'https://www.ringsidenews.com/feed/', lang: 'en' },
  { id: 'wrestlingnews', name: 'Wrestling News', url: 'https://wrestlingnews.co/feed', lang: 'en' },

  { id: 'superluchas', name: 'Superluchas', url: 'https://superluchas.com/feed/', lang: 'es' },
  { id: 'superluchas-wwe', name: 'Superluchas', url: 'https://superluchas.com/wwe/feed/', lang: 'es', promotion: 'wwe' },
  { id: 'superluchas-aew', name: 'Superluchas', url: 'https://superluchas.com/aew/feed/', lang: 'es', promotion: 'aew' },
  { id: 'superluchas-cmll', name: 'Superluchas', url: 'https://superluchas.com/lucha-libre/cmll/feed/', lang: 'es', promotion: 'cmll' },
  { id: 'superluchas-aaa', name: 'Superluchas', url: 'https://superluchas.com/lucha-libre/aaa/feed/', lang: 'es', promotion: 'aaa' },
  { id: 'superluchas-njpw', name: 'Superluchas', url: 'https://superluchas.com/njpw/feed/', lang: 'es', promotion: 'njpw' },
  { id: 'solowrestling', name: 'Solowrestling', url: 'https://solowrestling.com/rss/SWRSS.xml', lang: 'es' },
];
