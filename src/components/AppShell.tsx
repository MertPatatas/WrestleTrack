'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useT } from '../i18n/SettingsProvider';
import { navItems } from './nav';
import { SessionButton } from './SessionButton';
import { UpcomingRail } from './UpcomingRail';
import { Wordmark } from './Wordmark';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  // La página de una storyline pertenece a "Ponme al día"
  const section = pathname.startsWith('/storyline/') ? '/al-dia' : pathname;
  const isActive = (href: string) => (href === '/' ? pathname === '/' : section.startsWith(href));
  // Calendario, "Ponme al día", storylines y administración ocupan todo el ancho (listas largas, vídeos, líneas de tiempo)
  const showRail = !/^\/(shows|al-dia|storyline|admin)(\/|$)/.test(pathname);

  // Inicio de sesión y textos legales van solos, sin menús
  if (/^\/(login|privacidad|condiciones)(\/|$)/.test(pathname)) return <main className="main-bare">{children}</main>;

  return (
    <div className="shell">
      {/* Móvil: cabecera arriba y pestañas abajo */}
      <header className="topbar">
        <Wordmark />
        <SessionButton />
      </header>

      {/* Escritorio: barra lateral */}
      <aside className="sidebar">
        <Wordmark large />
        <nav className="side-nav" aria-label={t('nav.main')}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="side-link"
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.icon}
              <span>{t(item.label)}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main">
        {/* Escritorio: acceso a la cuenta arriba a la derecha */}
        <div className="main-top">
          <SessionButton />
        </div>
        <div className="content" data-rail={showRail ? 'on' : 'off'}>
          <div className="page">{children}</div>
          {showRail ? (
            <aside className="rail">
              <UpcomingRail />
            </aside>
          ) : null}
        </div>
      </main>

      <nav className="tabbar" aria-label={t('nav.main')}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="tab"
            aria-current={isActive(item.href) ? 'page' : undefined}
          >
            {item.icon}
            <span>{t(item.label)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
