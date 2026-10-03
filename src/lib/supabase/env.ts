// Datos públicos del proyecto de Supabase (los añade la integración de Vercel).
// Se leen en el servidor al ejecutarse (no al compilar) y aceptan los distintos nombres que usa
// la integración según su versión. El navegador los recibe del layout (ver SettingsProvider).

export interface SupabasePublicConfig {
  url: string;
  key: string;
}

const env = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
};

/** Solo en el servidor. null si Supabase no está configurado. */
export function supabaseEnv(): SupabasePublicConfig | null {
  const url = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL');
  const key =
    env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
    env('NEXT_PUBLIC_SUPABASE_ANON_KEY') ??
    env('SUPABASE_PUBLISHABLE_KEY') ??
    env('SUPABASE_ANON_KEY');
  return url && key ? { url, key } : null;
}
