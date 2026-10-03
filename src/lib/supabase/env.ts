// Datos públicos del proyecto de Supabase (los añade la integración de Vercel).
// Según la versión de la integración la clave pública se llama "publishable" o "anon".
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
