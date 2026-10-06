import { after, NextResponse } from 'next/server';
import { readRecaps, recapPeople, recapsStale, refreshRecapsNow } from '../../../lib/recaps/collect';
import { photosFor } from '../../../lib/wrestlers/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/recaps → resultados de los shows emitidos y vídeos de análisis de las últimas semanas.
// Se revisan las fuentes cada hora (aviso horario de /api/push/dispatch); si hace tiempo que no
// se hace, se lanza una revisión después de responder (o antes, la primera vez que no hay nada).
export async function GET() {
  try {
    let data = await readRecaps();
    if (!data.updatedAt) {
      await refreshRecapsNow();
      data = await readRecaps();
    } else if (await recapsStale()) {
      after(() => refreshRecapsNow().catch((err) => console.warn('[recaps] revisión fallida:', err)));
    }
    // Fotos de los luchadores: las guardadas y unas pocas nuevas por petición (el resto, en las siguientes)
    const photos = await photosFor(recapPeople(data.recaps), { maxNew: 12 }).catch(() => ({}));
    return NextResponse.json({ ...data, photos }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' },
    });
  } catch (err) {
    console.error('[recaps]', err);
    return NextResponse.json({ error: 'No se pudieron cargar los resúmenes' }, { status: 500 });
  }
}
