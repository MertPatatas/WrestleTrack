'use client';

import Link from 'next/link';
import type { Storyline } from '../data/types';
import { useSettings } from '../i18n/SettingsProvider';
import { PromotionBadge } from './PromotionBadge';
import { formatDay, storyPeriod } from './storylines/format';

// Tarjeta de una storyline: de qué va, quién participa y su último avance. Abre su página.
export function StorylineCard({ item }: { item: Storyline }) {
  const { t, locale } = useSettings();
  const last = item.beats[item.beats.length - 1];
  const keyMoments = item.beats.filter((b) => b.importance === 3).length;

  return (
    <Link href={`/storyline/${item.id}`} className={`card card--link story-card brand-${item.promotion}`}>
      <div className="card-meta card-meta--between">
        <PromotionBadge id={item.promotion} />
        <span className={`story-status story-status--${item.status}`}>
          {t(item.status === 'active' ? 'storylines.ongoing' : 'storylines.closed')}
        </span>
      </div>
      <h3 className="card-title">{item.title}</h3>
      <p className="muted small">{storyPeriod(item, locale, t)}</p>
      <p className="card-text story-summary">{item.summary}</p>
      {item.participants.length ? (
        <p className="story-people">
          {item.participants.slice(0, 5).join(' · ')}
          {item.participants.length > 5 ? ` +${item.participants.length - 5}` : ''}
        </p>
      ) : null}
      {last ? (
        <div className="story-last">
          <span className="story-last-label">
            {t('storylines.lastBeat')} · {formatDay(last.date, locale)}
            {last.showName ? ` · ${last.showName}` : ''}
          </span>
          <span className="story-last-title">{last.title}</span>
        </div>
      ) : null}
      <p className="muted small">
        {t(item.beats.length === 1 ? 'storylines.beatsOne' : 'storylines.beats', { n: item.beats.length })}
        {keyMoments ? ` · ${t('storylines.keyMoments', { n: keyMoments })}` : ''}
      </p>
    </Link>
  );
}
