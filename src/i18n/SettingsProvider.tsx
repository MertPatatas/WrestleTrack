'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { refreshSubscription } from '../lib/notifications/client';
import type { NotificationPrefs } from '../lib/notifications/prefs';
import type { ProfileDTO } from '../lib/server/profile';
import { getSupabase, initSupabase, supabaseReady } from '../lib/supabase/client';
import type { SupabasePublicConfig } from '../lib/supabase/env';
import { SETTINGS_COOKIE, localeFor, serializeSettings, type Lang, type UserSettings } from './config';
import { translate, type MessageKey } from './messages';

export type SyncState = 'local' | 'loading' | 'synced' | 'error';

export interface SessionUser {
  id: string;
  email: string | null;
}

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
  /** Usuario con sesión (null si no hay, o mientras se comprueba). */
  user: SessionUser | null;
  signOut: () => Promise<void>;
  /** Sincronización de ajustes con la cuenta. */
  sync: SyncState;
  /** Preferencias de notificaciones de la cuenta (null hasta cargarlas). */
  notifications: NotificationPrefs | null;
  updateNotifications: (patch: Partial<NotificationPrefs>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const ONE_YEAR = 365 * 24 * 3600;

function writeCookie(settings: UserSettings) {
  document.cookie = `${SETTINGS_COOKIE}=${serializeSettings(settings)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

async function putProfile(body: object): Promise<ProfileDTO | null> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { profile: ProfileDTO | null }).profile;
}

export function SettingsProvider({
  initialSettings,
  deviceLang,
  deviceLocale,
  supabase: supabaseConfig,
  children,
}: {
  initialSettings: UserSettings;
  deviceLang: Lang;
  deviceLocale: string;
  /** Datos públicos de Supabase que lee el servidor (null si no está configurado). */
  supabase: SupabasePublicConfig | null;
  children: ReactNode;
}) {
  // Antes de que ningún componente use Supabase
  initSupabase(supabaseConfig);
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [deviceTimeZone, setDeviceTimeZone] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sync, setSync] = useState<SyncState>('local');
  const [notifications, setNotifications] = useState<NotificationPrefs | null>(null);
  const syncedUser = useRef<string | null>(null);

  // La zona del dispositivo solo se conoce en el navegador
  useEffect(() => {
    setDeviceTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // Sesión de Supabase (y sus cambios: inicio o cierre de sesión en esta u otra pestaña)
  useEffect(() => {
    if (!supabaseReady()) return;
    const supabase = getSupabase();
    const toUser = (u: { id: string; email?: string | null } | null | undefined): SessionUser | null =>
      u ? { id: u.id, email: u.email ?? null } : null;
    supabase.auth.getUser().then(({ data }) => setUser(toUser(data.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(toUser(session?.user)));
    return () => data.subscription.unsubscribe();
  }, []);

  const lang = settings.language === 'auto' ? deviceLang : settings.language;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Aplica unos ajustes (de la cuenta o del usuario) en este navegador
  const applyLocal = useCallback(
    (next: UserSettings, prev: UserSettings) => {
      writeCookie(next);
      setSettings(next);
      // El título de la pestaña y otros textos del servidor dependen del idioma
      if (next.language !== prev.language) router.refresh();
    },
    [router],
  );

  // Al iniciar sesión: la primera vez se suben los ajustes de este navegador a la cuenta;
  // las siguientes, se traen los de la cuenta (así todos los dispositivos quedan iguales).
  useEffect(() => {
    if (!deviceTimeZone) return;
    if (!user) {
      syncedUser.current = null;
      setSync('local');
      setNotifications(null);
      return;
    }
    if (syncedUser.current === user.id) return;
    syncedUser.current = user.id;

    let cancelled = false;
    const device = { timeZone: deviceTimeZone, language: deviceLang, locale: deviceLocale };
    setSync('loading');
    (async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { profile } = (await res.json()) as { profile: ProfileDTO | null };
        const saved = profile
          ? await putProfile({ device }) // solo actualiza los datos del dispositivo
          : await putProfile({ settings, device });
        if (cancelled || !saved) return;
        if (profile) applyLocal(saved.settings, settings);
        setNotifications(saved.notifications);
        setSync('synced');
        // Si este dispositivo ya recibía avisos, queda asociado a esta cuenta
        void refreshSubscription();
      } catch (err) {
        console.warn('[perfil] no se pudo sincronizar:', err);
        if (!cancelled) {
          syncedUser.current = null; // se reintenta en la próxima carga
          setSync('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // settings se lee solo al iniciar sesión; no debe relanzar la sincronización
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, deviceTimeZone, deviceLang, deviceLocale, applyLocal]);

  const update = useCallback(
    (patch: Partial<UserSettings>) => {
      const next = { ...settings, ...patch };
      applyLocal(next, settings);
      if (sync === 'synced') {
        putProfile({ settings: patch }).catch((err) => {
          console.warn('[perfil] no se pudo guardar:', err);
          setSync('error');
        });
      }
    },
    [settings, applyLocal, sync],
  );

  const updateNotifications = useCallback(
    (patch: Partial<NotificationPrefs>) => {
      if (!notifications) return;
      setNotifications({ ...notifications, ...patch });
      putProfile({ notifications: patch })
        .then((saved) => saved && setNotifications(saved.notifications))
        .catch((err) => {
          console.warn('[perfil] no se pudo guardar:', err);
          setSync('error');
        });
    },
    [notifications],
  );

  const signOut = useCallback(async () => {
    if (supabaseReady()) await getSupabase().auth.signOut();
    setUser(null);
    // Carga completa: que no se reutilice ninguna página guardada de cuando había sesión
    window.location.replace('/login');
  }, []);

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
      user,
      signOut,
      sync,
      notifications,
      updateNotifications,
    }),
    [settings, update, lang, deviceLang, deviceLocale, deviceTimeZone, user, signOut, sync, notifications, updateNotifications],
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
