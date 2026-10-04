'use client';

import Link from 'next/link';
import { useSettings } from '../../i18n/SettingsProvider';

// Perfil de un invitado: solo la invitación a iniciar sesión o crear cuenta
export function GuestProfileCard() {
  const { t } = useSettings();
  return (
    <section className="card guest-card">
      <h2 className="section-title">{t('guest.title')}</h2>
      <p className="card-text">{t('guest.text')}</p>
      <ul className="guest-benefits">
        <li>{t('guest.benefitAlerts')}</li>
        <li>{t('guest.benefitFavorites')}</li>
        <li>{t('guest.benefitSync')}</li>
      </ul>
      <Link href="/login?next=%2Fperfil" className="button guest-button">
        {t('guest.button')}
      </Link>
      <p className="muted small">
        <Link href="/privacidad" className="link link--inline">
          {t('legal.privacy')}
        </Link>
        {' · '}
        <Link href="/condiciones" className="link link--inline">
          {t('legal.terms')}
        </Link>
      </p>
    </section>
  );
}
