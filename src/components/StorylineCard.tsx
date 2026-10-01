import type { Storyline } from '../data/types';
import { timeAgo } from '../lib/dates';
import { PromotionBadge } from './PromotionBadge';

export function StorylineCard({ item, now }: { item: Storyline; now: number }) {
  const last = item.updates[0];
  return (
    <article className="card">
      <div className="card-meta card-meta--between">
        <PromotionBadge id={item.promotion} />
        <span className="status">{item.status === 'en_curso' ? 'En curso' : 'Cerrada'}</span>
      </div>
      <h3 className="card-title">{item.title}</h3>
      <p className="card-text">{item.subtitle}</p>
      {last ? (
        <div className="update">
          <p className={last.advanced ? 'verdict verdict--yes' : 'verdict'}>
            {last.advanced ? `Avanzó en ${last.showName}` : `Sin avance en ${last.showName}`}
            {' · '}
            {timeAgo(last.date, now)}
          </p>
          <p className="card-text">{last.summary}</p>
        </div>
      ) : null}
    </article>
  );
}
