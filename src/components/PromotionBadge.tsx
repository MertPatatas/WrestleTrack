import { promotions } from '../data/mock';
import type { PromotionId } from '../data/types';

export function PromotionBadge({ id }: { id: PromotionId }) {
  const label = promotions.find((p) => p.id === id)?.short ?? id;
  return <span className="badge">{label}</span>;
}
