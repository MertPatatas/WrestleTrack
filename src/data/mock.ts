import type { Promotion, Storyline } from './types';

// Promociones y storylines de ejemplo (las storylines se sustituirán por datos reales).

export const promotions: Promotion[] = [
  { id: 'wwe', name: 'WWE', short: 'WWE' },
  { id: 'aew', name: 'AEW', short: 'AEW' },
  { id: 'cmll', name: 'CMLL', short: 'CMLL' },
  { id: 'aaa', name: 'AAA', short: 'AAA' },
  { id: 'njpw', name: 'NJPW', short: 'NJPW' },
  { id: 'other', name: 'General', short: 'General' },
];

const hoursAgo = (now: number, h: number) => new Date(now - h * 3600_000).toISOString();

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
