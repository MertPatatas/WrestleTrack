import 'server-only';
import webpush, { WebPushError } from 'web-push';
import { db, type SubscriptionRow } from './db';

// Envío de notificaciones Web Push (estándar del navegador, sin servicios de terceros).
// Claves VAPID: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT (mailto: o https:).

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // página que se abre al tocar la notificación
  tag?: string; // misma etiqueta = la nueva sustituye a la anterior
}

let configured = false;

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (configured) return;
  if (!pushConfigured()) throw new Error('Faltan las claves VAPID');
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:wrestletrack@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Envía una notificación a todos los dispositivos de un usuario.
 * Borra las suscripciones que el navegador ya no acepta (desinstalada, permiso retirado...).
 */
export async function sendToSubscriptions(
  subs: SubscriptionRow[],
  payload: PushPayload,
  ttlSeconds = 3600,
): Promise<{ sent: number; removed: number }> {
  configure();
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: ttlSeconds, urgency: 'high' },
        );
        sent++;
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) dead.push(s.endpoint);
        else console.warn('[push] fallo al enviar:', err instanceof Error ? err.message : err);
      }
    }),
  );
  if (dead.length) {
    const sql = await db();
    await sql.query('delete from push_subscriptions where endpoint = any($1)', [dead]);
  }
  return { sent, removed: dead.length };
}
