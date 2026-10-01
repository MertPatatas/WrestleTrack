import type { NewsItem } from '../data/types';
import { timeAgo } from '../lib/dates';
import { PromotionBadge } from './PromotionBadge';

export function NewsCard({ item, now }: { item: NewsItem; now: number }) {
  return (
    <a className="card card--link" href={item.url} target="_blank" rel="noopener noreferrer">
      <div className="card-meta">
        <PromotionBadge id={item.promotion} />
        <span className="muted small">{timeAgo(item.publishedAt, now)}</span>
      </div>
      <h3 className="card-title">{item.title}</h3>
      <p className="card-text">{item.excerpt}</p>
      <span className="muted small">{item.source}</span>
    </a>
  );
}
