'use client';

import { promotions } from '../data/mock';
import type { PromotionId } from '../data/types';
import { useT } from '../i18n/SettingsProvider';

export type Filter = PromotionId | 'all';

export function FilterChips({
  value,
  onChange,
  includeGeneral = false,
}: {
  value: Filter;
  onChange: (next: Filter) => void;
  includeGeneral?: boolean;
}) {
  const t = useT();
  const options: { id: Filter; label: string }[] = [
    { id: 'all', label: t('filter.all') },
    ...promotions
      .filter((p) => includeGeneral || p.id !== 'other')
      .map((p) => ({ id: p.id as Filter, label: p.id === 'other' ? t('promo.general') : p.name })),
  ];
  return (
    <div className="chips" role="group" aria-label={t('filter.aria')}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="chip"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
