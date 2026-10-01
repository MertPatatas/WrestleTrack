'use client';

import { promotions } from '../data/mock';
import type { PromotionId } from '../data/types';

export type Filter = PromotionId | 'all';

export function FilterChips({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (next: Filter) => void;
}) {
  const options: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    ...promotions.map((p) => ({ id: p.id as Filter, label: p.name })),
  ];
  return (
    <div className="chips" role="group" aria-label="Filtrar por promoción">
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
