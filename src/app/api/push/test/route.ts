import { NextResponse, type NextRequest } from 'next/server';
import { translate } from '../../../../i18n/messages';
import { errorResponse, findDevice, notFound, rowToSettings } from '../../../../lib/server/devices';
import { pushConfigured, sendToSubscriptions } from '../../../../lib/server/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST: manda una notificación de prueba a este dispositivo
export async function POST(request: NextRequest) {
  if (!pushConfigured()) return NextResponse.json({ error: 'Notificaciones no configuradas' }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string; token?: string };
  try {
    const device = await findDevice(body.endpoint, body.token);
    if (!device) return notFound();
    const { language } = rowToSettings(device);
    const result = await sendToSubscriptions([device], {
      title: translate(language, 'push.testTitle'),
      body: translate(language, 'push.testBody'),
      url: '/perfil',
      tag: 'test',
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
