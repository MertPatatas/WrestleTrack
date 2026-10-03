import { NextResponse, type NextRequest } from 'next/server';
import { db, dbConfigured } from '../../../lib/server/db';
import { pushConfigured } from '../../../lib/server/push';
import { supabaseEnv, supabaseServiceKey } from '../../../lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Diagnóstico de la configuración (solo con "Authorization: Bearer <CRON_SECRET>").
// No devuelve valores secretos, solo si cada pieza está configurada y si la base de datos responde.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let database: { ok: boolean; users?: number; devices?: number; error?: string } = { ok: false };
  if (dbConfigured()) {
    try {
      const sql = await db();
      const [counts] = await sql.query<{ users: number; devices: number }>(
        'select (select count(*)::int from app.profiles) as users, (select count(*)::int from app.push_subscriptions) as devices',
      );
      database = { ok: true, ...counts };
    } catch (err) {
      // Mensaje del error sin la dirección de conexión (podría llevar la contraseña)
      database = { ok: false, error: (err instanceof Error ? err.message : String(err)).replace(/postgres(ql)?:\/\/\S+/g, '[url]') };
    }
  } else {
    database = { ok: false, error: 'sin POSTGRES_URL' };
  }

  return NextResponse.json({
    supabase: Boolean(supabaseEnv()),
    serviceKey: Boolean(supabaseServiceKey()),
    database,
    push: pushConfigured(),
    qstash: Boolean(process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY),
  });
}
