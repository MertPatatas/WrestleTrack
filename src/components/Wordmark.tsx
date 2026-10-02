'use client';

import Link from 'next/link';
import { useT } from '../i18n/SettingsProvider';

// Marca (anillo + W) y rótulo, a partir de los PNG de public/brand.
export function Wordmark({ large = false }: { large?: boolean }) {
  const t = useT();
  return (
    <Link href="/" className={large ? 'wordmark wordmark--large' : 'wordmark'} aria-label={t('brand.home')}>
      <img className="wordmark-mark" src="/brand/logo-mark.png" alt="" />
      <img className="wordmark-text" src="/brand/logo-text.png" alt="" />
    </Link>
  );
}
