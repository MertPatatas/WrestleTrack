import { NextResponse } from 'next/server';
import { currentUser, isAdminEmail } from '../../../../lib/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/me → { admin } (para mostrar o no el acceso a la administración)
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ admin: isAdminEmail(user?.email) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
