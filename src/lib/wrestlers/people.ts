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
  // Equipo con sus miembros entre paréntesis; lo que va antes del equipo también cuenta
  // ("Ricky Saints y War Raiders (Ivar y Erik)" → Ricky Saints, Ivar, Erik)
  const team = text.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  // (antes del equipo solo se separa por comas, "&" o " y ": "Hank And Tank" es un nombre de equipo)
  const before = team ? team[1].split(/\s*(?:,|&|\s+y\s+)\s*/).map((n) => n.trim()).filter(isPersonName) : [];
  const names = team ? [...before.slice(0, -1), ...splitNames(team[2])] : splitNames(text);
  return names.slice(0, MAX_PER_SIDE).map((name) => ({ name }));
}

// "A venció a B…", "A y B vencieron a C…", "A defeated B by pinfall"
const RESULT_SENTENCE =
  /^(.+?)\s+(?:vencieron|venció|vencio|derrotaron|derrotó|derroto|se impusieron a|se impuso a|defeated|def\.|beat)\s+(?:a\s+)?(.+?)(?:\s+(?:en|para|por|con|tras|mediante|gracias|y\s+(?:retuvo|retuvieron|ganó|ganaron|se)|by|to|in|via|after|and\s+(?:won|retained))\b.*)?\.?$/i;

/**
 * Lados de un resultado: "A vs. B" o una frase "A venció a B en…" (ganador / perdedores).
 * Vacío si no se reconoce.
 */
export function sidesFromResult(text: string): MatchSide[] {
  const clean = text.replace(/\*\*/g, '').trim();
  if (/\svs\.?\s/i.test(clean)) return sidesFromText(clean);
  const m = clean.match(RESULT_SENTENCE);
  if (!m) return [];
  const sides = [m[1], m[2]].map((label) => ({ label: label.trim(), people: peopleFromText(label) }));
  return sides.every((s) => s.people.length) ? sides : [];
}

/** Lados de un combate "A vs. B (vs. C…)" escrito como texto. Vacío si no tiene "vs.". */
export function sidesFromText(participants: string): MatchSide[] {
  const parts = participants.split(/\s+vs\.?\s+/i);
  if (parts.length < 2) return [];
  return parts.map((label) => ({ label: label.trim(), people: peopleFromText(label) }));
}
