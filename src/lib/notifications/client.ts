'use client';

import type { DeviceSettings } from './device';
import { DEFAULT_PREFS, sanitizePrefs, type NotificationPrefs } from './prefs';

// Notificaciones push en este dispositivo, sin cuentas: el servidor guarda el dispositivo con
// sus preferencias y le da una clave; el navegador la guarda para poder cambiarlas después.

export type PushSupport =
  | 'supported'
  | 'ios-install' // iPhone/iPad: solo funcionan con la app añadida a la pantalla de inicio (iOS 16.4+)
  | 'unsupported'
  | 'not-configured'; // faltan las claves VAPID en el servidor

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DEVICE_KEY = 'wrestletrack:push-device';
const PREFS_KEY = 'wrestletrack:notify-prefs';

interface StoredDevice {
  endpoint: string;
  token: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // almacenamiento no disponible (modo privado): las notificaciones no podrán gestionarse
  }
}

/** Preferencias guardadas en este navegador (las de por defecto si aún no hay). */
export function loadLocalPrefs(): NotificationPrefs {
  return sanitizePrefs(read<Partial<NotificationPrefs>>(PREFS_KEY), DEFAULT_PREFS);
}

export function saveLocalPrefs(prefs: NotificationPrefs) {
  write(PREFS_KEY, prefs);
}

export function pushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY) return 'not-configured';
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'supported';
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // En desarrollo el service worker no se registra solo: se registra aquí para poder probar
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (!existing) await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'supported') return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

/** ¿Recibe notificaciones este dispositivo? (suscrito en el navegador y registrado en el servidor) */
export async function isEnabledHere(): Promise<boolean> {
  const sub = await currentSubscription();
  const stored = read<StoredDevice>(DEVICE_KEY);
  return Boolean(sub && stored && stored.endpoint === sub.endpoint);
}

async function register(sub: PushSubscription, settings: DeviceSettings): Promise<boolean> {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), settings }),
  });
  if (!res.ok) return false;
  const { token } = (await res.json()) as { token: string };
  write(DEVICE_KEY, { endpoint: sub.endpoint, token } satisfies StoredDevice);
  return true;
}

export type EnableResult = 'enabled' | 'denied' | 'error';

/** Pide permiso, suscribe el dispositivo y lo registra con sus ajustes. */
export async function enablePush(settings: DeviceSettings): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  try {
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY!) }));
    return (await register(sub, settings)) ? 'enabled' : 'error';
  } catch (err) {
    console.warn('[push]', err);
    return 'error';
  }
}

/** Deja de recibir notificaciones en este dispositivo y borra sus datos del servidor. */
export async function disablePush(): Promise<void> {
  const stored = read<StoredDevice>(DEVICE_KEY);
  if (stored) {
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stored),
    }).catch(() => undefined);
  }
  write(DEVICE_KEY, null);
  const sub = await currentSubscription();
  await sub?.unsubscribe();
}

/**
 * Envía los ajustes actuales al servidor si este dispositivo tiene las notificaciones activadas.
 * Si el servidor lo había olvidado (p. ej. base de datos nueva), lo vuelve a registrar.
 */
export async function syncDevice(settings: DeviceSettings): Promise<void> {
  const stored = read<StoredDevice>(DEVICE_KEY);
  if (!stored) return;
  const res = await fetch('/api/push/device', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...stored, settings }),
  });
  if (res.status === 404) {
    const sub = await currentSubscription();
    if (sub) await register(sub, settings);
    else write(DEVICE_KEY, null);
  }
}

/** Manda una notificación de prueba; si falla, devuelve el motivo que da el servidor. */
export async function sendTestPush(): Promise<{ ok: boolean; error?: string }> {
  const stored = read<StoredDevice>(DEVICE_KEY);
  if (!stored) return { ok: false, error: 'not-registered' };
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stored),
  }).catch(() => null);
  if (res?.ok) return { ok: true };
  const body = (await res?.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, error: body?.error ?? (res ? `HTTP ${res.status}` : 'sin conexión') };
}
