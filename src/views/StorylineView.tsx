'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PromoLogo } from '../components/PromoLogo';
import { StorylineCard } from '../components/StorylineCard';
import { formatDay, formatMonth, KIND_LABELS, storyPeriod } from '../components/storylines/format';
import type { StorylineBeat } from '../data/types';
import { useStorylines } from '../data/useStorylines';
import { useSettings } from '../i18n/SettingsProvider';

// PÁGINA DE UNA STORYLINE: en qué punto está, quién participa, su cronología completa (de la más
// antigua a la más reciente, agrupada por meses) y las storylines que le dan contexto.
export function StorylineView({ id }: { id: string }) {
  const { storylines, status, reload } = useStorylines();
  const { t, locale } = useSettings();
  const [onlyKey, setOnlyKey] = useState(false);
  const story = storylines?.find((s) => s.id === id);

  // Contexto: las que esta cita y las que citan a esta
  const context = useMemo(
    () => (storylines ?? []).filter((s) => s.id !== id && (story?.related.includes(s.id) || s.related.includes(id))),
    [storylines, story, id],
  );

  // Avances agrupados por mes
  const months = useMemo(() => {
    const groups: { month: string; beats: StorylineBeat[] }[] = [];
    for (const beat of story?.beats ?? []) {
      if (onlyKey && beat.importance < 3) continue;
      const month = beat.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last?.month === month) last.beats.push(beat);
      else groups.push({ month, beats: [beat] });
    }
    return groups;
  }, [story, onlyKey]);

  const back = (
    <Link href="/al-dia?tab=storylines" className="link">
      ← {t('storylines.back')}
    </Link>
  );

  if (!storylines) {
    return (
      <div className="detail">
        {back}
        {status === 'error' ? (
          <div className="empty">
            <p>{t('storylines.error')}</p>
            <button type="button" className="button button--ghost catchup-retry" onClick={reload}>
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <div className="card" aria-hidden="true">
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
          </div>
        )}
      </div>
    );
  }

  if (!story) {
    return (
      <div className="detail">
        {back}
        <p className="empty">{t('storylines.notFound')}</p>
      </div>
    );
  }

  const keyCount = story.beats.filter((b) => b.importance === 3).length;
  const latest = story.beats[story.beats.length - 1];

  return (
    <article className="detail story-detail">
      {back}

      <header className={`card story-hero brand-${story.promotion}`}>
        <div className="card-meta card-meta--between">
          <PromoLogo id={story.promotion} height={28} />
          <span className={`story-status story-status--${story.status}`}>
            {t(story.status === 'active' ? 'storylines.ongoing' : 'storylines.closed')}
          </span>
        </div>
        <h1 className="story-title">{story.title}</h1>
        <p className="muted small">{storyPeriod(story, locale, t)}</p>
        {story.participants.length ? (
          <ul className="story-chips" aria-label={t('storylines.participants')}>
            {story.participants.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
      </header>

      <section className="card">
        <h2 className="section-title">{t(story.status === 'active' ? 'storylines.whereNow' : 'storylines.howEnded')}</h2>
        <p className="card-text story-summary-full">{story.summary}</p>
        {latest && story.status === 'active' ? (
          <p className="muted small">
            {t('storylines.lastBeat')}: {formatDay(latest.date, locale)}
            {latest.showName ? ` · ${latest.showName}` : ''}
          </p>
        ) : null}
      </section>

      {context.length ? (
        <section>
          <h2 className="section-title section-title--solo">{t('storylines.context')}</h2>
          <p className="muted small notice">{t('storylines.contextHelp')}</p>
          <div className="stack stack--grid">
            {context.map((s) => (
              <StorylineCard key={s.id} item={s} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="section-head">
          <h2 className="section-title">{t('storylines.chronology')}</h2>
          {keyCount ? (
            <button type="button" className="chip" aria-pressed={onlyKey} onClick={() => setOnlyKey((v) => !v)}>
              ★ {t('storylines.onlyKey')}
            </button>
          ) : null}
        </div>

        {months.length === 0 ? <p className="empty">{t('storylines.noBeats')}</p> : null}
        <ol className={`chrono brand-${story.promotion}`}>
          {months.map((m) => (
            <li key={m.month} className="chrono-month">
              <h3 className="chrono-month-label">{formatMonth(`${m.month}-01`, locale)}</h3>
              <ol className="chrono-list">
                {m.beats.map((b) => (
                  <li key={b.id} className={`chrono-item chrono-item--${b.importance} fade-in`}>
                    <span className="chrono-node" aria-hidden="true" />
                    <div className="chrono-body">
                      <div className="chrono-meta">
                        <span className="muted small">
                          {formatDay(b.date, locale)}
                          {b.showName ? ` · ${b.showName}` : ''}
                        </span>
                        <span className={`beat-kind${b.importance === 3 ? ' beat-kind--key' : ''}`}>
                          {b.importance === 3 ? '★ ' : ''}
                          {t(KIND_LABELS[b.kind])}
                        </span>
                      </div>
                      <h4 className="chrono-title">{b.title}</h4>
                      <p className="card-text">{b.text}</p>
                      {b.sourceUrl ? (
                        <a className="link chrono-source" href={b.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {t('storylines.source')} ↗
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </section>

      <p className="muted small story-disclaimer">{t('storylines.disclaimer')}</p>
    </article>
  );
}
