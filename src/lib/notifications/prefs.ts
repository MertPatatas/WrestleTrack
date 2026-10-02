// Preferencias de notificaciones del usuario (se guardan en la base de datos con su cuenta).

export type NotifyKinds = 'all' | 'weekly' | 'special';
export type DigestMode = 'off' | 'daily' | 'weekly';

export interface NotificationPrefs {
  kinds: NotifyKinds; // todos, solo shows semanales o solo PPV/PLE
  leads: number[]; // recordatorios: minutos antes del inicio (0 = al empezar); vacío = sin recordatorios
  announce: boolean; // aviso cuando se anuncia un PPV/PLE nuevo
  digest: DigestMode; // resumen de los próximos shows
  digestHour: number; // hora local del resumen (0-23); el semanal sale los lunes
}

// Recordatorios que se pueden elegir
export const LEAD_OPTIONS = [0, 15, 60, 180, 1440] as const;

export const DEFAULT_PREFS: NotificationPrefs = {
  kinds: 'special',
  leads: [60],
  announce: true,
  digest: 'off',
  digestHour: 10,
};

/** Normaliza lo que llega de la base de datos o de una petición. */
export function sanitizePrefs(input: Partial<NotificationPrefs> | null | undefined, base = DEFAULT_PREFS): NotificationPrefs {
  const v = input ?? {};
  return {
    kinds: v.kinds === 'all' || v.kinds === 'weekly' || v.kinds === 'special' ? v.kinds : base.kinds,
    leads: Array.isArray(v.leads)
      ? [...new Set(v.leads.map(Number).filter((n) => (LEAD_OPTIONS as readonly number[]).includes(n)))].sort((a, b) => a - b)
      : base.leads,
    announce: typeof v.announce === 'boolean' ? v.announce : base.announce,
    digest: v.digest === 'off' || v.digest === 'daily' || v.digest === 'weekly' ? v.digest : base.digest,
    digestHour:
      Number.isInteger(v.digestHour) && (v.digestHour as number) >= 0 && (v.digestHour as number) <= 23
        ? (v.digestHour as number)
        : base.digestHour,
  };
}
