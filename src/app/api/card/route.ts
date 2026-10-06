import { after, NextResponse, type NextRequest } from 'next/server';
import type { Show } from '../../../data/types';
import { loadCard } from '../../../lib/schedule/card';
import { photosFor } from '../../../lib/wrestlers/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PROMOTIONS = new Set(['wwe', 'aew', 'cmll', 'aaa', 'njpw', 'other']);

// GET /api/card?id=…&kind=…&promotion=…&date=YYYY-MM-DD&url=… → cartelera del show.
// Los datos los manda el navegador (que ya tiene el calendario); se validan para que el servidor
// solo pueda consultar las fuentes previstas (Wikipedia, NJPW, AEW, CMLL).
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const id = q.get('id') ?? '';
  const kind = q.get('kind') ?? '';
  const promotion = q.get('promotion') ?? '';
  const date = q.get('date') ?? '';
  const url = q.get('url') ?? undefined;
  const nightParam = q.get('night');
  const night = nightParam ? Number(nightParam) : undefined;

  if (
    (night !== undefined && !(Number.isInteger(night) && night >= 1 && night <= 9)) ||
    !/^[a-z0-9-]{3,120}$/.test(id) ||
    !['weekly', 'ple', 'other'].includes(kind) ||
    !PROMOTIONS.has(promotion) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    (url !== undefined && !/^https:\/\/en\.wikipedia\.org\/wiki\/[^/?#]+$/.test(url))
  ) {
    return NextResponse.json({ error: 'Parámetros no válidos' }, { status: 400 });
  }

  const show = { id, kind, promotion, eventDate: date, url, night, name: '' } as unknown as Show;
  const card = await loadCard(show);
  // Fotos de los luchadores: se responde ya con las guardadas; las que falten se buscan después de
  // responder (y la revisión horaria prepara las carteleras de los próximos días)
  const people = (card?.matches ?? []).flatMap((m) => (m.sides ?? []).flatMap((side) => side.people));
  const photos = people.length ? await photosFor(people, { maxNew: 0 }).catch(() => ({})) : {};
  if (people.length) after(() => photosFor(people, { maxNew: 16 }).then(() => undefined).catch(() => undefined));
  return NextResponse.json(
    { card, photos },
    // La cartelera es pública: la CDN puede guardarla 30 min
    { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } },
  );
}
