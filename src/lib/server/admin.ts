import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '../supabase/server';

// ADMINISTRADORES: las cuentas cuyo email está en la variable ADMIN_EMAILS (separados por comas).
// Pueden revisar y publicar las storylines que propone la IA.

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Usuario con sesión (verificado) con su email, o null. */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (typeof claims?.sub !== 'string') return null;
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null };
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes(email!.toLowerCase());
}

/** El usuario si es administrador; si no, la respuesta 401/403 que hay que devolver. */
export async function requireAdmin(): Promise<{ userId: string } | { response: NextResponse }> {
  const user = await currentUser();
  if (!user) return { response: NextResponse.json({ error: 'Inicia sesión' }, { status: 401 }) };
  if (!isAdminEmail(user.email)) return { response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  return { userId: user.id };
}
