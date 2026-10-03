import 'server-only';
import postgres from 'postgres';
import { postgresUrl } from '../supabase/env';

// Base de datos Postgres de Supabase. La integración de Vercel crea POSTGRES_URL (conexión
// por el "pooler", la adecuada para funciones serverless).
//
// Las tablas viven en el esquema "app", que la API pública de Supabase no expone, y además
// tienen RLS activado sin políticas: solo el servidor (usuario postgres) puede leerlas.

let client: postgres.Sql | null = null;
let schemaReady: Promise<void> | null = null;

export class NotConfiguredError extends Error {}

// Acepta el prefijo que añada la integración (p. ej. "session_POSTGRES_URL")
const connectionString = () => postgresUrl();

export function dbConfigured(): boolean {
  return Boolean(connectionString());
}

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

/**
 * La dirección de la integración trae parámetros como "?sslmode=require&supa=base-pooler.x".
 * La librería postgres envía cualquier parámetro desconocido al servidor como ajuste de sesión
 * y Postgres rechaza la conexión, así que se quitan todos y el SSL se configura aparte.
 */
function cleanConnection(raw: string): { url: string; ssl: 'require' | false } {
  try {
    const u = new URL(raw);
    const mode = u.searchParams.get('sslmode');
    u.search = '';
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    return { url: u.toString(), ssl: mode === 'disable' || (local && !mode) ? false : 'require' };
  } catch {
    return { url: raw, ssl: 'require' };
  }
}

function sql(): postgres.Sql {
  const raw = connectionString();
  if (!raw) throw new NotConfiguredError('Falta POSTGRES_URL (base de datos no configurada)');
  if (!client) {
    const { url, ssl } = cleanConnection(raw);
    // prepare: false es obligatorio con el pooler en modo transacción
    client = postgres(url, { ssl, prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });
  }
  return client;
}

const SCHEMA = [
  `create schema if not exists app`,
  `create table if not exists app.profiles (
     user_id          uuid primary key,                 -- id del usuario de Supabase Auth
     time_zone        text not null default 'auto',
     language         text not null default 'auto',
     favorites        text[] not null default '{wwe,aew,cmll,aaa,njpw}',
     device_time_zone text,                             -- para resolver 'auto' al enviar avisos
     device_language  text,
     device_locale    text,
     notify_kinds     text not null default 'special',
     notify_leads     int[] not null default '{60}',
     notify_announce  boolean not null default true,
     digest           text not null default 'off',
     digest_hour      int not null default 10,
     created_at       timestamptz not null default now(),
     updated_at       timestamptz not null default now()
   )`,
  `create table if not exists app.push_subscriptions (
     endpoint   text primary key,                       -- dirección push única del dispositivo
     user_id    uuid not null,
     p256dh     text not null,
     auth       text not null,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists push_subscriptions_user_idx on app.push_subscriptions (user_id)`,
  // Un aviso enviado por usuario y clave ("r:<show>:<min>", "a:<evento>", "d:<día>"): evita repetirlos
  `create table if not exists app.notification_log (
     user_id uuid not null,
     key     text not null,
     sent_at timestamptz not null default now(),
     primary key (user_id, key)
   )`,
  // Eventos especiales ya vistos: para detectar los recién anunciados
  `create table if not exists app.seen_events (
     key        text primary key,
     first_seen timestamptz not null default now()
   )`,
  `alter table app.profiles enable row level security`,
  `alter table app.push_subscriptions enable row level security`,
  `alter table app.notification_log enable row level security`,
  `alter table app.seen_events enable row level security`,
];

/** Cliente SQL con las tablas ya creadas. */
export async function db(): Promise<Db> {
  const q = sql();
  schemaReady ??= (async () => {
    for (const statement of SCHEMA) await q.unsafe(statement);
  })().catch((err) => {
    schemaReady = null; // se reintenta en la siguiente petición
    throw err;
  });
  await schemaReady;
  return {
    query: async <T,>(text: string, params: unknown[] = []) =>
      (await q.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[],
  };
}

export interface ProfileRow {
  user_id: string;
  time_zone: string;
  language: string;
  favorites: string[];
  device_time_zone: string | null;
  device_language: string | null;
  device_locale: string | null;
  notify_kinds: string;
  notify_leads: number[];
  notify_announce: boolean;
  digest: string;
  digest_hour: number;
}

export interface SubscriptionRow {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
}
