export function timeAgo(iso: string, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `Hace ${Math.max(mins, 1)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.round(hours / 24)} d`;
}

// Usa la zona horaria del dispositivo.
export function showDateParts(iso: string) {
  const d = new Date(iso);
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
    time: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
