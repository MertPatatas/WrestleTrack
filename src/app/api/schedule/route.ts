import { NextResponse } from 'next/server';
import { loadSchedule } from '../../../lib/schedule/load';

export type { ScheduleResponse, ScheduleSourceStatus } from '../../../lib/schedule/load';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const data = await loadSchedule();
  const allOk = data.sources.every((s) => s.ok);
  return NextResponse.json(data, {
    headers: {
      // La CDN guarda la respuesta y sirve la antigua mientras refresca
      'Cache-Control': allOk
        ? 'public, s-maxage=21600, stale-while-revalidate=86400'
        : 'public, s-maxage=900, stale-while-revalidate=86400',
    },
  });
}
