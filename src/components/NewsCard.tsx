'use client';

import { useState } from 'react';
import type { NewsItem } from '../data/types';
import { useFormat } from '../lib/dates';
import { PromotionBadge } from './PromotionBadge';
import './news.css';

export function NewsCard({ item, now }: { item: NewsItem; now: number }) {
  const [imageOk, setImageOk] = useState(true);
  const fmt = useFormat();

  return (
    <a className="card card--link" href={item.url} target="_blank" rel="noopener noreferrer">
      <div className="news-body">
        <div className="news-text">
          <div className="card-meta">
            <PromotionBadge id={item.promotion} />
            <span className="muted small">{fmt?.timeAgo(item.publishedAt, now)}</span>
          </div>
          <h3 className="card-title clamp-3">{item.title}</h3>
          {item.excerpt ? <p className="card-text clamp-3">{item.excerpt}</p> : null}
          <span className="muted small">
            {item.source}
            {item.lang ? ` · ${item.lang.toUpperCase()}` : ''}
          </span>
        </div>
        {item.image && imageOk ? (
          // Miniatura de la propia fuente; si no carga, se oculta.
          <img
            className="news-thumb"
            src={item.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageOk(false)}
          />
        ) : null}
      </div>
    </a>
  );
}
