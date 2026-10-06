import 'server-only';
import type { Person, WrestlerPhoto } from '../../data/types';
import { normalize } from '../recaps/match';
import { api as wikiApi } from '../schedule/sources/wikipedia';
import { db, dbConfigured } from '../server/db';
import { supabaseEnv, supabaseServiceKey } from '../supabase/env';
import { personKey } from './people';

// FOTOS DE LUCHADORES, siempre con licencia libre (o subidas por un administrador):
//   1. La foto principal de su artículo de Wikipedia (Wikimedia Commons). Si la cartelera viene de
//      Wikipedia se conoce el artículo exacto; si no, se busca y solo se acepta si su descripción
//      corta dice que es luchador ("American professional wrestler"...).
//   2. Si no hay, la mejor de Openverse (Flickr, Wikimedia…), solo si el título lleva su nombre.
//   3. Un administrador puede elegir otra, subir una propia o dejarle sin foto (queda fijada).
// Se guarda todo (también "no hay foto") para no repetir búsquedas: 30 días si hay foto, 7 si no.

const UA = 'WrestleTrack/0.1 (calendario de lucha libre; https://github.com/MertPatatas/WrestleTrack)';
const DAY_MS = 86_400_000;
const FRESH_FOUND_MS = 30 * DAY_MS;
const FRESH_MISSING_MS = 7 * DAY_MS;
const THUMB = 400;
const COMMONS_THUMB = 500; // tamaño estándar de miniatura de Wikimedia
// Direcciones mal formadas de la primera versión (parámetros en el nombre, miniaturas de 400 px)
const BROKEN_URL = /\?utm_.*\/\d+px-|\/thumb\/.*\/400px-/;
const WRESTLING = /wrestl|luchador|lucha libre|valet|manager|promoter|commentator|referee|tag team|stable/i;
const BUCKET = 'wrestlers';

export interface WrestlerRow {
  key: string;
  name: string;
  wiki: string | null;
  photo: WrestlerPhoto | null;
  locked: boolean;
  checked_at: Date;
}

// ---------------------------------------------------------------- Almacén (base de datos o memoria)

const memory = new Map<string, WrestlerRow>();
const parsePhoto = (p: unknown): WrestlerPhoto | null => (typeof p === 'string' ? JSON.parse(p) : (p as WrestlerPhoto | null));

async function loadRows(keys: string[]): Promise<Map<string, WrestlerRow>> {
  if (!keys.length) return new Map();
  if (!dbConfigured()) return new Map(keys.filter((k) => memory.has(k)).map((k) => [k, memory.get(k)!]));
  const rows = await (await db()).query<WrestlerRow>('select * from app.wrestlers where key = any($1::text[])', [keys]);
  return new Map(rows.map((r) => [r.key, { ...r, photo: parsePhoto(r.photo) }]));
}

export async function saveRow(row: Omit<WrestlerRow, 'checked_at'>): Promise<void> {
  if (!dbConfigured()) {
    memory.set(row.key, { ...row, checked_at: new Date() });
    return;
  }
  await (await db()).query(
    `insert into app.wrestlers (key, name, wiki, photo, locked, checked_at, seen_at)
     values ($1, $2, $3, $4::text::jsonb, $5, now(), now())
     on conflict (key) do update set name = excluded.name, wiki = coalesce(excluded.wiki, app.wrestlers.wiki),
       photo = excluded.photo, locked = excluded.locked, checked_at = now(), seen_at = now()`,
    [row.key, row.name, row.wiki, row.photo ? JSON.stringify(row.photo) : null, row.locked],
  );
}

async function touch(keys: string[]): Promise<void> {
  if (keys.length && dbConfigured()) {
    await (await db()).query('update app.wrestlers set seen_at = now() where key = any($1::text[])', [keys]).catch(() => undefined);
  }
}

// ---------------------------------------------------------------- Wikipedia / Wikimedia Commons

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

interface PageInfo {
  title: string;
  image?: string; // nombre del archivo
  description?: string;
}

