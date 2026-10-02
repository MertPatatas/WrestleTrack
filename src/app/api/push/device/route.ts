import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeDeviceSettings, type DeviceSettings } from '../../../../lib/notifications/device';
import { errorResponse, findDevice, notFound, rowToSettings, saveSettings } from '../../../../lib/server/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT: actualiza los ajustes de un dispositivo registrado (solo cambia lo que llega)
export async function PUT(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    endpoint?: string;
    token?: string;
    settings?: Partial<DeviceSettings>;
  };
  try {
    const device = await findDevice(body.endpoint, body.token);
    if (!device) return notFound();
    const current = rowToSettings(device);
    const next = sanitizeDeviceSettings(
      { ...body.settings, prefs: body.settings?.prefs ? { ...current.prefs, ...body.settings.prefs } : undefined },
      current,
    );
    await saveSettings(device.id, next);
    return NextResponse.json({ settings: next });
  } catch (err) {
    return errorResponse(err);
  }
}
