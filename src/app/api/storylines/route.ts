import { NextResponse } from 'next/server';
import { dbConfigured } from '../../../lib/server/db';
import { errorResponse } from '../../../lib/server/profile';
import { listPublished } from '../../../lib/storylines/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/storylines → storylines publicadas con sus avances aprobados (públicas, sin sesión)
export async function GET() {
  if (!dbConfigured()) return NextResponse.json({ storylines: [] });
  try {
    const storylines = await listPublished();
    return NextResponse.json(
      { storylines },
      // Lo que se aprueba se ve en un par de minutos
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