/** Foto principal y descripción corta de unos artículos (por título exacto). */
async function pageInfo(titles: string[]): Promise<Map<string, PageInfo>> {
  const out = new Map<string, PageInfo>();
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const json = await wikiApi({ action: 'query', prop: 'pageimages|description', piprop: 'name', redirects: '1', titles: batch.join('|') });
    // Redirecciones y normalizaciones: el título pedido → el definitivo
    const alias = new Map<string, string>();
    for (const n of [...(json.query?.normalized ?? []), ...(json.query?.redirects ?? [])]) alias.set(n.from, n.to);
    const pages = new Map<string, PageInfo>();
    for (const p of json.query?.pages ?? []) {
      if (!p.missing) pages.set(p.title, { title: p.title, image: p.pageimage, description: p.description });
    }
    for (const t of batch) {
      let final = t;
      for (let hop = 0; hop < 3 && alias.has(final); hop++) final = alias.get(final)!;
      const page = pages.get(final);
      if (page) out.set(t, page);
    }
  }
  return out;
}

/** Miniatura, autor y licencia de unos archivos de Commons. */
async function fileInfo(files: string[]): Promise<Map<string, WrestlerPhoto>> {
  const out = new Map<string, WrestlerPhoto>();
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const json = await wikiApi({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(COMMONS_THUMB),
      titles: batch.map((f) => `File:${f}`).join('|'),
    });
    const alias = new Map<string, string>();
    for (const n of json.query?.normalized ?? []) alias.set(n.to, n.from);
    for (const p of json.query?.pages ?? []) {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl && !info?.url) continue;
      const meta = info.extmetadata ?? {};
      const file = (alias.get(p.title) ?? p.title).replace(/^File:/, '');
      out.set(file.replace(/ /g, '_'), {
        url: info.thumburl ?? info.url,
        source: 'wikipedia',
        credit: meta.Artist?.value ? stripHtml(meta.Artist.value).slice(0, 120) : undefined,
        creditUrl: info.descriptionurl,
        license: meta.LicenseShortName?.value ? stripHtml(meta.LicenseShortName.value) : undefined,
        licenseUrl: meta.LicenseUrl?.value,
        focusX: 50,
        focusY: 25,
      });
    }
  }
  return out;
}

/** Artículo de Wikipedia de un luchador por su nombre, solo si es claramente él. */
async function findArticle(name: string): Promise<string | null> {
  const json = await wikiApi({ action: 'query', list: 'search', srsearch: `${name} wrestler`, srlimit: '6' });
  const want = normalize(name);
  const titles: string[] = (json.query?.search ?? []).map((r: { title: string }) => r.title);
  // Mismo nombre (sin la aclaración entre paréntesis); primero los "(wrestler)"
  const same = titles
    .filter((t) => normalize(t.replace(/\s*\([^)]*\)\s*$/, '')) === want)
    .sort((a, b) => Number(!/\(wrestler\)/i.test(a)) - Number(!/\(wrestler\)/i.test(b)));
  if (!same.length) return null;
  const info = await pageInfo(same);
  return same.find((t) => WRESTLING.test(info.get(t)?.description ?? '')) ?? null;
}

// ---------------------------------------------------------------- Openverse

interface OpenverseImage {
  id: string;
  title?: string;
  url: string;
  thumbnail?: string;
  creator?: string;
  license: string;
  license_version?: string;
  license_url?: string;
  foreign_landing_url?: string;
  source?: string;
  width?: number;
  height?: number;
}

const licenseLabel = (img: OpenverseImage) =>
  img.license === 'cc0' ? 'CC0' : img.license === 'pdm' ? 'Dominio público' : `CC ${img.license.toUpperCase()} ${img.license_version ?? ''}`.trim();

/**
 * URL de tamaño razonable: miniatura de Commons, tamaño medio de Flickr o la de Openverse.
 * Wikimedia solo sirve miniaturas de tamaños estándar (250, 330, 500, 960…): se pide la de 500 px.
 */
