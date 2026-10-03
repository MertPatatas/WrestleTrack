import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppShell } from '../components/AppShell';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import { SettingsProvider } from '../i18n/SettingsProvider';
import { getRequestI18n } from '../i18n/server';
import { supabaseEnv } from '../lib/supabase/env';
import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestI18n();
  return {
    title: { default: 'WrestleTrack', template: '%s · WrestleTrack' },
    description: t('meta.description'),
    applicationName: 'WrestleTrack',
    appleWebApp: { capable: true, title: 'WrestleTrack', statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#0D0D0E',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// El idioma sale de la cookie de ajustes o, en automático, del idioma del navegador
// (cabecera Accept-Language), así la página llega ya en el idioma correcto.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { settings, device, lang } = await getRequestI18n();
  return (
    <html lang={lang} className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        <SettingsProvider
          initialSettings={settings}
          deviceLang={device.lang}
          deviceLocale={device.locale}
          supabase={supabaseEnv()}
        >
          <AppShell>{children}</AppShell>
        </SettingsProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
