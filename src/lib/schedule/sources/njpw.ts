import type { SpecialEvent } from '../../../data/schedule';

// API de la web oficial de NJPW (njpw1972.com): archivos JSON públicos que usa su
// propia página de calendario. Trae cada gira ("series") con sus shows, recinto y
// hora de inicio (hora de Japón). Solo nos quedamos con los eventos grandes.

const API = 'https://app.njpw1972.com';
const MAX_PAGES = 5;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}.json`, {
    headers: { 'User-Agent': 'WrestleTrack/0.1 (calendario de lucha libre; https://github.com/MertPatatas/WrestleTrack)' },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`NJPW ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface SeriesPage {
  AllCount: number;
  posts: { post_id: string }[];
}
interface SeriesPost {
  series_title?: string;
  title?: string;
}
interface Tournament {
  post_id: number;
  event_start_date: string; // '2026-10-12T00:00:00+09:00'
  start_time: string; // '16:00' o ''
  venue?: { stadium_name?: string } | null;
}
interface SeriesSchedule {
  tournaments?: Tournament[];
}

// Eventos grandes por nombre, recintos grandes y torneos cuya final interesa
const BIG_TITLE =
  /wrestle kingdom|new year dash|new beginning|sakura genesis|wrestling dontaku|dominion|destruction|king of pro-wrestling|power struggle|windy city|forbidden door|battle in the valley|g1 special|anniversary event|wrestling hinokuni|resurgence/i;
const BIG_VENUE =
  /tokyo dome|ryogoku|sumo hall|osaka-jo|osaka castle|edion arena|osaka prefectural|nippon budokan|aichi|makuhari|yokohama arena|fukuoka kokusai|hokkaido prefectural|hiroshima sun plaza|ariake arena|saitama super arena/i;
const TOURNAMENT = /g1 climax|world tag league|best of the super jr|new japan cup/i;
const SMALL = /^road to\b|title undecided|school/i;

// "KING OF PRO-WRESTLING 2026" → "King of Pro-Wrestling"
export function prettyTitle(raw: string): string {
  const keepUpper = /^(G1|NJPW|IWGP|NEVER|USA|II|III|IV|AEW|CMLL|ROH|STRONG|WTL)$/;
  const small = /^(of|in|the|and|at|on|to)$/i;
  return raw
    .replace(/[～~〜].*?[～~〜]/g, '') // subtítulos entre ～ ～
    .replace(/\b20\d{2}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => {
      if (keepUpper.test(w) || /\d/.test(w)) return w;
      if (i > 0 && small.test(w)) return w.toLowerCase();
      return w
        .toLowerCase()
        .replace(/(^|[-.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join(' ')
    .replace(/\bJr\b/i, 'Jr');
}

export async function fetchNjpwBigEvents(today: string = new Date().toISOString().slice(0, 10)): Promise<SpecialEvent[]> {
  // 1) Todas las giras publicadas
  const first = await get<SeriesPage>('/series/tournaments/schedule/pagination/1');
  const pages = Math.min(MAX_PAGES, Math.max(1, first.AllCount));
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => get<SeriesPage>(`/series/tournaments/schedule/pagination/${i + 2}`)),
  );
  const ids = [...first.posts, ...rest.flatMap((p) => p.posts)].map((p) => p.post_id);

  // 2) Título y shows de cada gira
  const events: SpecialEvent[] = [];
  await Promise.all(
    ids.map(async (id) => {
      const [post, schedule] = await Promise.all([
        get<SeriesPost>(`/series/posts/${id}`).catch(() => ({}) as SeriesPost),
        get<SeriesSchedule>(`/series/tournaments/schedule/list/${id}`),
      ]);
      const title = post.series_title ?? post.title ?? '';
      // Se decide por el título principal, sin el subtítulo entre ～ ～
      // ("SUPER Jr. TAG LEAGUE ～Road to POWER STRUGGLE～" no es Power Struggle)
      const main = title.replace(/[～~〜].*?[～~〜]/g, '').trim();
      const shows = (schedule.tournaments ?? []).filter((t) => t.event_start_date);
      if (!main || shows.length === 0 || SMALL.test(main)) return;

      const bigTitle = BIG_TITLE.test(main);
      const isTournament = !bigTitle && TOURNAMENT.test(main);
      shows.forEach((t, i) => {
        const venue = t.venue?.stadium_name?.trim() || undefined;
        const isFinal = isTournament && i === shows.length - 1;
        const big = bigTitle || isFinal || (!isTournament && Boolean(venue && BIG_VENUE.test(venue)));
        if (!big) return;

        const date = t.event_start_date.slice(0, 10);
        if (date < today) return;
        const name = prettyTitle(title) + (isFinal ? ': Final' : '');
        events.push({
          id: `njpw-${t.post_id}`,
          promotion: 'njpw',
          name,
          night: !isFinal && shows.length > 1 ? i + 1 : undefined,
          kind: isFinal ? 'other' : 'ple',
          date,
          time: /^\d{1,2}:\d{2}$/.test(t.start_time) ? t.start_time.padStart(5, '0') : undefined,
          timeZone: 'Asia/Tokyo',
          durationMin: 210,
          venue,
          broadcast: 'NJPW World',
          url: `https://www.njpw1972.com/tornament/${t.post_id}`,
          auto: true,
        });
      });
    }),
  );
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
