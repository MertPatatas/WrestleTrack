import { NextResponse } from 'next/server';
import { loadNews } from '../../../lib/news/loadNews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await loadNews();
    return NextResponse.json(data, {
      headers: {
        // La CDN (por ejemplo la de Vercel) guarda la respuesta 10 min y sirve la antigua mientras refresca
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar las noticias' }, { status: 500 });
  }
}
