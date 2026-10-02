import type { PromotionId } from './types';

// CALENDARIO DE SHOWS: configuración de fuentes (no hace falta editarlo para el día a día)
//
// El calendario se actualiza solo desde /api/schedule, que combina:
//   1. TVmaze (programación de TV): episodios semanales con su hora exacta, cambios de día,
//      especiales y semanas sin emisión, y los PLE/PPV de WWE, NXT y AEW.
//   2. API oficial de NJPW: eventos grandes con hora de inicio.
//   3. Wikipedia: fecha de los eventos grandes que no estén en las anteriores (p. ej. AAA).
// Las reglas de weeklyShows se usan para los shows sin fuente (CMLL), para poner la hora
// cuando TVmaze solo da la fecha y para las semanas que TVmaze aún no ha publicado.
//
// Las horas van en la zona horaria de la promoción; la app las convierte a la del
// dispositivo y aplica sola los cambios de horario de verano de cada país.

const ET = 'America/New_York';
const CDMX = 'America/Mexico_City';

export interface WeeklyShow {
  id: string;
  promotion: PromotionId;
  name: string;
  weekday: number; // 0 = domingo, 1 = lunes... 6 = sábado
  time: string; // 'HH:MM' en timeZone (hora habitual)
  timeZone: string;
  durationMin: number;
  venue?: string;
  broadcast?: string;
  note?: string;
  tvmaze?: number; // id del programa en TVmaze (https://www.tvmaze.com)
}

export interface SpecialEvent {
  id: string;
  promotion: PromotionId;
  name: string;
  night?: number; // en eventos de varias noches, cuál es (1, 2...)
  kind: 'ple' | 'other';
  date: string; // 'YYYY-MM-DD' en timeZone
  time?: string; // 'HH:MM' en timeZone; sin hora = por confirmar
  approx?: boolean; // hora habitual de la promoción, no confirmada para este evento
  timeZone: string;
  durationMin?: number;
  venue?: string;
  broadcast?: string;
  note?: string;
  url?: string; // página con más información
  auto?: boolean; // detectado automáticamente
}

/** Episodio concreto de un show semanal, publicado por una fuente (TVmaze). */
export interface AutoEpisode {
  show: string; // id de weeklyShows
  date: string; // 'YYYY-MM-DD' en la zona del show
  time?: string; // 'HH:MM' en la zona del show; sin hora se usa la habitual
  name?: string; // nombre especial ("Dynamite: Fright Night")
  venue?: string;
}

/** Correcciones manuales opcionales de un show semanal (normalmente no hacen falta). */
export interface ShowException {
  show: string; // id del show semanal
  date: string; // fecha habitual 'YYYY-MM-DD' (en la zona del show)
  cancel?: boolean;
  newDate?: string;
  time?: string;
  name?: string;
  venue?: string;
  broadcast?: string;
  note?: string;
}

export const weeklyShows: WeeklyShow[] = [
  // WWE
  { id: 'raw', promotion: 'wwe', name: 'Raw', weekday: 1, time: '20:00', timeZone: ET, durationMin: 180, broadcast: 'Netflix', tvmaze: 802 },
  { id: 'nxt', promotion: 'wwe', name: 'NXT', weekday: 2, time: '20:00', timeZone: ET, durationMin: 120, tvmaze: 2266 },
  { id: 'smackdown', promotion: 'wwe', name: 'SmackDown', weekday: 5, time: '20:00', timeZone: ET, durationMin: 120, tvmaze: 803 },

  // AEW
  { id: 'dynamite', promotion: 'aew', name: 'Dynamite', weekday: 3, time: '20:00', timeZone: ET, durationMin: 120, tvmaze: 42189 },
  { id: 'collision', promotion: 'aew', name: 'Collision', weekday: 6, time: '20:00', timeZone: ET, durationMin: 120, tvmaze: 68778 },

  // CMLL (Arena México; sin fuente automática, su cartelera semanal es muy estable)
  { id: 'cmll-martes', promotion: 'cmll', name: 'Martes de Arena México', weekday: 2, time: '19:30', timeZone: CDMX, durationMin: 150, venue: 'Arena México' },
  { id: 'cmll-viernes', promotion: 'cmll', name: 'Viernes Espectacular', weekday: 5, time: '20:30', timeZone: CDMX, durationMin: 150, venue: 'Arena México' },
  { id: 'cmll-domingo', promotion: 'cmll', name: 'Domingo Familiar', weekday: 0, time: '17:00', timeZone: CDMX, durationMin: 150, venue: 'Arena México' },

  // AAA (en directo el tercer sábado de cada mes; el resto, grabado)
  { id: 'aaa', promotion: 'aaa', name: 'Lucha Libre AAA', weekday: 6, time: '20:00', timeZone: CDMX, durationMin: 60, broadcast: 'Fox (México) · YouTube', tvmaze: 89983 },
];

/** Programas de TVmaze cuyos episodios son eventos especiales (PLE, PPV...). */
export interface TvmazeSpecialSource {
  tvmaze: number;
  promotion: PromotionId;
  timeZone: string;
  prefix?: string; // se antepone al nombre si no lo lleva ("NXT ")
  defaultTime?: string; // hora habitual si TVmaze aún no la tiene (se marca como aproximada)
  durationMin: number;
}

export const tvmazeSpecials: TvmazeSpecialSource[] = [
  { tvmaze: 2855, promotion: 'wwe', timeZone: ET, durationMin: 240 }, // WWE Premium Live Events
  { tvmaze: 80711, promotion: 'wwe', timeZone: ET, prefix: 'NXT ', durationMin: 180 }, // NXT PLE
  { tvmaze: 5757, promotion: 'wwe', timeZone: ET, durationMin: 150 }, // Saturday Night's Main Event
  { tvmaze: 50115, promotion: 'aew', timeZone: ET, defaultTime: '20:00', durationMin: 240 }, // AEW PPV
];

// Correcciones manuales opcionales. Tienen prioridad sobre las fuentes automáticas.
export const specialEvents: SpecialEvent[] = [];
export const exceptions: ShowException[] = [];
