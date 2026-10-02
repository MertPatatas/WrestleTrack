import { NextResponse } from 'next/server';
import { translate } from '../../../../i18n/messages';
import { db, type ProfileRow, type SubscriptionRow } from '../../../../lib/server/db';
import { errorResponse, requireUser } from '../../../../lib/server/profile';
import { pushConfigured, sendToSubscriptions } from '../../../../lib/server/push';
import { profileLang } from '../../../../lib/server/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST: manda una notificación de prueba a todos los dispositivos del usuario
export async function POST() {
  const user = await requireUser();
  if ('response' in user) return user.response;
  if (!pushConfigured()) return NextResponse.json({ error: 'Notificaciones no configuradas' }, { status: 503 });

  try {
    const sql = await db();
    const subs = (await sql.query('select * from push_subscriptions where user_id = $1', [user.userId])) as SubscriptionRow[];
    if (subs.length === 0) return NextResponse.json({ error: 'Ningún dispositivo suscrito' }, { status: 404 });
    const profile = ((await sql.query('select * from profiles where user_id = $1', [user.userId])) as ProfileRow[])[0];
    const lang = profileLang(profile);
    const result = await sendToSubscriptions(subs, {
      title: translate(lang, 'push.testTitle'),
      body: translate(lang, 'push.testBody'),
      url: '/perfil',
      tag: 'test',
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
