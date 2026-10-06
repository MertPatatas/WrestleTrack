import { NextResponse, type NextRequest } from 'next/server';
import { photosFor } from '../../../lib/wrestlers/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// GET /api/wrestlers?names=A|B|C → fotos de esas personas (participantes de una storyline).
// Como mucho 16 nombres, y solo se buscan 6 nuevos por petición (el resto, la siguiente vez).
export async function GET(request: NextRequest) {
  const names = (request.nextUrl.searchParams.get('names') ?? '')
    .split('|')
    .map((n) => n.trim())
    .filter((n) => n.length >= 2 && n.length <= 40)
    .slice(0, 16);
  if (!names.length) return NextResponse.json({ photos: {} });
  const photos = await photosFor(
    names.map((name) => ({ name })),
    { maxNew: 6 },
  ).catch(() => ({}));
  return NextResponse.json({ photos }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
}
