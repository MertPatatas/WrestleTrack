'use client';

import { useT } from '../i18n/SettingsProvider';

// Quitar cuando los datos sean reales.
export function SampleNotice({ text }: { text?: string }) {
  const t = useT();
  return <p className="muted small notice">{text ?? t('sample.default')}</p>;
}
