'use client';

import { useMemo } from 'react';
import { InstallCard } from '../components/InstallCard';
import { PageHeader } from '../components/PageHeader';
import { AccountCard } from '../components/profile/AccountCard';
import { NotificationsCard } from '../components/profile/NotificationsCard';
import { promotions } from '../data/mock';
import { FAVORITE_OPTIONS, LANGUAGES, LANGUAGE_NAMES, type FavoritePromotion, type Lang } from '../i18n/config';
import { useSettings } from '../i18n/SettingsProvider';
import { utcOffsetLabel } from '../lib/dates';

// Zonas que se ofrecen arriba del todo (público de España, Latinoamérica y EE. UU., más Japón por NJPW)
const COMMON_ZONES = [
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/London',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Caracas',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function allTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
  try {
    return intl.supportedValuesOf?.('timeZone') ?? COMMON_ZONES;
  } catch {
    return COMMON_ZONES;
  }
}

const cityName = (tz: string) => tz.split('/').pop()!.replace(/_/g, ' ');

export function ProfileView() {
  const { settings, update, lang, deviceLang, deviceTimeZone, t } = useSettings();

  const toggleFavorite = (id: FavoritePromotion) => {
    const favorites = settings.favorites.includes(id)
      ? settings.favorites.filter((f) => f !== id)
      : FAVORITE_OPTIONS.filter((f) => f === id || settings.favorites.includes(f));
    update({ favorites });
  };

  // La lista de zonas y sus desfases solo se calculan en el navegador (tras conocer la del dispositivo)
  const zones = useMemo(() => {
    if (!deviceTimeZone) return null;
    const now = Date.now();
    const label = (tz: string, full: boolean) => `${full ? tz.replace(/_/g, ' ') : cityName(tz)} (${utcOffsetLabel(tz, now)})`;
    const all = allTimeZones();
    const common = COMMON_ZONES.filter((tz) => all.includes(tz) || tz === deviceTimeZone);
    // Una zona elegida que no esté en la lista del navegador se sigue mostrando
    const extra = settings.timeZone !== 'auto' && !all.includes(settings.timeZone) ? [settings.timeZone] : [];
    return {
      auto: t('profile.tzAuto', { tz: label(deviceTimeZone, true) }),
      common: common.map((tz) => ({ value: tz, label: label(tz, false) })),
      all: [...extra, ...all].map((tz) => ({ value: tz, label: label(tz, true) })),
    };
  }, [deviceTimeZone, settings.timeZone, t]);

  return (
    <>
      <PageHeader title={t('profile.title')} />

      <AccountCard />

      <section>
        <h2 className="section-title section-title--solo">{t('profile.following')}</h2>
        <div className="card card--list">
          {FAVORITE_OPTIONS.map((id) => (
            <div key={id} className="row">
              <span id={`fav-${id}`}>{promotions.find((p) => p.id === id)?.name ?? id}</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.favorites.includes(id)}
                aria-labelledby={`fav-${id}`}
                className="switch"
                onClick={() => toggleFavorite(id)}
              />
            </div>
          ))}
        </div>
        <p className="muted small setting-help">{t('profile.followingHelp')}</p>
      </section>

      <NotificationsCard />

      <section>
        <h2 className="section-title section-title--solo">
          <label htmlFor="setting-tz">{t('profile.timeZone')}</label>
        </h2>
        <div className="card">
          {zones ? (
            <select
              id="setting-tz"
              className="select"
              value={settings.timeZone}
              onChange={(e) => update({ timeZone: e.target.value })}
            >
              <option value="auto">{zones.auto}</option>
              <optgroup label={t('profile.tzCommon')}>
                {zones.common.map((z) => (
                  <option key={`c-${z.value}`} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('profile.tzAll')}>
                {zones.all.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </optgroup>
            </select>
          ) : (
            <div className="select select--placeholder" aria-hidden="true" />
          )}
          <p className="muted small setting-help">{t('profile.timeZoneHelp')}</p>
        </div>
      </section>

      <section>
        <h2 className="section-title section-title--solo">
          <label htmlFor="setting-lang">{t('profile.language')}</label>
        </h2>
        <div className="card">
          <select
            id="setting-lang"
            className="select"
            value={settings.language}
            onChange={(e) => update({ language: e.target.value as Lang | 'auto' })}
          >
            <option value="auto">{t('profile.langAuto', { lang: LANGUAGE_NAMES[deviceLang] })}</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LANGUAGE_NAMES[l]}
              </option>
            ))}
          </select>
          <p className="muted small setting-help" lang={lang}>
            {t('profile.languageHelp')}
          </p>
        </div>
      </section>

      <InstallCard />
    </>
  );
}
