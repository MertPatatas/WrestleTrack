import {
  FAVORITE_OPTIONS,
  isLang,
  isValidTimeZone,
  sanitizeFavorites,
  type FavoritePromotion,
  type Lang,
} from '../../i18n/config';
import { DEFAULT_PREFS, sanitizePrefs, type NotificationPrefs } from './prefs';

/** Lo que el servidor necesita saber de un dispositivo para avisarle. */
export interface DeviceSettings {
  timeZone: string; // zona IANA ya resuelta (si el usuario tiene "automática", la del dispositivo)
  language: Lang; // idioma de los avisos
  locale: string; // formato de horas y fechas ("es-ES", "en-US"...)
  favorites: FavoritePromotion[];
  prefs: NotificationPrefs;
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  timeZone: 'Europe/Madrid',
  language: 'es',
  locale: 'es-ES',
  favorites: [...FAVORITE_OPTIONS],
  prefs: DEFAULT_PREFS,
};

/** Valida unos ajustes de origen desconocido (petición o base de datos). */
export function sanitizeDeviceSettings(
  input: Partial<DeviceSettings> | null | undefined,
  base: DeviceSettings = DEFAULT_DEVICE_SETTINGS,
): DeviceSettings {
  const v = input ?? {};
  let locale = base.locale;
  if (typeof v.locale === 'string' && v.locale.length <= 35) {
    try {
      locale = Intl.getCanonicalLocales(v.locale)[0] ?? base.locale;
    } catch {
      // se queda el anterior
    }
  }
  return {
    timeZone: typeof v.timeZone === 'string' && isValidTimeZone(v.timeZone) ? v.timeZone : base.timeZone,
    language: isLang(v.language) ? v.language : base.language,
    locale,
    favorites: v.favorites === undefined ? base.favorites : sanitizeFavorites(v.favorites),
    prefs: v.prefs === undefined ? base.prefs : sanitizePrefs(v.prefs, base.prefs),
  };
}
