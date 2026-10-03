import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from './env';

/** Cliente de Supabase para el servidor, con la sesión del usuario (cookies). null si no está configurado. */
export async function createClient() {
  const cfg = supabaseEnv();
  if (!cfg) return null;
  const cookieStore = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy ya renueva la sesión
        }
      },
    },
  });
}

/** Id del usuario con sesión iniciada (verificado), o null. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === 'string' ? data.claims.sub : null;
}
