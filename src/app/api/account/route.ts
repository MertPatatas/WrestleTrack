import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { db } from '../../../lib/server/db';
import { errorResponse, requireUser } from '../../../lib/server/profile';
import { SUPABASE_URL } from '../../../lib/supabase/env';
import { createClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE: elimina la cuenta del usuario con sesión y todos sus datos (derecho de supresión)
export async function DELETE() {
  const user = await requireUser();
  if ('response' in user) return user.response;

  try {
    const sql = await db();
    await sql.query('delete from app.push_subscriptions where user_id = $1', [user.userId]);
    await sql.query('delete from app.notification_log where user_id = $1', [user.userId]);
    await sql.query('delete from app.profiles where user_id = $1', [user.userId]);

    // La cuenta de Supabase Auth se borra con la clave de servicio (solo en el servidor)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
    if (serviceKey) {
      const admin = createAdminClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await admin.auth.admin.deleteUser(user.userId);
      if (error) throw error;
    } else {
      // Sin clave de servicio: directamente en la base de datos (el usuario postgres tiene permiso)
      await sql.query('delete from auth.users where id = $1', [user.userId]);
    }

    // Cierra la sesión en este navegador
    const supabase = await createClient();
    await supabase.auth.signOut().catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
