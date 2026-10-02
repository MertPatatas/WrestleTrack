'use client';

import type { Storyline } from '../data/types';
import { useT } from '../i18n/SettingsProvider';
import { useFormat } from '../lib/dates';
import { PromotionBadge } from './PromotionBadge';

export function StorylineCard({ item, now }: { item: Storyline; now: number }) {
  const t = useT();
  const fmt = useFormat();
  const last = item.updates[0];
  return (
    <article className="card">
      <div className="card-meta card-meta--between">
        <PromotionBadge id={item.promotion} />
        <span className="status">{item.status === 'en_curso' ? t('storylines.ongoing') : t('storylines.closed')}</span>
      </div>
      <h3 className="card-title">{item.title}</h3>
      <p className="card-text">{item.subtitle}</p>
      {last ? (
        <div className="update">
          <p className={last.advanced ? 'verdict verdict--yes' : 'verdict'}>
            {last.advanced
              ? t('storylines.advanced', { show: last.showName })
              : t('storylines.noAdvance', { show: last.showName })}
            {fmt ? ` · ${fmt.timeAgo(last.date, now)}` : null}
          </p>
          <p className="card-text">{last.summary}</p>
        </div>
      ) : null}
    </article>
  );
}
