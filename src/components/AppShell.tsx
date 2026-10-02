'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useT } from '../i18n/SettingsProvider';
import { navItems } from './nav';
import { UpcomingRail } from './UpcomingRail';
import { Wordmark } from './Wordmark';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const showRail = !pathname.startsWith('/shows');

  return (
    <div className="shell">
      {/* Móvil: cabecera arriba y pestañas abajo */}
      <header className="topbar">
        <Wordmark />
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
