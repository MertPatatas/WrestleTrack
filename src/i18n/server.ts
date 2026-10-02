import { cookies, headers } from 'next/headers';
import { SETTINGS_COOKIE, detectLanguage, localeFor, parseSettings } from './config';
import { translate, type MessageKey } from './messages';

/** Idioma y ajustes de la petición actual (cookie de ajustes + idioma del navegador). */
export async function getRequestI18n() {
  const settings = parseSettings((await cookies()).get(SETTINGS_COOKIE)?.value);
  const device = detectLanguage((await headers()).get('accept-language'));
  const lang = settings.language === 'auto' ? device.lang : settings.language;
  return {
    settings,
    device,
    lang,
    locale: localeFor(lang, device.locale),
    t: (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
  };
}

/** Título de página traducido, para generateMetadata. */
export async function pageTitle(key: MessageKey): Promise<{ title: string }> {
  const { t } = await getRequestI18n();
  return { title: t(key) };
}
