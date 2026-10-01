'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'checking' | 'installed' | 'prompt' | 'ios' | 'manual';

export function InstallCard() {
  const [mode, setMode] = useState<Mode>('checking');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setMode('installed');
      return;
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setMode(isIos ? 'ios' : 'manual');

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('prompt');
    };
    const onInstalled = () => setMode('installed');

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (mode === 'checking') return null;

  return (
    <section>
      <h2 className="section-title section-title--solo">Instalar como aplicación</h2>
      <div className="card">
        {mode === 'installed' && <p className="card-text">Ya estás usando WrestleTrack como aplicación.</p>}

        {mode === 'prompt' && (
          <>
            <p className="card-text">Instálala para abrirla desde tu escritorio o pantalla de inicio, en su propia ventana.</p>
            <button type="button" className="button" onClick={install}>
              Instalar WrestleTrack
            </button>
          </>
        )}

        {mode === 'ios' && (
          <p className="card-text">
            En Safari pulsa el botón Compartir y elige «Añadir a pantalla de inicio».
          </p>
        )}

        {mode === 'manual' && (
          <p className="card-text">
            En Chrome o Edge busca el icono de instalar en la barra de direcciones, o abre el menú del
            navegador y elige «Instalar WrestleTrack». La instalación solo está disponible en la versión
            publicada con HTTPS.
          </p>
        )}
      </div>
    </section>
  );
}
