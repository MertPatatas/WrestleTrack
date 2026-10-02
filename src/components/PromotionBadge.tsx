'use client';

import { promotions } from '../data/mock';
import type { PromotionId } from '../data/types';
import { useT } from '../i18n/SettingsProvider';

export function PromotionBadge({ id }: { id: PromotionId }) {
  const t = useT();
  const label = id === 'other' ? t('promo.general') : (promotions.find((p) => p.id === id)?.short ?? id);
  return <span className="badge">{label}</span>;
}
