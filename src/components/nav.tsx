import type { ReactNode } from 'react';
import type { MessageKey } from '../i18n/messages';

export interface NavItem {
  href: string;
  label: MessageKey;
  icon: ReactNode;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const navItems: NavItem[] = [
  {
    href: '/',
    label: 'nav.home',
    icon: (
      <Icon>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10" />
      </Icon>
    ),
  },
  {
    href: '/noticias',
    label: 'nav.news',
    icon: (
      <Icon>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </Icon>
    ),
  },
  {
    href: '/al-dia',
    label: 'nav.catchup',
    icon: (
      <Icon>
        <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
        <path d="M3.5 4v4.5H8" />
        <path d="M12 8v4.2l3 1.8" />
      </Icon>
    ),
  },
  {
    href: '/shows',
    label: 'nav.shows',
    icon: (
      <Icon>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </Icon>
    ),
  },
  {
    href: '/perfil',
    label: 'nav.profile',
    icon: (
      <Icon>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
      </Icon>
    ),
  },
];
