'use client';

import { useSettings } from '../../i18n/SettingsProvider';

// Cuenta con la que se ha iniciado sesión
export function AccountCard() {
  const { t, user, sync, signOut } = useSettings();
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
              <button type="button" className="button button--ghost" onClick={() => void signOut()}>
                {t('account.signOut')}
              </button>
            </div>
          </>
        ) : (
          <div className="skeleton-line" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}
