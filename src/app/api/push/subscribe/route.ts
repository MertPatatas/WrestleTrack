import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeDeviceSettings, type DeviceSettings } from '../../../../lib/notifications/device';
import { db } from '../../../../lib/server/db';
import { errorResponse, findDevice, notFound } from '../../../../lib/server/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubscribeBody {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  settings?: Partial<DeviceSettings>;
}

// POST: registra este dispositivo (o lo vuelve a registrar) con sus ajustes.
// Devuelve una clave que el navegador guarda para cambiar luego sus preferencias.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SubscribeBody;
  const sub = body.subscription;
  if (
    typeof sub?.endpoint !== 'string' ||
    !/^https:\/\//.test(sub.endpoint) ||
    sub.endpoint.length > 1000 ||
    typeof sub.keys?.p256dh !== 'string' ||
    typeof sub.keys?.auth !== 'string'
  ) {
    return NextResponse.json({ error: 'Suscripción no válida' }, { status: 400 });
  }
  const s = sanitizeDeviceSettings(body.settings);
  const token = randomBytes(24).toString('base64url');

  try {
    const sql = await db();
    // El endpoint solo lo conoce el propio navegador: si ya existía, se renueva la clave
    await sql.query(
      `insert into devices (endpoint, p256dh, auth, token, time_zone, language, locale, favorites,
                            notify_kinds, notify_leads, notify_announce, digest, digest_hour)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       on conflict (endpoint) do update set
         p256dh = excluded.p256dh, auth = excluded.auth, token = excluded.token,
         time_zone = excluded.time_zone, language = excluded.language, locale = excluded.locale,
         favorites = excluded.favorites, notify_kinds = excluded.notify_kinds, notify_leads = excluded.notify_leads,
         notify_announce = excluded.notify_announce, digest = excluded.digest, digest_hour = excluded.digest_hour,
         updated_at = now()`,
      [
        sub.endpoint,
        sub.keys.p256dh,
        sub.keys.auth,
        token,
        s.timeZone,
        s.language,
        s.locale,
        s.favorites,
        s.prefs.kinds,
        s.prefs.leads,
        s.prefs.announce,
        s.prefs.digest,
        s.prefs.digestHour,
      ],
    );
    return NextResponse.json({ token });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE: deja de enviar notificaciones a este dispositivo y borra sus datos
export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string; token?: string };
  try {
    const device = await findDevice(body.endpoint, body.token);
    if (!device) return notFound();
    const sql = await db();
    await sql.query('delete from devices where id = $1', [device.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
