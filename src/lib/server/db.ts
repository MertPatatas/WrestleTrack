import 'server-only';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Base de datos Postgres (Neon). La integración de Vercel crea la variable DATABASE_URL.
// No hay cuentas de usuario: cada dispositivo con las notificaciones activadas guarda sus preferencias.

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
  `create table if not exists devices (
     id              bigserial primary key,
     endpoint        text not null unique,             -- dirección push única del dispositivo
     p256dh          text not null,
     auth            text not null,
     token           text not null,                    -- clave del dispositivo para cambiar sus preferencias
     time_zone       text not null default 'Europe/Madrid',
     language        text not null default 'es',
     locale          text not null default 'es-ES',
     favorites       text[] not null default '{wwe,aew,cmll,aaa,njpw}',
     notify_kinds    text not null default 'special',
     notify_leads    int[] not null default '{60}',
     notify_announce boolean not null default true,
     digest          text not null default 'off',
     digest_hour     int not null default 10,
     created_at      timestamptz not null default now(),
     updated_at      timestamptz not null default now()
   )`,
  // Un aviso enviado por dispositivo y clave ("r:<show>:<min>", "a:<evento>", "d:<día>"): evita repetirlos
  `create table if not exists device_notifications (
     device_id bigint not null references devices (id) on delete cascade,
     key       text not null,
     sent_at   timestamptz not null default now(),
     primary key (device_id, key)
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

export interface DeviceRow {
  id: string; // bigserial llega como texto
  endpoint: string;
  p256dh: string;
  auth: string;
  token: string;
  time_zone: string;
  language: string;
  locale: string;
  favorites: string[];
  notify_kinds: string;
  notify_leads: number[];
  notify_announce: boolean;
  digest: string;
  digest_hour: number;
}
