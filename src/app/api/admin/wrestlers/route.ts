import { NextResponse, type NextRequest } from 'next/server';
import type { WrestlerPhoto } from '../../../../data/types';
import { requireAdmin } from '../../../../lib/server/admin';
import { errorResponse } from '../../../../lib/server/profile';
import { personKey } from '../../../../lib/wrestlers/people';
import { listWrestlers, openverseSearch, photosFor, resetPhoto, setManualPhoto, uploadPhoto } from '../../../../lib/wrestlers/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_UPLOAD_BYTES = 1_000_000; // la foto llega ya reducida en el navegador (WebP, 400 px)

// GET ?q=texto → luchadores guardados (los vistos más recientemente primero)
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if ('response' in admin) return admin.response;
  try {
    const rows = await listWrestlers(request.nextUrl.searchParams.get('q') ?? '');
    return NextResponse.json(
      { wrestlers: rows.map((r) => ({ key: r.key, name: r.name, wiki: r.wiki, photo: r.photo, locked: r.locked })) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const https = (v: unknown) => (typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v) && v.length <= 600 ? v : undefined);
const pct = (v: unknown, fallback: number) => (typeof v === 'number' && v >= 0 && v <= 100 ? Math.round(v) : fallback);

function photoFrom(v: unknown): WrestlerPhoto | null {
  const p = (v ?? {}) as Record<string, unknown>;
  const url = https(p.url);
  if (!url) return null;
  const source = ['wikipedia', 'openverse', 'upload', 'manual'].includes(p.source as string) ? (p.source as WrestlerPhoto['source']) : 'manual';
  return {
    url,
    source,
    credit: text(p.credit, 120),
    creditUrl: https(p.creditUrl),
    license: text(p.license, 40),
    licenseUrl: https(p.licenseUrl),
    focusX: pct(p.focusX, 50),
    focusY: pct(p.focusY, 25),
  };
}

// POST { action, … }: elegir, subir, quitar o ajustar fotos
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if ('response' in admin) return admin.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = text(body?.name, 40);
  const key = text(body?.key, 60) ?? (name ? personKey(name) : undefined);
  if (!body || typeof body.action !== 'string') return NextResponse.json({ error: 'Petición no válida' }, { status: 400 });

  try {
    switch (body.action) {
      case 'candidates':
        if (!name) break;
        return NextResponse.json({ candidates: await openverseSearch(name, 12) });
      case 'add':
        if (!name) break;
        await photosFor([{ name, wiki: text(body.wiki, 120) }], { maxNew: 1 });
        return NextResponse.json({ ok: true, key: personKey(name) });
      case 'set': {
        const photo = photoFrom(body.photo);
        if (!key || !name || !photo) break;
        await setManualPhoto(key, name, photo);
        return NextResponse.json({ ok: true });
      }
      case 'none':
        if (!key || !name) break;
        await setManualPhoto(key, name, null);
        return NextResponse.json({ ok: true });
      case 'reset':
        if (!key) break;
        await resetPhoto(key);
        return NextResponse.json({ ok: true });
      case 'upload': {
        const data = typeof body.data === 'string' ? body.data.replace(/^data:image\/webp;base64,/, '') : '';
        const bytes = Buffer.from(data, 'base64');
        if (!key || !name || bytes.length < 100) break;
        if (bytes.length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'La foto es demasiado grande' }, { status: 413 });
        // WebP: "RIFF....WEBP"
        if (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') {
          return NextResponse.json({ error: 'Formato no válido' }, { status: 400 });
        }
        const url = await uploadPhoto(key, bytes);
        await setManualPhoto(key, name, { url, source: 'upload', focusX: 50, focusY: 30, credit: text(body.credit, 120) });
        return NextResponse.json({ ok: true, url });
      }
      default:
        return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  } catch (err) {
    if (body.action === 'candidates' || body.action === 'upload') {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
    return errorResponse(err);
  }
}