function displayUrl(img: OpenverseImage): string {
  const commons = img.url.split('?')[0].match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(\w\/\w\w)\/([^/]+)$/);
  if (commons) {
    if (/\.svg$/i.test(commons[2]) || (img.width !== undefined && img.width <= COMMONS_THUMB)) return img.url.split('?')[0];
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${commons[1]}/${commons[2]}/${COMMONS_THUMB}px-${commons[2]}`;
  }
  if (/staticflickr\.com/.test(img.url) && !/_o\.\w+$/.test(img.url)) return img.url.replace(/_[bchk]\.(jpe?g|png)$/i, '_z.$1');
  return img.thumbnail ?? img.url;
}

export function openversePhoto(img: OpenverseImage): WrestlerPhoto {
  return {
    url: displayUrl(img),
    source: 'openverse',
    credit: img.creator?.slice(0, 120),
    creditUrl: img.foreign_landing_url,
    license: licenseLabel(img),
    licenseUrl: img.license_url,
    focusX: 50,
    focusY: 25,
  };
}

/** Fotos con licencia libre que mencionan el nombre (para elegir en la administración). */
export async function openverseSearch(name: string, limit = 12): Promise<(WrestlerPhoto & { title: string })[]> {
  const q = new URLSearchParams({ q: name, page_size: String(Math.min(20, limit + 6)), mature: 'false' });
  const res = await fetch(`https://api.openverse.org/v1/images/?${q}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Openverse HTTP ${res.status}`);
  const { results = [] } = (await res.json()) as { results?: OpenverseImage[] };
  const tokens = normalize(name).split(' ').filter(Boolean);
  return results
    .filter((r) => tokens.some((t) => normalize(r.title ?? '').includes(t)))
    .map((r) => ({ ...openversePhoto(r), title: r.title ?? '', score: score(r, tokens) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...p }) => p);
}

/** Cuánto se parece a un buen retrato del luchador. */
function score(r: OpenverseImage, tokens: string[]): number {
  const title = normalize(r.title ?? '');
  let s = tokens.every((t) => title.includes(t)) ? 4 : 0;
  if (/\b(cropped|headshot|portrait|retrato)\b/.test(title)) s += 3;
  if ((r.height ?? 0) > (r.width ?? 0)) s += 2;
  const year = Number(title.match(/\b(20[1-3]\d)\b/)?.[1] ?? 0);
  if (year >= 2022) s += 2;
  else if (year >= 2018) s += 1;
  if (/\bvs\b|\bversus\b|\bmatch\b|\bdive\b/.test(title)) s -= 2; // fotos de combate: suele haber más gente
  if (r.source === 'wikimedia') s += 1;
  return s;
}

async function openverseBest(name: string): Promise<WrestlerPhoto | null> {
  const tokens = normalize(name).split(' ').filter(Boolean);
  // Un nombre de una sola palabra corta ("Kofi") daría muchos falsos positivos
  if (tokens.length < 2 && (tokens[0]?.length ?? 0) < 6) return null;
  const results = await openverseSearch(name, 6).catch(() => []);
  // Openverse a veces aún lista fotos ya borradas de su web: se comprueba que existan
  for (const candidate of results.filter((r) => tokens.every((t) => normalize(r.title).includes(t))).slice(0, 3)) {
    if (!(await stillExists(candidate.url))) continue;
    const { title: _t, ...photo } = candidate;
    return photo;
  }
  return null;
}

/** false solo si la web dice que ya no existe (404/410); ante la duda (límite, red), se acepta. */
async function stillExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000), cache: 'no-store' });
    return res.status !== 404 && res.status !== 410;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------- Resolución

/** Ejecuta las tareas de 6 en 6 (para no lanzar decenas de peticiones a la vez a Wikipedia y Openverse). */
async function inBatches<T>(items: T[], task: (item: T) => Promise<void>, size = 6): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(task));
}

/**
 * Fotos de unas personas: las guardadas y, para las que falten (como mucho maxNew por llamada),
 * búsqueda en Wikipedia y Openverse. Devuelve clave → foto (o null si no hay).
 */
