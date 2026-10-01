import type { NewsItem, Promotion, Show, Storyline } from './types';

// DATOS DE EJEMPLO: se sustituirán por datos reales (API / Supabase).

export const promotions: Promotion[] = [
  { id: 'wwe', name: 'WWE', short: 'WWE' },
  { id: 'aew', name: 'AEW', short: 'AEW' },
  { id: 'cmll', name: 'CMLL', short: 'CMLL' },
  { id: 'aaa', name: 'AAA', short: 'AAA' },
  { id: 'njpw', name: 'NJPW', short: 'NJPW' },
  { id: 'other', name: 'General', short: 'General' },
];

const hoursAgo = (now: number, h: number) => new Date(now - h * 3600_000).toISOString();

export function getNews(now: number = Date.now()): NewsItem[] {
  return [
    {
      id: 'n1',
      promotion: 'wwe',
      title: 'Noticia de ejemplo de WWE',
      excerpt: 'Aquí irá un extracto breve con enlace a la fuente original.',
      source: 'Fuente de ejemplo',
      url: 'https://example.com',
      publishedAt: hoursAgo(now, 2),
    },
    {
      id: 'n2',
      promotion: 'aew',
      title: 'Noticia de ejemplo de AEW',
      excerpt: 'Las noticias reales llegarán por RSS y se etiquetarán por promoción.',
      source: 'Fuente de ejemplo',
      url: 'https://example.com',
      publishedAt: hoursAgo(now, 4),
    },
    {
      id: 'n3',
      promotion: 'cmll',
      title: 'Noticia de ejemplo de CMLL',
      excerpt: 'Cobertura de lucha libre mexicana.',
      source: 'Fuente de ejemplo',
      url: 'https://example.com',
      publishedAt: hoursAgo(now, 7),
    },
    {
      id: 'n4',
      promotion: 'njpw',
      title: 'Noticia de ejemplo de NJPW',
      excerpt: 'Cobertura de puroresu.',
      source: 'Fuente de ejemplo',
      url: 'https://example.com',
      publishedAt: hoursAgo(now, 20),
    },
    {
      id: 'n5',
      promotion: 'other',
      title: 'Noticia de ejemplo del mundo del wrestling',
      excerpt: 'Noticias generales de la industria, más allá de las cinco promociones.',
      source: 'Fuente de ejemplo',
      url: 'https://example.com',
      publishedAt: hoursAgo(now, 30),
    },
  ];
}

export function getStorylines(now: number = Date.now()): Storyline[] {
  return [
    {
      id: 's1',
      promotion: 'wwe',
      title: 'Storyline de ejemplo A',
      subtitle: 'Rivalidad por un campeonato',
      status: 'en_curso',
      updates: [
        {
          showName: 'Raw',
          date: hoursAgo(now, 30),
          advanced: true,
          summary: 'Resumen de ejemplo: aquí se explica cómo avanzó la historia en el último show.',
        },
      ],
    },
    {
      id: 's2',
      promotion: 'aew',
      title: 'Storyline de ejemplo B',
      subtitle: 'Enfrentamiento entre dos facciones',
      status: 'en_curso',
      updates: [
        {
          showName: 'Dynamite',
          date: hoursAgo(now, 54),
          advanced: false,
          summary: 'Resumen de ejemplo: esta semana la historia no apareció en el show.',
        },
      ],
    },
    {
      id: 's3',
      promotion: 'cmll',
      title: 'Storyline de ejemplo C',
      subtitle: 'Lucha de apuestas en preparación',
      status: 'en_curso',
      updates: [
        {
          showName: 'Show de ejemplo',
          date: hoursAgo(now, 80),
          advanced: true,
          summary: 'Resumen de ejemplo: se anunció el siguiente combate de la rivalidad.',
        },
      ],
    },
  ];
}

// offsetWeeks: 0 = próxima ocurrencia, -1 = la anterior, 1 = la siguiente...
function occurrence(
  nowMs: number,
  weekday: number,
  hourUtc: number,
  minute: number,
  offsetWeeks: number,
): string {
  const now = new Date(nowMs);
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, minute),
  );
  d.setUTCDate(d.getUTCDate() + ((weekday - d.getUTCDay() + 7) % 7));
  if (d.getTime() <= nowMs) d.setUTCDate(d.getUTCDate() + 7);
  d.setUTCDate(d.getUTCDate() + 7 * offsetWeeks);
  return d.toISOString();
}

const weekly: { promotion: Show['promotion']; name: string; weekday: number; hour: number }[] = [
  { promotion: 'wwe', name: 'Raw', weekday: 1, hour: 1 },
  { promotion: 'wwe', name: 'NXT', weekday: 2, hour: 0 },
  { promotion: 'aew', name: 'Dynamite', weekday: 3, hour: 0 },
  { promotion: 'wwe', name: 'SmackDown', weekday: 5, hour: 0 },
  { promotion: 'aew', name: 'Collision', weekday: 6, hour: 0 },
];

export function getShows(now: number = Date.now()): Show[] {
  return weekly
    .flatMap((w) =>
      [-2, -1, 0, 1].map((offset) => ({
        id: `${w.name}-${offset}`,
        promotion: w.promotion,
        name: w.name,
        kind: 'weekly' as const,
        startsAt: occurrence(now, w.weekday, w.hour, 0, offset),
      })),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
