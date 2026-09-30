-- Esquema inicial para WrestleTrack (Supabase / Postgres).
-- Lectura pública; la escritura la hacen solo las tareas de ingesta (service role).

create table promotions (
  id   text primary key,          -- 'wwe', 'aew', 'cmll', 'aaa', 'njpw', 'other'
  name text not null
);

create table events (
  id           uuid primary key default gen_random_uuid(),
  promotion_id text not null references promotions(id),
  name         text not null,
  kind         text not null check (kind in ('weekly', 'ple', 'other')),
  starts_at    timestamptz not null,   -- siempre UTC; la app convierte a la zona del usuario
  venue        text,
  broadcast    text,                   -- cadena o plataforma
  source_url   text,
  unique (promotion_id, name, starts_at)
);

create table news_items (
  id           uuid primary key default gen_random_uuid(),
  promotion_id text not null references promotions(id),  -- 'other' para noticias generales
  title        text not null,
  excerpt      text,
  source       text not null,
  url          text not null unique,
  published_at timestamptz not null
);

create table storylines (
  id           uuid primary key default gen_random_uuid(),
  promotion_id text not null references promotions(id),
  title        text not null,
  subtitle     text,
  status       text not null default 'en_curso' check (status in ('en_curso', 'cerrada'))
);

-- Una fila por show y storyline: permite decir "avanzó" o "sin avance".
create table storyline_updates (
  id           uuid primary key default gen_random_uuid(),
  storyline_id uuid not null references storylines(id) on delete cascade,
  event_id     uuid references events(id),
  advanced     boolean not null,
  summary      text not null,
  sources      text[] not null default '{}',   -- URLs en las que se basa el resumen
  generated_by text,                           -- modelo usado, para trazabilidad
  created_at   timestamptz not null default now()
);

alter table promotions        enable row level security;
alter table events            enable row level security;
alter table news_items        enable row level security;
alter table storylines        enable row level security;
alter table storyline_updates enable row level security;

create policy "lectura publica" on promotions        for select using (true);
create policy "lectura publica" on events            for select using (true);
create policy "lectura publica" on news_items        for select using (true);
create policy "lectura publica" on storylines        for select using (true);
create policy "lectura publica" on storyline_updates for select using (true);
