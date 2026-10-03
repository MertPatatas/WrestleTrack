'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSettings } from '../../i18n/SettingsProvider';
import { currentSubscription } from '../../lib/notifications/client';

// Cuenta con la que se ha iniciado sesión: cerrar sesión o eliminarla
export function AccountCard() {
  const { t, user, sync, signOut } = useSettings();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  const deleteAccount = async () => {
    if (!window.confirm(t('account.deleteConfirm'))) return;
    setDeleting(true);
    setError(false);
    const res = await fetch('/api/account', { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      setDeleting(false);
      setError(true);
      return;
    }
    // Este dispositivo deja de estar suscrito y se vuelve a la pantalla de entrada
    await (await currentSubscription().catch(() => null))?.unsubscribe().catch(() => undefined);
    await signOut();
  };

  return (
    <section>
      <h2 className="section-title section-title--solo">{t('account.title')}</h2>
      <div className="card">
        {user ? (
          <>
            <p className="card-text">{t('account.signedInAs', { email: user.email ?? '' })}</p>
            <p className={`small setting-help${sync === 'error' ? ' text-error' : ' muted'}`}>
              {sync === 'loading'
                ? t('account.syncLoading')
                : sync === 'error'
                  ? t('account.syncError')
                  : t('account.syncSynced')}
            </p>
            <div className="button-row">
              <button type="button" className="button button--ghost" onClick={() => void signOut()} disabled={deleting}>
                {t('account.signOut')}
              </button>
              <button type="button" className="button button--danger" onClick={deleteAccount} disabled={deleting}>
                {t('account.delete')}
              </button>
            </div>
            {error ? (
              <p className="small text-error setting-help" role="alert">
                {t('account.deleteError')}
              </p>
            ) : null}
          </>
        ) : (
          <div className="skeleton-line" aria-hidden="true" />
        )}
        <p className="muted small setting-help">
          <Link href="/privacidad" className="link link--inline">
            {t('legal.privacy')}
          </Link>
          {' · '}
          <Link href="/condiciones" className="link link--inline">
            {t('legal.terms')}
          </Link>
        </p>
      </div>
    </section>
  );
}
