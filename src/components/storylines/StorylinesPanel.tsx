'use client';

import { useEffect, useState } from 'react';
import type { PromotionId } from '../../data/types';
import { sortStorylines, useStorylines } from '../../data/useStorylines';
import { useT } from '../../i18n/SettingsProvider';
import { StorylineCard } from '../StorylineCard';
import { StoryTimeline } from './StoryTimeline';

type View = 'list' | 'timeline';
const VIEW_KEY = 'wrestletrack:storylines-view';

// Pestaña "Storylines" de Ponme al día: en lista (en curso y pasadas) o en línea de tiempo
export function StorylinesPanel({ promotion }: { promotion: PromotionId | 'all' }) {
  const t = useT();
  const { storylines, status, reload } = useStorylines();
  const [view, setView] = useState<View>('list');

  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === 'timeline') setView('timeline');
    } catch {
      // sin almacenamiento: lista
    }
  }, []);

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // solo para esta visita
    }
  };

  const items = sortStorylines((storylines ?? []).filter((s) => promotion === 'all' || s.promotion === promotion));
  const active = items.filter((s) => s.status === 'active');
  const past = items.filter((s) => s.status === 'closed');

  if (!storylines) {
    return status === 'error' ? (
      <div className="empty">
        <p>{t('storylines.error')}</p>
        <button type="button" className="button button--ghost catchup-retry" onClick={reload}>
          {t('common.retry')}
        </button>
      </div>
    ) : (
      <div className="stack stack--grid" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="card">
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="view-switch" role="group" aria-label={t('storylines.viewAria')}>
        <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          {t('storylines.viewList')}
        </button>
        <button type="button" aria-pressed={view === 'timeline'} onClick={() => changeView('timeline')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 12h18M7 8v8M12 6v12M17 9v6" />
          </svg>
          {t('storylines.viewTimeline')}
        </button>
      </div>
      <p className="muted small notice">{t('storylines.intro')}</p>

      {items.length === 0 ? (
        <p className="empty">{t('storylines.empty')}</p>
      ) : view === 'timeline' ? (
        <div className="fade-in">
          <StoryTimeline storylines={items} />
        </div>
      ) : (
        <div className="fade-in">
          {active.length ? (
            <>
              <h2 className="section-title section-title--solo">{t('storylines.activeTitle')}</h2>
              <div className="stack stack--grid">
                {active.map((s) => (
                  <StorylineCard key={s.id} item={s} />
                ))}
              </div>
            </>
          ) : null}
          {past.length ? (
            <>
              <h2 className="section-title section-title--solo">{t('storylines.pastTitle')}</h2>
              <p className="muted small notice">{t('storylines.pastHelp')}</p>
              <div className="stack stack--grid">
                {past.map((s) => (
                  <StorylineCard key={s.id} item={s} />
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
