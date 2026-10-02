import { Receiver } from '@upstash/qstash';
import { NextResponse, type NextRequest } from 'next/server';
import { loadSchedule, type ScheduleResponse } from '../../../../lib/schedule/load';
import { dbConfigured } from '../../../../lib/server/db';
import { dispatch } from '../../../../lib/server/dispatch';
import { pushConfigured } from '../../../../lib/server/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// La llama Upstash QStash cada 5 minutos (petición firmada). También se puede lanzar a mano con
// la cabecera "Authorization: Bearer <CRON_SECRET>" para probar.
async function authorized(request: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return true;

  const signature = request.headers.get('upstash-signature');
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!signature || !current || !next) return false;
  try {
    return await new Receiver({ currentSigningKey: current, nextSigningKey: next }).verify({ signature, body });
  } catch {
    return false;
  }
}

// El calendario se pide a la propia web: la respuesta está en la caché de la CDN y no hay que
// volver a consultar TVmaze, NJPW y Wikipedia en cada ejecución.
async function scheduleData(request: NextRequest): Promise<Pick<ScheduleResponse, 'episodes' | 'events'>> {
  try {
    const res = await fetch(new URL('/api/schedule', request.url), { signal: AbortSignal.timeout(20000) });
    if (res.ok) return (await res.json()) as ScheduleResponse;
  } catch {
    // se cargan directamente
  }
  return loadSchedule();
}

async function handle(request: NextRequest) {
  const body = await request.text();
  if (!(await authorized(request, body))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!dbConfigured() || !pushConfigured()) {
    return NextResponse.json({ error: 'Base de datos o notificaciones sin configurar' }, { status: 503 });
  }
  try {
    const result = await dispatch(await scheduleData(request));
    return NextResponse.json(result);
  } catch (err) {
    console.error('[dispatch]', err);
    return NextResponse.json({ error: 'Error al enviar avisos' }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
