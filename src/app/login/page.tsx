import { redirect } from 'next/navigation';
import { pageTitle } from '../../i18n/server';
import { currentUserId } from '../../lib/supabase/server';
import { supabaseConfigured } from '../../lib/supabase/env';
import { LoginView } from '../../views/LoginView';

export const generateMetadata = () => pageTitle('login.title');

function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  // Solo rutas internas (evita redirigir a otra web)
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (supabaseConfigured() && (await currentUserId())) redirect(next);
  return <LoginView next={next} error={typeof params.error === 'string' ? params.error : undefined} />;
}
