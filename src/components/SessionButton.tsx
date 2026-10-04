'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSettings } from '../i18n/SettingsProvider';

// Arriba a la derecha: "Iniciar sesión" sin cuenta, o la inicial del usuario (lleva al perfil) con ella
export function SessionButton() {
  const { user, authReady, accountsEnabled, t } = useSettings();
  const pathname = usePathname();
  if (!accountsEnabled) return null;
  // Mientras se comprueba la sesión se reserva el hueco (sin saltos al aparecer el botón)
  if (!authReady) return <span className="session-button session-button--pending" aria-hidden="true" />;

  if (user) {
    const initial = (user.email ?? '?').charAt(0).toUpperCase();
    return (
      <Link href="/perfil" className="session-avatar" aria-label={t('session.profile')} title={user.email ?? undefined}>
        {initial}
      </Link>
    );
  }

  const next = pathname && pathname !== '/login' ? `?next=${encodeURIComponent(pathname)}` : '';
  return (
    <Link href={`/login${next}`} className="session-button">
      {t('session.signIn')}
    </Link>
  );
}
