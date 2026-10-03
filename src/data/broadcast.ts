import type { Show } from './types';

// DÓNDE VER CADA SHOW, por región. Los derechos de TV cambian: revisar de vez en cuando.
// Fuentes (octubre de 2026): WWE.com "how to watch", guía de AEW por países (Yahoo Sports),
// acuerdo AEW-ViX para Latinoamérica, cmll.com/donde-ver, acuerdo AAA-Fox para Latinoamérica.

export type Region = 'ES' | 'MX' | 'LATAM' | 'US' | 'INTL';
export const REGIONS: Region[] = ['ES', 'MX', 'LATAM', 'US', 'INTL'];

export interface WatchOption {
  name: string; // nombre de la plataforma o canal (marca, no se traduce)
  note?: 'membership' | 'ppv' | 'fridays' | 'replays'; // aclaración traducible
}

export interface WatchInfo {
  options: WatchOption[];
  moreUrl?: string; // web oficial con la lista completa de países
}

const LATAM_COUNTRIES = new Set([
  'AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'GT', 'HN', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE',
]);
const US_ZONES = /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise|Juneau)|^Pacific\/Honolulu/;
const MX_ZONES = /^America\/(Mexico_City|Monterrey|Merida|Cancun|Chihuahua|Hermosillo|Mazatlan|Tijuana|Matamoros|Bahia_Banderas|Ojinaga|Ciudad_Juarez)/;

/** Región por el idioma regional del dispositivo (es-ES, es-MX...) o, si no lo dice, por la zona horaria. */
export function detectRegion(locale: string, timeZone: string | null): Region {
  const country = locale.split('-')[1]?.toUpperCase();
  if (country === 'ES') return 'ES';
  if (country === 'MX') return 'MX';
  if (country === 'US') return 'US';
  if (country && LATAM_COUNTRIES.has(country)) return 'LATAM';
  const tz = timeZone ?? '';
  if (/^Europe\/Madrid|^Atlantic\/Canary|^Africa\/Ceuta/.test(tz)) return 'ES';
  if (MX_ZONES.test(tz)) return 'MX';
  if (US_ZONES.test(tz)) return 'US';
  if (/^America\//.test(tz)) return 'LATAM';
  return 'INTL';
}

type Table = Partial<Record<Region, WatchOption[]>> & { default: WatchOption[] };

const NETFLIX: WatchOption[] = [{ name: 'Netflix' }];
const MYAEW: WatchOption[] = [{ name: 'MyAEW' }];

const TABLES: Record<string, { table: Table; moreUrl?: string }> = {
  raw: { table: { default: NETFLIX }, moreUrl: 'https://www.wwe.com/article/how-to-watch' },
  smackdown: { table: { US: [{ name: 'USA Network' }], default: NETFLIX }, moreUrl: 'https://www.wwe.com/article/how-to-watch' },
  nxt: { table: { US: [{ name: 'The CW' }], default: NETFLIX }, moreUrl: 'https://www.wwe.com/article/how-to-watch' },
  wwePle: { table: { US: [{ name: 'ESPN' }], default: NETFLIX }, moreUrl: 'https://www.wwe.com/article/how-to-watch' },
  nxtPle: { table: { US: [], default: NETFLIX }, moreUrl: 'https://www.wwe.com/article/how-to-watch' },
  snme: { table: { US: [{ name: 'NBC' }, { name: 'Peacock' }], default: NETFLIX }, moreUrl: 'https://www.wwe.com/article/how-to-watch' },
  dynamite: {
    table: {
      US: [{ name: 'TBS' }, { name: 'HBO Max' }],
      MX: [{ name: 'Fox Sports' }, { name: 'ViX' }],
      LATAM: [{ name: 'ViX' }],
      default: MYAEW,
    },
  },
  collision: {
    table: {
      US: [{ name: 'TNT' }, { name: 'HBO Max' }],
      MX: [{ name: 'Fox Sports' }, { name: 'ViX' }],
      LATAM: [{ name: 'ViX' }],
      default: MYAEW,
    },
  },
  aewPpv: {
    table: {
      US: [{ name: 'HBO Max' }, { name: 'Prime Video', note: 'ppv' }],
      default: [{ name: 'MyAEW', note: 'ppv' }, { name: 'DAZN', note: 'ppv' }],
    },
  },
  cmll: {
    table: { default: [{ name: 'YouTube · VideosOficialesCMLL', note: 'membership' }] },
    moreUrl: 'https://cmll.com/donde-ver/',
  },
  cmllViernes: {
    table: {
      MX: [{ name: 'Fox Sports' }, { name: 'YouTube · VideosOficialesCMLL', note: 'membership' }],
      default: [{ name: 'YouTube · VideosOficialesCMLL', note: 'membership' }],
    },
    moreUrl: 'https://cmll.com/donde-ver/',
  },
  aaa: {
    table: { MX: [{ name: 'Fox' }, { name: 'Fox One' }], LATAM: [{ name: 'Fox' }], default: [{ name: 'YouTube · Lucha Libre AAA' }] },
  },
  aaaPle: {
    table: { MX: [{ name: 'Fox' }], LATAM: [{ name: 'Fox' }], default: [{ name: 'YouTube · WWE / AAA' }, { name: 'Facebook · WWE / AAA' }] },
  },
  njpw: { table: { default: [{ name: 'NJPW World' }] }, moreUrl: 'https://njpwworld.com/' },
};

function tableKey(show: Show): string | null {
  const weekly = show.id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  if (show.kind === 'weekly') {
    if (weekly === 'cmll-viernes') return 'cmllViernes';
    if (weekly.startsWith('cmll-')) return 'cmll';
    return TABLES[weekly] ? weekly : null;
  }
  switch (show.promotion) {
    case 'wwe':
      if (/^NXT\b/i.test(show.name)) return 'nxtPle';
      if (/saturday night/i.test(show.name)) return 'snme';
      return 'wwePle';
    case 'aew':
      return 'aewPpv';
    case 'aaa':
      return 'aaaPle';
    case 'njpw':
      return 'njpw';
    case 'cmll':
      return 'cmll';
    default:
      return null;
  }
}

/** Dónde ver un show en una región (lista vacía si no se sabe). */
export function whereToWatch(show: Show, region: Region): WatchInfo {
  const key = tableKey(show);
  if (!key) return { options: [] };
  const { table, moreUrl } = TABLES[key];
  return { options: table[region] ?? table.default, moreUrl };
}
