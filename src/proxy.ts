import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from './lib/supabase/env';

// Rutas que se pueden usar sin iniciar sesión
const PUBLIC_PATHS = [
  /^\/login(\/|$)/,
  /^\/(privacidad|condiciones)$/, // textos legales (Google los revisa sin sesión)
  /^\/google[0-9a-z]+\.html$/, // archivo de verificación de Google Search Console
  /^\/auth\//, // vuelta del inicio de sesión (Google y enlace del email)
  /^\/api\/push\/dispatch$/, // la llama Upstash QStash (con firma propia)
  /^\/api\/schedule$/, // datos públicos; los usa la revisión de avisos
];

// Supabase: renueva la sesión en cada petición y exige iniciar sesión para usar la app.
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
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (signedIn || PUBLIC_PATHS.some((p) => p.test(path))) return response;

  if (path.startsWith('/api/')) {
    return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  }
  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = path === '/' ? '' : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
  const redirect = NextResponse.redirect(login);
  // Se conservan las cookies de sesión que haya podido renovar Supabase
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  matcher: [
    // Todo menos los archivos internos de Next y los estáticos (sw.js, iconos, manifest...)
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
