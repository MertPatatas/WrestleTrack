// Idiomas, detección y ajustes del usuario. Sin dependencias de servidor ni de navegador:
// lo usan tanto el layout (servidor) como el proveedor de ajustes (cliente).

export const LANGUAGES = ['es', 'en'] as const;
export type Lang = (typeof LANGUAGES)[number];

// Cada idioma se muestra en su propio idioma en el selector
export const LANGUAGE_NAMES: Record<Lang, string> = { es: 'Español', en: 'English' };

// Si el dispositivo está en un idioma que no tenemos, se usa inglés
export const FALLBACK_LANG: Lang = 'en';
const DEFAULT_LOCALE: Record<Lang, string> = { es: 'es-ES', en: 'en-US' };

const isLang = (v: unknown): v is Lang => LANGUAGES.includes(v as Lang);

/**
 * Idioma a partir de la cabecera Accept-Language ("es-MX,es;q=0.9,en;q=0.8").
 * locale conserva la región del dispositivo (es-MX, en-GB...) para formatear fechas a su manera.
 */
export function detectLanguage(acceptLanguage: string | null | undefined): { lang: Lang; locale: string } {
  const prefs = (acceptLanguage ?? '')
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.trim().slice(2) ?? 1);
      return { tag: tag.trim(), q: Number.isNaN(q) ? 0 : q, i };
    })
    .filter((p) => p.tag && p.tag !== '*')
    .sort((a, b) => b.q - a.q || a.i - b.i);

  for (const { tag } of prefs) {
    const base = tag.slice(0, 2).toLowerCase();
    if (isLang(base)) return { lang: base, locale: safeLocale(tag) ?? DEFAULT_LOCALE[base] };
  }
  return { lang: FALLBACK_LANG, locale: DEFAULT_LOCALE[FALLBACK_LANG] };
}

function safeLocale(tag: string): string | null {
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? null;
  } catch {
    return null;
  }
}

/** Locale para formatear fechas: la región del dispositivo si coincide con el idioma elegido. */
export function localeFor(lang: Lang, deviceLocale: string): string {
  return deviceLocale.slice(0, 2).toLowerCase() === lang ? deviceLocale : DEFAULT_LOCALE[lang];
}

// ---------- Ajustes del usuario (cookie, para que el servidor también los conozca) ----------

export interface UserSettings {
  timeZone: 'auto' | string; // 'auto' = la del dispositivo; si no, una zona IANA ("Europe/Madrid")
  language: 'auto' | Lang; // 'auto' = el del dispositivo
}

export const DEFAULT_SETTINGS: UserSettings = { timeZone: 'auto', language: 'auto' };
export const SETTINGS_COOKIE = 'wt-settings';

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function parseSettings(raw: string | null | undefined): UserSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<UserSettings>;
    return {
      timeZone:
        typeof value.timeZone === 'string' && (value.timeZone === 'auto' || isValidTimeZone(value.timeZone))
          ? value.timeZone
          : 'auto',
      language: value.language === 'auto' || isLang(value.language) ? value.language : 'auto',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function serializeSettings(settings: UserSettings): string {
  return encodeURIComponent(JSON.stringify(settings));
}
