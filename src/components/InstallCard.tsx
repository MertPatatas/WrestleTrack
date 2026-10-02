'use client';

import { useEffect, useState } from 'react';
import { useT } from '../i18n/SettingsProvider';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'checking' | 'installed' | 'prompt' | 'ios' | 'manual';

export function InstallCard() {
  const t = useT();
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
      <h2 className="section-title section-title--solo">{t('install.title')}</h2>
      <div className="card">
        {mode === 'installed' && <p className="card-text">{t('install.installed')}</p>}

        {mode === 'prompt' && (
          <>
            <p className="card-text">{t('install.prompt')}</p>
            <button type="button" className="button" onClick={install}>
              {t('install.button')}
            </button>
          </>
        )}

        {mode === 'ios' && (
          <p className="card-text">{t('install.ios')}</p>
        )}

        {mode === 'manual' && (
          <p className="card-text">{t('install.manual')}</p>
        )}
      </div>
    </section>
  );
}
