import 'server-only';
import { NextResponse } from 'next/server';
import { sanitizeFavorites } from '../../i18n/config';
import { sanitizeDeviceSettings, type DeviceSettings } from '../notifications/device';
import { sanitizePrefs, type NotificationPrefs } from '../notifications/prefs';
import { db, NotConfiguredError, type DeviceRow } from './db';

/** Ajustes guardados de un dispositivo, en el formato común. */
export function rowToSettings(row: DeviceRow): DeviceSettings {
  return sanitizeDeviceSettings({
    timeZone: row.time_zone,
    language: row.language as DeviceSettings['language'],
    locale: row.locale,
    favorites: sanitizeFavorites(row.favorites),
    prefs: sanitizePrefs({
      kinds: row.notify_kinds as NotificationPrefs['kinds'],
      leads: row.notify_leads,
      announce: row.notify_announce,
      digest: row.digest as NotificationPrefs['digest'],
      digestHour: row.digest_hour,
    }),
  });
}

/** Dispositivo cuyo endpoint y clave coinciden (null si no existe o la clave no es la suya). */
export async function findDevice(endpoint: unknown, token: unknown): Promise<DeviceRow | null> {
  if (typeof endpoint !== 'string' || typeof token !== 'string') return null;
  const sql = await db();
  const rows = (await sql.query('select * from devices where endpoint = $1', [endpoint])) as DeviceRow[];
  const device = rows[0];
  return device && device.token === token ? device : null;
}

/** Guarda los ajustes de un dispositivo existente. */
export async function saveSettings(id: string, s: DeviceSettings): Promise<void> {
  const sql = await db();
  await sql.query(
    `update devices set time_zone = $2, language = $3, locale = $4, favorites = $5, notify_kinds = $6,
       notify_leads = $7, notify_announce = $8, digest = $9, digest_hour = $10, updated_at = now()
     where id = $1`,
    [id, s.timeZone, s.language, s.locale, s.favorites, s.prefs.kinds, s.prefs.leads, s.prefs.announce, s.prefs.digest, s.prefs.digestHour],
  );
}

export const notFound = () => NextResponse.json({ error: 'Dispositivo no registrado' }, { status: 404 });

/** Respuesta de error común para las rutas que usan la base de datos. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof NotConfiguredError) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }
  console.error('[api]', err);
  return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
}
