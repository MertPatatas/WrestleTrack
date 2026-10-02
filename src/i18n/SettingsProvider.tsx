'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  SETTINGS_COOKIE,
  localeFor,
  serializeSettings,
  type Lang,
  type UserSettings,
} from './config';
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
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const ONE_YEAR = 365 * 24 * 3600;

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

  // La zona del dispositivo solo se conoce en el navegador
  useEffect(() => {
    setDeviceTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const lang = settings.language === 'auto' ? deviceLang : settings.language;

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

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update,
      lang,
      deviceLang,
      locale: localeFor(lang, deviceLocale),
      timeZone: settings.timeZone === 'auto' ? deviceTimeZone : settings.timeZone,
      deviceTimeZone,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [settings, update, lang, deviceLang, deviceLocale, deviceTimeZone],
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
