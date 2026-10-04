import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from './lib/supabase/env';

// Supabase: renueva la sesión en cada petición. La app se puede navegar sin cuenta; iniciar sesión
// es opcional (botón de arriba a la derecha o el perfil). La API no se bloquea aquí: las rutas que
// necesitan cuenta (perfil, notificaciones, cuenta) lo comprueban ellas mismas.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cfg = supabaseEnv();
  if (!cfg) return response; // sin Supabase configurado, la app funciona sin inicio de sesión

  const supabase = createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Importante: nada entre crear el cliente y getClaims() (renueva el token si hace falta)
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    // Todo menos los archivos internos de Next y los estáticos (sw.js, iconos, manifest...)
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|brand/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
