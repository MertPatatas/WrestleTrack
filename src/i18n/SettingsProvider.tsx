'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadLocalPrefs, saveLocalPrefs, syncDevice } from '../lib/notifications/client';
import type { DeviceSettings } from '../lib/notifications/device';
import { DEFAULT_PREFS, type NotificationPrefs } from '../lib/notifications/prefs';
import { SETTINGS_COOKIE, localeFor, serializeSettings, type Lang, type UserSettings } from './config';
import { translate, type MessageKey } from './messages';

interface SettingsContextValue {
  settings: UserSettings;
  update: (patch: Partial<UserSettings>) => void;
  /** Idioma en uso (el elegido o el del dispositivo). */
  lang: Lang;
  /** Idioma que tendría en automático. */
  deviceLang: Lang;
  locale: string;
  /** Zona horaria en uso; null hasta montar en el navegador si está en automático. */
  timeZone: string | null;
  /** Zona horaria del dispositivo; null hasta montar. */
  deviceTimeZone: string | null;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** Preferencias de notificaciones de este dispositivo. */
  notifications: NotificationPrefs;
  updateNotifications: (patch: Partial<NotificationPrefs>) => void;
  /** Lo que se envía al servidor al activar las notificaciones; null hasta montar. */
  deviceSettings: DeviceSettings | null;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const ONE_YEAR = 365 * 24 * 3600;
const SYNC_DELAY_MS = 800;

export function SettingsProvider({
  initialSettings,
  deviceLang,
  deviceLocale,
  children,
}: {
  initialSettings: UserSettings;
  deviceLang: Lang;
  deviceLocale: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [deviceTimeZone, setDeviceTimeZone] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_PREFS);

  // Solo en el navegador: zona del dispositivo y preferencias de aviso guardadas
  useEffect(() => {
    setDeviceTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setNotifications(loadLocalPrefs());
  }, []);

  const lang = settings.language === 'auto' ? deviceLang : settings.language;
  const locale = localeFor(lang, deviceLocale);
  const timeZone = settings.timeZone === 'auto' ? deviceTimeZone : settings.timeZone;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const update = useCallback(
    (patch: Partial<UserSettings>) => {
      const next = { ...settings, ...patch };
      document.cookie = `${SETTINGS_COOKIE}=${serializeSettings(next)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
      setSettings(next);
      // El título de la pestaña y otros textos del servidor dependen del idioma
      if (next.language !== settings.language) router.refresh();
    },
    [settings, router],
  );

  const updateNotifications = useCallback((patch: Partial<NotificationPrefs>) => {
    setNotifications((prev) => {
      const next = { ...prev, ...patch };
      saveLocalPrefs(next);
      return next;
    });
  }, []);

  const deviceSettings = useMemo<DeviceSettings | null>(
    () =>
      timeZone
        ? { timeZone, language: lang, locale, favorites: settings.favorites, prefs: notifications }
        : null,
    [timeZone, lang, locale, settings.favorites, notifications],
  );

  // Si este dispositivo recibe notificaciones, el servidor se mantiene al día con sus ajustes
  const firstSync = useRef(true);
  useEffect(() => {
    if (!deviceSettings) return;
    const timer = setTimeout(() => {
      syncDevice(deviceSettings).catch((err) => console.warn('[push] no se pudieron guardar los ajustes:', err));
    }, firstSync.current ? 0 : SYNC_DELAY_MS);
    firstSync.current = false;
    return () => clearTimeout(timer);
  }, [deviceSettings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update,
      lang,
      deviceLang,
      locale,
      timeZone,
      deviceTimeZone,
      t: (key, vars) => translate(lang, key, vars),
      notifications,
      updateNotifications,
      deviceSettings,
    }),
    [settings, update, lang, deviceLang, locale, timeZone, deviceTimeZone, notifications, updateNotifications, deviceSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>');
  return ctx;
}

/** Atajo para los textos: const t = useT(); t('nav.home') */
export function useT() {
  return useSettings().t;
}
