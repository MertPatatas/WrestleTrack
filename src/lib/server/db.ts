import 'server-only';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Base de datos Postgres (Neon). La integración de Vercel crea la variable DATABASE_URL.

let client: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

export class NotConfiguredError extends Error {}

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function sql(): NeonQueryFunction<false, false> {
  if (!process.env.DATABASE_URL) throw new NotConfiguredError('Falta DATABASE_URL (base de datos no configurada)');
  client ??= neon(process.env.DATABASE_URL);
  return client;
}

// Tablas de la app. Se crean solas la primera vez (todas las sentencias son idempotentes).
const SCHEMA = [
  `create table if not exists profiles (
     user_id          text primary key,                 -- id de usuario de Clerk
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
  `create table if not exists push_subscriptions (
     endpoint   text primary key,                       -- dirección única del dispositivo
     user_id    text not null,
     p256dh     text not null,
     auth       text not null,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id)`,
  // Un aviso enviado por usuario y clave ("r:<show>:<min>", "a:<evento>", "d:<día>"): evita repetirlos
  `create table if not exists notification_log (
     user_id text not null,
     key     text not null,
     sent_at timestamptz not null default now(),
     primary key (user_id, key)
   )`,
  // Eventos especiales ya vistos: para detectar los recién anunciados
  `create table if not exists seen_events (
     key        text primary key,
     first_seen timestamptz not null default now()
   )`,
];

/** Cliente SQL con las tablas ya creadas. */
export async function db(): Promise<NeonQueryFunction<false, false>> {
  const q = sql();
  schemaReady ??= (async () => {
    for (const statement of SCHEMA) await q.query(statement);
  })().catch((err) => {
    schemaReady = null; // se reintenta en la siguiente petición
    throw err;
  });
  await schemaReady;
  return q;
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
