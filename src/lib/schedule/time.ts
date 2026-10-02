// Conversión entre hora local de una zona horaria (IANA) y UTC, sin librerías.
// Los cambios de horario de verano los resuelve Intl.

export const DAY_MS = 24 * 3600_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallParts(utcMs: number, timeZone: string): Record<string, number> {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, fmt);
  }
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(new Date(utcMs))) parts[p.type] = Number(p.value);
  return parts;
}

// Diferencia (ms) entre la hora local de timeZone y UTC en ese instante
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const p = wallParts(utcMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** '2026-10-10' + '18:00' en 'America/New_York' → instante UTC (ms), con horario de verano incluido. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  let utc = wall - zoneOffsetMs(wall, timeZone);
  // Segunda pasada por si entre medias cambia el horario de verano
  const offset = zoneOffsetMs(utc, timeZone);
  if (wall - offset !== utc) utc = wall - offset;
  return utc;
}

/** Instante UTC → fecha 'YYYY-MM-DD' y hora 'HH:MM' locales en timeZone. */
export function utcToZoned(utcMs: number, timeZone: string): { date: string; time: string } {
  const p = wallParts(utcMs, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Diferencia en días entre dos fechas 'YYYY-MM-DD'. */
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
