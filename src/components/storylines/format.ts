import type { BeatKind, Storyline } from '../../data/types';
import type { MessageKey } from '../../i18n/messages';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

const dayDate = (day: string) => new Date(`${day}T12:00:00Z`);

/** "6 oct 2026" de una fecha 'YYYY-MM-DD' (sin moverla de zona horaria). */
export function formatDay(day: string, locale: string, withYear = true): string {
  return dayDate(day)
    .toLocaleDateString(locale, { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' })
    .replace('.', '');
}

/** "oct 2026" */
export function formatMonth(day: string, locale: string): string {
  return dayDate(day).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '');
}

/** Periodo de una storyline: "Desde sep 2026" o "nov 2020 – abr 2024". */
export function storyPeriod(s: Storyline, locale: string, t: T): string {
  const start = s.startedOn ?? s.beats[0]?.date;
  const end = s.endedOn ?? (s.status === 'closed' ? s.beats[s.beats.length - 1]?.date : undefined);
  if (!start) return '';
  if (s.status === 'active' || !end) return t('storylines.since', { date: formatMonth(start, locale) });
  return `${formatMonth(start, locale)} – ${formatMonth(end, locale)}`;
}

export const KIND_LABELS: Record<BeatKind, MessageKey> = {
  match: 'beat.match',
  promo: 'beat.promo',
  attack: 'beat.attack',
  announcement: 'beat.announcement',
  title_change: 'beat.title_change',
  turn: 'beat.turn',
  return: 'beat.return',
  other: 'beat.other',
};
