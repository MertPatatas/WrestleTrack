import { NextResponse, type NextRequest } from 'next/server';
import { isLang } from '../../../../i18n/config';
import { translate } from '../../../../i18n/messages';
import { db, type ProfileRow, type SubscriptionRow } from '../../../../lib/server/db';
import { errorResponse, requireUser } from '../../../../lib/server/profile';
import { pushConfigured, sendToSubscriptions } from '../../../../lib/server/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST: manda una notificación de prueba a este dispositivo (o a todos los del usuario si no se indica)
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if ('response' in user) return user.response;
  if (!pushConfigured()) return NextResponse.json({ error: 'Notificaciones no configuradas' }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };

  try {
    const sql = await db();
    let subs = await sql.query<SubscriptionRow>('select * from app.push_subscriptions where user_id = $1', [user.userId]);
    if (typeof body.endpoint === 'string') subs = subs.filter((s) => s.endpoint === body.endpoint);
    if (subs.length === 0) return NextResponse.json({ error: 'Dispositivo no registrado' }, { status: 404 });

    const profile = (await sql.query<ProfileRow>('select * from app.profiles where user_id = $1', [user.userId]))[0];
    const lang = isLang(profile?.language) ? profile.language : isLang(profile?.device_language) ? profile.device_language : 'es';
    const result = await sendToSubscriptions(subs, {
      title: translate(lang, 'push.testTitle'),
      body: translate(lang, 'push.testBody'),
      url: '/perfil',
      tag: 'test',
    });
    // Si el servicio de push la rechaza, se devuelve el motivo para mostrarlo
    if (result.sent === 0) return NextResponse.json({ error: result.errors[0] ?? 'No se pudo enviar' }, { status: 502 });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
