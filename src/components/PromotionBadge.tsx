'use client';

import type { PromotionId } from '../data/types';
import { useT } from '../i18n/SettingsProvider';
import { PromoLogo } from './PromoLogo';

// Etiqueta de la promoción con su logo y su color
export function PromotionBadge({ id, size = 14 }: { id: PromotionId; size?: number }) {
  const t = useT();
  return (
    <span className={`badge badge--promo brand-${id}`}>
      <PromoLogo id={id} height={size} label={id === 'other' ? t('promo.general') : undefined} />
    </span>
  );
}
