import { NextResponse, type NextRequest } from 'next/server';
import { isLang, isValidTimeZone, sanitizeSettings, type UserSettings } from '../../../i18n/config';
import { sanitizePrefs, type NotificationPrefs } from '../../../lib/notifications/prefs';
import { db, type ProfileRow } from '../../../lib/server/db';
import { errorResponse, requireUser, rowToProfile } from '../../../lib/server/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: perfil del usuario ({ profile: null } si es la primera vez que inicia sesión)
export async function GET() {
  const user = await requireUser();
  if ('response' in user) return user.response;
  try {
    const sql = await db();
    const rows = (await sql.query('select * from profiles where user_id = $1', [user.userId])) as ProfileRow[];
    return NextResponse.json({ profile: rows[0] ? rowToProfile(rows[0]) : null });
  } catch (err) {
    return errorResponse(err);
  }
}

interface PutBody {
  settings?: Partial<UserSettings>;
  notifications?: Partial<NotificationPrefs>;
  device?: { timeZone?: string; language?: string; locale?: string };
}

// PUT: crea o actualiza el perfil. Solo cambia lo que llega en la petición.
export async function PUT(request: NextRequest) {
  const user = await requireUser();
  if ('response' in user) return user.response;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: 'Petición no válida' }, { status: 400 });
  }

  try {
    const sql = await db();
    const rows = (await sql.query('select * from profiles where user_id = $1', [user.userId])) as ProfileRow[];
    const current = rows[0] ? rowToProfile(rows[0]) : null;

    const settings = sanitizeSettings({ ...current?.settings, ...body.settings });
    const notifications = sanitizePrefs({ ...current?.notifications, ...body.notifications });
    const device = body.device ?? {};
    const deviceTz = device.timeZone && isValidTimeZone(device.timeZone) ? device.timeZone : null;
    const deviceLang = device.language && isLang(device.language) ? device.language : null;
    const deviceLocale = typeof device.locale === 'string' && device.locale.length <= 35 ? device.locale : null;

    const saved = (await sql.query(
      `insert into profiles (user_id, time_zone, language, favorites, device_time_zone, device_language, device_locale,
                             notify_kinds, notify_leads, notify_announce, digest, digest_hour, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       on conflict (user_id) do update set
         time_zone = excluded.time_zone,
         language = excluded.language,
         favorites = excluded.favorites,
         device_time_zone = coalesce(excluded.device_time_zone, profiles.device_time_zone),
         device_language = coalesce(excluded.device_language, profiles.device_language),
         device_locale = coalesce(excluded.device_locale, profiles.device_locale),
         notify_kinds = excluded.notify_kinds,
         notify_leads = excluded.notify_leads,
         notify_announce = excluded.notify_announce,
         digest = excluded.digest,
         digest_hour = excluded.digest_hour,
         updated_at = now()
       returning *`,
      [
        user.userId,
        settings.timeZone,
        settings.language,
        settings.favorites,
        deviceTz,
        deviceLang,
        deviceLocale,
        notifications.kinds,
        notifications.leads,
        notifications.announce,
        notifications.digest,
        notifications.digestHour,
      ],
    )) as ProfileRow[];

    return NextResponse.json({ profile: rowToProfile(saved[0]) });
  } catch (err) {
    return errorResponse(err);
  }
}
