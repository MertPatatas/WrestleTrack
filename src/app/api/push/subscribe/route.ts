import { NextResponse, type NextRequest } from 'next/server';
import { db } from '../../../../lib/server/db';
import { errorResponse, requireUser } from '../../../../lib/server/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubscriptionBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

// POST: guarda la suscripción de este dispositivo para el usuario con sesión
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if ('response' in user) return user.response;
  const body = (await request.json().catch(() => ({}))) as SubscriptionBody;
  if (
    typeof body.endpoint !== 'string' ||
    !/^https:\/\//.test(body.endpoint) ||
    body.endpoint.length > 1000 ||
    typeof body.keys?.p256dh !== 'string' ||
    typeof body.keys?.auth !== 'string'
  ) {
    return NextResponse.json({ error: 'Suscripción no válida' }, { status: 400 });
  }

  try {
    const sql = await db();
    // Si el dispositivo estaba asociado a otra cuenta, pasa a la actual
    await sql.query(
      `insert into app.push_subscriptions (endpoint, user_id, p256dh, auth) values ($1, $2, $3, $4)
       on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      [body.endpoint, user.userId, body.keys.p256dh, body.keys.auth],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE: deja de enviar notificaciones a este dispositivo
export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if ('response' in user) return user.response;
  const body = (await request.json().catch(() => ({}))) as SubscriptionBody;
  if (typeof body.endpoint !== 'string') return NextResponse.json({ error: 'Falta endpoint' }, { status: 400 });

  try {
    const sql = await db();
    await sql.query('delete from app.push_subscriptions where endpoint = $1 and user_id = $2', [body.endpoint, user.userId]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
