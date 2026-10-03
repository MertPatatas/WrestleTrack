// Datos del proyecto de Supabase (los añade la integración de Vercel).
// Se leen en el servidor al ejecutarse (no al compilar). La integración puede añadir un prefijo
// a los nombres (por ejemplo "session_SUPABASE_URL" o "NEXT_PUBLIC_session_SUPABASE_URL"),
// así que se busca cualquier variable que termine en el nombre esperado.
// El navegador recibe los datos públicos del layout (ver SettingsProvider).

export interface SupabasePublicConfig {
  url: string;
  key: string;
}

/**
 * Valor de una variable llamada exactamente así o terminada en "_<nombre>". Los nombres van por
 * orden de preferencia (el primero que exista gana, con o sin prefijo). Solo servidor.
 */
export function envBySuffix(...names: string[]): string | undefined {
  const keys = Object.keys(process.env);
  for (const name of names) {
    const exact = process.env[name]?.trim();
    if (exact) return exact;
    const key = keys.find((k) => k.endsWith(`_${name}`) && process.env[k]?.trim());
    if (key) return process.env[key]!.trim();
  }
  return undefined;
}

/** Solo en el servidor. null si Supabase no está configurado. */
export function supabaseEnv(): SupabasePublicConfig | null {
  const url = envBySuffix('SUPABASE_URL');
  const key = envBySuffix('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
  return url && key ? { url, key } : null;
}

/** Clave de servicio (secreta). Solo en el servidor. */
export function supabaseServiceKey(): string | undefined {
  return envBySuffix('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
}

/** Conexión a Postgres por el pooler (la adecuada para funciones serverless). Solo en el servidor. */
export function postgresUrl(): string | undefined {
  return envBySuffix('POSTGRES_URL', 'DATABASE_URL');
}
