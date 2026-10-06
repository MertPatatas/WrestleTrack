import 'server-only';
import type { AutoEpisode, SpecialEvent } from '../../data/schedule';
import { buildSchedule } from '../schedule/build';
import { loadCard } from '../schedule/card';
import { photosFor } from './photos';

// PREPARAR LAS CARTELERAS DE LOS PRÓXIMOS DÍAS: se cargan (de Wikipedia, AEW, CMLL, NJPW) y se
// buscan las fotos de sus luchadores, para que al abrir un show ya estén. Se ejecuta una vez por
// hora desde /api/push/dispatch, con un límite de tiempo para no pasar del máximo de la función.

const DAY_MS = 86_400_000;
const DAYS_AHEAD = 10;
const TIME_BUDGET_MS = 40_000;
const NEW_PHOTOS_PER_SHOW = 15; // el resto, en la siguiente hora

export interface WarmResult {
  shows: number; // shows revisados
  withCard: number; // de ellos, con cartelera publicada
  people: number;
  photos: number; // personas con foto
}

export async function warmUpcomingCards(data: { episodes: AutoEpisode[]; events: SpecialEvent[] }, now = Date.now()): Promise<WarmResult> {
  const deadline = now + TIME_BUDGET_MS;
  const shows = buildSchedule(now, { pastDays: 0, futureDays: DAYS_AHEAD, episodes: data.episodes, autoEvents: data.events })
    .filter((s) => Date.parse(s.startsAt) > now && Date.parse(s.startsAt) < now + DAYS_AHEAD * DAY_MS)
    // Primero los más cercanos
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const result: WarmResult = { shows: 0, withCard: 0, people: 0, photos: 0 };
  for (const show of shows) {
    if (Date.now() > deadline) break;
    result.shows++;
    const card = await loadCard(show).catch(() => null);
    if (!card) continue;
    result.withCard++;
    const people = card.matches.flatMap((m) => (m.sides ?? []).flatMap((side) => side.people));
    if (!people.length) continue;
    const photos = await photosFor(people, { maxNew: NEW_PHOTOS_PER_SHOW }).catch(() => ({}));
    const found = Object.values(photos);
    result.people += found.length;
    result.photos += found.filter(Boolean).length;
  }
  return result;
}
