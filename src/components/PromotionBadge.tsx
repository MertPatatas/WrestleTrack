'use client';

import type { BrandId } from '../data/brands';
import { useT } from '../i18n/SettingsProvider';
import { PromoLogo } from './PromoLogo';

// Etiqueta de la promoción (o de la marca: Raw, SmackDown, NXT) con su logo y su color
export function PromotionBadge({ id, size = 14 }: { id: BrandId; size?: number }) {
  const t = useT();
  return (
    <span className={`badge badge--promo brand-${id}`}>
      <PromoLogo id={id} height={size} label={id === 'other' ? t('promo.general') : undefined} />
    </span>
  );
}
