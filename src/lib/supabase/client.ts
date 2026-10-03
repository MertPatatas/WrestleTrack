'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './env';

let client: SupabaseClient | null = null;

/** Cliente de Supabase para el navegador (comparte la sesión con el servidor mediante cookies). */
export function getSupabase(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
