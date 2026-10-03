import 'server-only';
import { NextResponse } from 'next/server';
import { sanitizeSettings, type UserSettings } from '../../i18n/config';
import { sanitizePrefs, type NotificationPrefs } from '../notifications/prefs';
import { currentUserId } from '../supabase/server';
import { NotConfiguredError, type ProfileRow } from './db';

/** Perfil tal como lo recibe el navegador. */
export interface ProfileDTO {
  settings: UserSettings;
  notifications: NotificationPrefs;
}

export function rowPrefs(row: ProfileRow): NotificationPrefs {
  return sanitizePrefs({
    kinds: row.notify_kinds as NotificationPrefs['kinds'],
    leads: row.notify_leads,
    announce: row.notify_announce,
    digest: row.digest as NotificationPrefs['digest'],
    digestHour: row.digest_hour,
  });
}

export function rowToProfile(row: ProfileRow): ProfileDTO {
  return {
    settings: sanitizeSettings({
      timeZone: row.time_zone,
      language: row.language as UserSettings['language'],
      favorites: row.favorites as UserSettings['favorites'],
    }),
    notifications: rowPrefs(row),
  };
}

/** Id del usuario con sesión iniciada, o una respuesta 401 si no la hay. */
export async function requireUser(): Promise<{ userId: string } | { response: NextResponse }> {
  const userId = await currentUserId();
  if (!userId) return { response: NextResponse.json({ error: 'Inicia sesión' }, { status: 401 }) };
  return { userId };
}

/** Respuesta de error común para las rutas que usan la base de datos. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof NotConfiguredError) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }
  console.error('[api]', err);
  // Motivo resumido para poder diagnosticar (sin direcciones de conexión, que llevan la contraseña)
  const reason = (err instanceof Error ? err.message : String(err)).replace(/postgres(ql)?:\/\/\S+/g, '[url]').slice(0, 200);
  return NextResponse.json({ error: `Error del servidor (${reason})` }, { status: 500 });
}