export async function photosFor(people: Person[], { maxNew = 16 }: { maxNew?: number } = {}): Promise<Record<string, WrestlerPhoto | null>> {
  const unique = new Map<string, Person>();
  for (const p of people) {
    const key = personKey(p.name);
    if (key && !unique.has(key)) unique.set(key, p);
  }
  const keys = [...unique.keys()];
  const rows = await loadRows(keys).catch(() => new Map<string, WrestlerRow>());
  const now = Date.now();
  const result: Record<string, WrestlerPhoto | null> = {};
  const pending: { key: string; person: Person; row?: WrestlerRow }[] = [];

  for (const key of keys) {
    const row = rows.get(key);
    const age = row ? now - new Date(row.checked_at).getTime() : Infinity;
    // Las guardadas con una dirección que ya se sabe que falla se buscan de nuevo
    const broken = row?.photo && !row.locked && BROKEN_URL.test(row.photo.url);
    if (row && !broken && (row.locked || age < (row.photo ? FRESH_FOUND_MS : FRESH_MISSING_MS))) result[key] = row.photo;
    else pending.push({ key, person: unique.get(key)!, row });
  }
  void touch(keys.filter((k) => k in result));

  const todo = pending.slice(0, maxNew);
  for (const { key, row } of pending.slice(maxNew)) result[key] = row?.photo ?? null; // el resto, la próxima vez
  if (!todo.length) return result;

  try {
    // 1. Artículo de cada uno: el de la cartelera, el ya guardado o uno buscado por nombre
    const titles = new Map<string, string | null>();
    await inBatches(todo, async ({ key, person, row }) => {
      titles.set(key, person.wiki ?? row?.wiki ?? (await findArticle(person.name).catch(() => null)));
    });
    const known = [...new Set([...titles.values()].filter((t): t is string => Boolean(t)))];
    const pages = await pageInfo(known);
    const files = [...new Set([...pages.values()].map((p) => p.image).filter((f): f is string => Boolean(f)))];
    const photos = await fileInfo(files);

    await inBatches(todo, async ({ key, person, row }) => {
      const title = titles.get(key) ?? null;
      const page = title ? pages.get(title) : undefined;
      // 2. Sin foto en Wikipedia: Openverse
      const photo = (page?.image ? photos.get(page.image.replace(/ /g, '_')) : undefined) ?? (await openverseBest(person.name));
      result[key] = photo ?? row?.photo ?? null;
      await saveRow({ key, name: person.name, wiki: page?.title ?? title, photo: result[key], locked: false });
    });
  } catch (err) {
    console.warn('[fotos]', err instanceof Error ? err.message : err);
    for (const { key, row } of todo) result[key] ??= row?.photo ?? null;
  }
  return result;
}

// ---------------------------------------------------------------- Administración

export async function listWrestlers(search: string, limit = 60): Promise<WrestlerRow[]> {
  const q = normalize(search);
  if (!dbConfigured()) {
    return [...memory.values()].filter((r) => !q || r.key.includes(q)).slice(0, limit);
  }
  const rows = await (await db()).query<WrestlerRow>(
    `select * from app.wrestlers where ($1 = '' or key like '%' || $1 || '%') order by seen_at desc limit $2`,
    [q, limit],
  );
  return rows.map((r) => ({ ...r, photo: parsePhoto(r.photo) }));
}

/** Foto elegida a mano (o null = sin foto); queda fijada. */
export async function setManualPhoto(key: string, name: string, photo: WrestlerPhoto | null): Promise<void> {
  const [row] = [...(await loadRows([key])).values()];
  await saveRow({ key, name: row?.name ?? name, wiki: row?.wiki ?? null, photo, locked: true });
}

/** Vuelve a la foto automática (se busca de nuevo en la próxima cartelera). */
export async function resetPhoto(key: string): Promise<void> {
  const [row] = [...(await loadRows([key])).values()];
  if (!row) return;
  await saveRow({ ...row, photo: null, locked: false });
  if (dbConfigured()) await (await db()).query(`update app.wrestlers set checked_at = 'epoch' where key = $1`, [key]);
  else memory.set(key, { ...row, photo: null, locked: false, checked_at: new Date(0) });
}

/** Sube una foto (WebP ya reducida en el navegador) a Supabase Storage y devuelve su URL pública. */
export async function uploadPhoto(key: string, bytes: Buffer): Promise<string> {
  const cfg = supabaseEnv();
  const service = supabaseServiceKey();
  if (!cfg || !service) throw new Error('Falta la configuración de Supabase (clave de servicio) para guardar fotos');
  const headers = { Authorization: `Bearer ${service}`, apikey: service };
  // El cubo público se crea la primera vez (si ya existe, Supabase responde con un error que se ignora)
  await fetch(`${cfg.url}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 1_048_576, allowed_mime_types: ['image/webp'] }),
  }).catch(() => undefined);
  const path = `${key.replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.webp`;
  const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) throw new Error(`No se pudo subir la foto (HTTP ${res.status}: ${(await res.text()).slice(0, 200)})`);
  return `${cfg.url}/storage/v1/object/public/${BUCKET}/${path}`;
}
