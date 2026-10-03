'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabasePublicConfig } from './env';

let config: SupabasePublicConfig | null = null;
let client: SupabaseClient | null = null;

/** La llama SettingsProvider con los datos que le pasa el servidor. */
export function initSupabase(next: SupabasePublicConfig | null) {
  if (next?.url === config?.url && next?.key === config?.key) return;
  config = next;
  client = null;
}

export function supabaseReady(): boolean {
  return config !== null;
}

/** Cliente de Supabase para el navegador (comparte la sesión con el servidor mediante cookies). */
export function getSupabase(): SupabaseClient {
  if (!config) throw new Error('Supabase no está configurado');
  client ??= createBrowserClient(config.url, config.key);
  return client;
}
