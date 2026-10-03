import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

// Vuelta del inicio de sesión con Google o con el enlace del email: Supabase envía un código
// de un solo uso que se cambia aquí por la sesión (cookies).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  const fail = (reason: string) => {
    const login = new URL('/login', url.origin);
    login.searchParams.set('error', reason);
    if (next !== '/') login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  };

  // Error devuelto por Supabase o por Google (p. ej. el usuario canceló)
  if (url.searchParams.get('error')) return fail('provider');
  if (!code) return fail('missing');

  const supabase = await createClient();
  if (!supabase) return fail('missing');
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Lo más habitual: el enlace del email se abrió en otro navegador o app
    return fail(/verifier/i.test(error.message) ? 'other-browser' : 'expired');
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
