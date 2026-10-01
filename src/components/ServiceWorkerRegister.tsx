'use client';

import { useEffect } from 'react';

// Registra el service worker solo en producción, para no cachear el modo desarrollo.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin service worker la app funciona igual, solo sin modo sin conexión */
    });
  }, []);
  return null;
}
