'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { useSettings } from '../../i18n/SettingsProvider';

// Inicio de sesión (formulario de Clerk en una ventana: código de 6 dígitos por email)
export function AccountCard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const { t, sync } = useSettings();

  return (
    <section>
      <h2 className="section-title section-title--solo">{t('account.title')}</h2>
      <div className="card">
        {!isLoaded ? (
          <div className="skeleton-line" aria-hidden="true" />
        ) : isSignedIn ? (
          <>
            <p className="card-text">
              {t('account.signedInAs', { email: user.primaryEmailAddress?.emailAddress ?? user.username ?? '' })}
            </p>
            <p className={`small setting-help${sync === 'error' ? ' text-error' : ' muted'}`}>
              {sync === 'loading'
                ? t('account.syncLoading')
                : sync === 'error'
                  ? t('account.syncError')
                  : t('account.syncSynced')}
            </p>
            <div className="button-row">
              <button type="button" className="button button--ghost" onClick={() => clerk.signOut()}>
                {t('account.signOut')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="card-text">{t('account.signedOutText')}</p>
            <div className="button-row">
              <button type="button" className="button" onClick={() => clerk.openSignIn({})}>
                {t('account.signIn')}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
