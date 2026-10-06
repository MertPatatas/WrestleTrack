import type { MatchSide, Person } from '../../data/types';
import { normalize } from '../recaps/match';

// Quién está en cada lado de un combate, a partir del texto de la cartelera:
//   "Kofi (con Austin Creed) vs. Lee Moriarty"            → [Kofi] / [Lee Moriarty]
//   "The Elite (Kenny Omega, Hangman Adam Page y The Young Bucks) vs. …" → los miembros del equipo
//   "Darby Allin & Sting vs. …"                            → [Darby Allin, Sting]
// Los mánagers y acompañantes ("con…", "with…") no cuentan.

const MAX_PER_SIDE = 4;
const NOT_A_PERSON = /^(?:tba|tbd|otros?|others?|rival|oponente|opponent|por (?:determinar|anunciar)|to be announced|mystery|sorpresa)\b/i;

/** Clave con la que se guarda la foto de una persona ("Mercedes Moné" → "mercedes mone"). */
export const personKey = (name: string) => normalize(name);

/** Nombre aceptable de una persona (no "TBA", "rival por determinar"…). */
export const isPersonName = (name: string) => name.length >= 2 && name.length <= 40 && !NOT_A_PERSON.test(name);

function splitNames(text: string): string[] {
  return text
    .split(/\s*(?:,|&|\s+y\s+|\s+and\s+)\s*/i)
    .map((n) =>
      n
        .replace(/\s+/g, ' ')
        .replace(/^(?:el|la)\s+campe[oó]n[a]?\s+/i, '')
        .replace(/\s+(?:con|with)\s+.*$/i, '') // "Rocky Romero con Don Callis": el acompañante no cuenta
        .trim(),
    )
    .filter(isPersonName);
}

/** Personas de un lado escrito como texto. */
export function peopleFromText(side: string): Person[] {
  const text = side
    .replace(/\((?:con|with|w\/|acompañad[oa]s? (?:de|por))\s[^)]*\)/gi, '') // acompañantes
    .replace(/\(c\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Equipo con sus miembros entre paréntesis
  const team = text.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  const names = team ? splitNames(team[2]) : splitNames(text);
  return names.slice(0, MAX_PER_SIDE).map((name) => ({ name }));
}

/** Lados de un combate "A vs. B (vs. C…)" escrito como texto. Vacío si no tiene "vs.". */
export function sidesFromText(participants: string): MatchSide[] {
  const parts = participants.split(/\s+vs\.?\s+/i);
  if (parts.length < 2) return [];
  return parts.map((label) => ({ label: label.trim(), people: peopleFromText(label) }));
}
