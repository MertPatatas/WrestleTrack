import type { Show } from '../data/types';
import { showDateParts } from '../lib/dates';
import { PromotionBadge } from './PromotionBadge';

export function ShowRow({ show }: { show: Show }) {
  const { day, month, time } = showDateParts(show.startsAt);
  return (
    <div className="show-row">
      <div className="show-date">
        <span className="show-month">{month}</span>
        <span className="show-day">{day}</span>
      </div>
      <div className="show-info">
        <p className="show-name">{show.name}</p>
        <p className="muted small">{show.venue ? `${show.venue} · ${time}` : time}</p>
      </div>
      <PromotionBadge id={show.promotion} />
    </div>
  );
}
