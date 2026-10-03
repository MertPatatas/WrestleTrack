import {
  exceptions,
  specialEvents,
  weeklyShows,
  type AutoEpisode,
  type SpecialEvent,
  type WeeklyShow,
} from '../../data/schedule';
import type { Show } from '../../data/types';
import { DAY_MS, addDays, daysBetween, weekdayOf, zonedTimeToUtc } from './time';

const DEFAULT_SPECIAL_MIN = 180;

export interface ScheduleOptions {
  pastDays?: number;
  futureDays?: number;
  episodes?: AutoEpisode[]; // episodios semanales publicados por las fuentes (TVmaze)
  autoEvents?: SpecialEvent[]; // eventos especiales de las fuentes, de más a menos fiable
}

const normalizeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Un evento ya está si hay otro de la misma promoción, con fecha a un día como mucho
// (las fuentes pueden dar la fecha de EE. UU. o la local) y con un nombre que contiene
// al otro ("Grand Slam France" ⊂ "Dynamite: Grand Slam France").
function findExisting(e: SpecialEvent, shows: Show[]): Show | undefined {
  const name = normalizeName(e.name);
  return shows.find((s) => {
    if (s.promotion !== e.promotion || Math.abs(daysBetween(s.eventDate, e.date)) > 1) return false;
    if (s.night !== e.night && s.night !== undefined && e.night !== undefined) return false;
    const other = normalizeName(s.name);
    return other.includes(name) || name.includes(other);
  });
}

function specialToShow(e: SpecialEvent): Show {
  // Sin hora anunciada se coloca a mediodía local para ordenarlo dentro de su día
  const start = zonedTimeToUtc(e.date, e.time ?? '12:00', e.timeZone);
  // Sin hora, el evento sigue en "Próximos" hasta que termina su día
  const end = e.time
    ? start + (e.durationMin ?? DEFAULT_SPECIAL_MIN) * 60_000
    : zonedTimeToUtc(addDays(e.date, 1), '00:00', e.timeZone);
  return {
    id: e.id,
    promotion: e.promotion,
    name: e.name,
    night: e.night,
    kind: e.kind,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    eventDate: e.date,
    timeTbd: !e.time,
    timeApprox: e.time ? e.approx : undefined,
    venue: e.venue,
    broadcast: e.broadcast,
    note: e.note,
    url: e.url,
    image: e.image,
    auto: e.auto,
  };
}

function weeklyToShow(
  w: WeeklyShow,
  id: string,
  date: string,
  over: { time?: string; name?: string; venue?: string; broadcast?: string; note?: string } = {},
): Show {
  const start = zonedTimeToUtc(date, over.time ?? w.time, w.timeZone);
  return {
    id,
    promotion: w.promotion,
    name: over.name ?? w.name,
    kind: 'weekly',
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + w.durationMin * 60_000).toISOString(),
    eventDate: date,
    venue: over.venue ?? w.venue,
    broadcast: over.broadcast ?? w.broadcast,
    note: over.note ?? w.note,
  };
}

/** Shows (semanales + especiales) entre hace pastDays y dentro de futureDays, ordenados por fecha. */
export function buildSchedule(
  now: number = Date.now(),
  { pastDays = 14, futureDays = 90, episodes = [], autoEvents = [] }: ScheduleOptions = {},
): Show[] {
  const from = now - pastDays * DAY_MS;
  const to = now + futureDays * DAY_MS;
  const shows: Show[] = [];

  const exceptionFor = new Map(exceptions.map((e) => [`${e.show}:${e.date}`, e]));

  // Fechas que cubre la fuente para cada show: dentro de ese tramo manda la fuente
  // (incluidas las semanas sin emisión); fuera, las reglas de siempre.
  const coverage = new Map<string, { first: string; last: string }>();
  for (const ep of episodes) {
    const c = coverage.get(ep.show);
    if (!c) coverage.set(ep.show, { first: ep.date, last: ep.date });
    else {
      if (ep.date < c.first) c.first = ep.date;
      if (ep.date > c.last) c.last = ep.date;
    }
  }

  // Un día de margen a cada lado: la fecha local de la promoción puede no coincidir con la UTC
  const first = new Date(from - DAY_MS).toISOString().slice(0, 10);
  const last = new Date(to + DAY_MS).toISOString().slice(0, 10);

  for (let date = first; date <= last; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    for (const w of weeklyShows) {
      if (w.weekday !== weekday) continue;
      const c = coverage.get(w.id);
      if (c && date >= c.first && date <= c.last) continue;
      const ex = exceptionFor.get(`${w.id}:${date}`);
      if (ex?.cancel) continue;
      shows.push(weeklyToShow(w, `${w.id}-${date}`, ex?.newDate ?? date, ex ?? {}));
    }
  }

  for (const ep of episodes) {
    const w = weeklyShows.find((s) => s.id === ep.show);
    if (!w) continue;
    // Una corrección manual para esa fecha tiene prioridad sobre la fuente
    const ex = exceptionFor.get(`${w.id}:${ep.date}`);
    if (ex?.cancel) continue;
    shows.push(
      weeklyToShow(w, `${w.id}-${ep.date}`, ex?.newDate ?? ep.date, {
        time: ex?.time ?? ep.time,
        name: ex?.name ?? ep.name,
        venue: ex?.venue ?? ep.venue,
        broadcast: ex?.broadcast,
        note: ex?.note,
      }),
    );
  }

  // Shows semanales grabados en un evento y emitidos días después (p. ej. Collision: Grand Slam
  // France, grabado el martes en París y emitido el sábado): se indica cuándo se grabó
  for (const e of [...specialEvents, ...autoEvents]) {
    const name = normalizeName(e.name);
    for (const s of shows) {
      if (s.kind !== 'weekly' || s.promotion !== e.promotion || s.tapedOn) continue;
      const after = daysBetween(e.date, s.eventDate);
      if (after >= 1 && after <= 7 && normalizeName(s.name).includes(name)) s.tapedOn = e.date;
    }
  }

  // Primero las correcciones manuales, luego las fuentes en orden de fiabilidad;
  // un evento repetido se descarta, pero aporta su enlace si el que se queda no tiene.
  for (const e of [...specialEvents, ...autoEvents]) {
    const existing = findExisting(e, shows);
    if (!existing) shows.push(specialToShow(e));
    else if (existing.kind !== 'weekly') {
      existing.url ??= e.url;
      existing.image ??= e.image;
      existing.venue ??= e.venue;
    }
  }

  return shows
    .filter((s) => new Date(s.endsAt).getTime() >= from && new Date(s.startsAt).getTime() <= to)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Avisos para quien edita las correcciones manuales: excepciones que no cuadran. */
export function checkScheduleData(): string[] {
  const problems: string[] = [];
  for (const e of exceptions) {
    const w = weeklyShows.find((s) => s.id === e.show);
    if (!w) problems.push(`Excepción para un show que no existe: "${e.show}"`);
    else if (weekdayOf(e.date) !== w.weekday)
      problems.push(`La excepción de ${e.show} del ${e.date} no cae en su día habitual`);
  }
  return problems;
}
