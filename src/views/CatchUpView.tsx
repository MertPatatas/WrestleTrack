'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AnimatedDetails } from '../components/AnimatedDetails';
import { RecapResults } from '../components/catchup/RecapResults';
import { VideoCard } from '../components/catchup/VideoCard';
import { FilterChips, type Filter } from '../components/FilterChips';
import { PageHeader } from '../components/PageHeader';
import { PromotionBadge } from '../components/PromotionBadge';
import { SampleNotice } from '../components/SampleNotice';
import { StorylineCard } from '../components/StorylineCard';
import { CATCHUP_TABS, type CatchUpTab } from '../data/catchup';
import { isSpecial, type AnalysisVideo, type PromotionId, type Show } from '../data/types';
import { useAppData } from '../data/useAppData';
import { useRecaps } from '../data/useRecaps';
import { useSettings } from '../i18n/SettingsProvider';
import { showDayKey, type Formatter, useFormat } from '../lib/dates';

const TAB_LABELS = { resumenes: 'catchup.recaps', analisis: 'catchup.analysis', storylines: 'catchup.storylines' } as const;
const VIDEO_SCOPE_KEY = 'wrestletrack:videos-lang';

/** Datos del show para la cabecera: los del calendario o, si ya no está, los guardados. */
interface ShowInfo {
  id: string;
  name: string;
  promotion: PromotionId;
  day: string; // 'YYYY-MM-DD'
  special: boolean;
  sortKey: string;
}

function showInfo(id: string, fallback: { name: string; promotion: PromotionId; eventDate: string }, shows: Map<string, Show>, fmt: Formatter, nightLabel: (n: number) => string): ShowInfo {
  const show = shows.get(id);
  if (!show) {
    return { id, name: fallback.name, promotion: fallback.promotion, day: fallback.eventDate, special: false, sortKey: fallback.eventDate };
  }
  return {
    id,
    name: show.night ? `${show.name} · ${nightLabel(show.night)}` : show.name,
    promotion: show.promotion,
    day: showDayKey(show, fmt),
    special: isSpecial(show),
    sortKey: show.startsAt,
  };
}

function ShowHeading({ info, fmt, now }: { info: ShowInfo; fmt: Formatter; now: number }) {
  return (
    <div className={`recap-head brand-${info.promotion}`}>
      <PromotionBadge id={info.promotion} />
      <div className="recap-head-text">
        <p className="recap-name">
          {info.special ? <span className="show-star">★ </span> : null}
          {info.name}
        </p>
        <p className="muted small">{fmt.dayHeading(info.day, now)}</p>
      </div>
    </div>
  );
}

export function CatchUpView({ initialTab }: { initialTab: CatchUpTab }) {
  const router = useRouter();
  const app = useAppData();
  const { data, status, reload } = useRecaps();
  const fmt = useFormat();
  const { t, lang } = useSettings();
  const [tab, setTab] = useState<CatchUpTab>(initialTab);
  const [filter, setFilter] = useState<Filter>('all');
  // Vídeos: por defecto todos los idiomas (los del idioma de la app van primero en cada show)
  const [scope, setScope] = useState<'device' | 'all'>('all');
  const now = Date.now();

  useEffect(() => {
    try {
      if (localStorage.getItem(VIDEO_SCOPE_KEY) === 'device') setScope('device');
    } catch {
      // almacenamiento no disponible: idioma del dispositivo
    }
  }, []);

  const changeTab = (next: CatchUpTab) => {
    setTab(next);
    router.replace(next === 'resumenes' ? '/al-dia' : `/al-dia?tab=${next}`, { scroll: false });
  };

  const changeScope = (next: 'device' | 'all') => {
    setScope(next);
    try {
      localStorage.setItem(VIDEO_SCOPE_KEY, next);
    } catch {
      // sin almacenamiento, solo para esta visita
    }
  };

  const shows = useMemo(() => new Map((app?.shows ?? []).map((s) => [s.id, s])), [app]);
  const nightLabel = (n: number) => t('shows.night', { n });
  const matchesFilter = (promotion: PromotionId) => filter === 'all' || promotion === filter;

  // Resúmenes: del show más reciente al más antiguo
  const recaps = useMemo(() => {
    if (!data || !fmt) return [];
    return data.recaps
      .map((r) => ({ recap: r, info: showInfo(r.showId, r, shows, fmt, nightLabel) }))
      .sort((a, b) => b.info.sortKey.localeCompare(a.info.sortKey));
    // nightLabel depende solo de t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, fmt, shows, t]);

  // Análisis: vídeos agrupados por show
  const videoCount = useMemo(() => {
    const count = new Map<string, number>();
    for (const v of data?.videos ?? []) count.set(v.showId, (count.get(v.showId) ?? 0) + 1);
    return count;
  }, [data]);

  const videoGroups = useMemo(() => {
    if (!data || !fmt) return [];
    const groups = new Map<string, AnalysisVideo[]>();
    for (const v of data.videos) {
      if (scope === 'device' && v.lang !== lang) continue;
      groups.set(v.showId, [...(groups.get(v.showId) ?? []), v]);
    }
    const recapOf = new Map(data.recaps.map((r) => [r.showId, r]));
    return [...groups.entries()]
      .map(([showId, videos]) => {
        const r = recapOf.get(showId);
        // Sin el show en el calendario ni resultados guardados, la fecha sale del primer vídeo
        const fallback = r ?? { name: showId, promotion: 'other' as PromotionId, eventDate: videos[videos.length - 1].publishedAt.slice(0, 10) };
        const info = showInfo(showId, fallback, shows, fmt, nightLabel);
        // Primero los del idioma de la app
        videos.sort((a, b) => Number(b.lang === lang) - Number(a.lang === lang) || b.publishedAt.localeCompare(a.publishedAt));
        return { info, videos, known: shows.has(showId) || Boolean(r) };
      })
      .filter((g) => g.known)
      .sort((a, b) => b.info.sortKey.localeCompare(a.info.sortKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, fmt, shows, scope, lang, t]);

  const storylines = (app?.storylines ?? []).filter((s) => matchesFilter(s.promotion));
  const shownRecaps = recaps.filter((r) => matchesFilter(r.info.promotion));
  const shownGroups = videoGroups.filter((g) => matchesFilter(g.info.promotion));
  const loading = (status === 'loading' && !data) || !fmt;

  return (
    <>
      <PageHeader title={t('catchup.title')} />
      <div className="segment" role="group" aria-label={t('catchup.sections')}>
        {CATCHUP_TABS.map((id) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => changeTab(id)}>
            {t(TAB_LABELS[id])}
          </button>
        ))}
      </div>
      <FilterChips value={filter} onChange={setFilter} />

      {tab === 'storylines' ? (
        <>
          <SampleNotice />
          <div className="stack stack--grid">
            {storylines.map((s) => (
              <StorylineCard key={s.id} item={s} now={now} />
            ))}
          </div>
          {app && storylines.length === 0 ? <p className="empty">{t('storylines.empty')}</p> : null}
        </>
      ) : status === 'error' && !data ? (
        <div className="empty">
          <p>{t('catchup.error')}</p>
          <button type="button" className="button button--ghost catchup-retry" onClick={reload}>
            {t('common.retry')}
          </button>
        </div>
      ) : loading ? (
        <div className="stack" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card">
              <div className="skeleton-line skeleton-line--title" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
          ))}
        </div>
      ) : tab === 'resumenes' ? (
        <>
          <p className="muted small notice">{t('catchup.recapsIntro')}</p>
          <div className="stack">
            {shownRecaps.map(({ recap, info }) => {
              const matches = recap.items.filter((i) => !i.segment).length;
              const videos = videoCount.get(recap.showId) ?? 0;
              return (
                <AnimatedDetails
                  key={recap.showId}
                  className="card recap-card"
                  summary={
                    <>
                      <ShowHeading info={info} fmt={fmt!} now={now} />
                      <span className="recap-toggle">
                        <span className="recap-toggle-label">{t('catchup.showResults')}</span> ({matches})
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </>
                  }
                >
                  <RecapResults recap={recap} />
                  <div className="recap-links">
                    {shows.has(recap.showId) ? (
                      <Link className="link" href={`/shows/${encodeURIComponent(recap.showId)}`}>
                        {t('catchup.viewShow')} →
                      </Link>
                    ) : null}
                    {videos > 0 ? (
                      <button type="button" className="link link-button" onClick={() => changeTab('analisis')}>
                        ▶ {t(videos === 1 ? 'catchup.videosOne' : 'catchup.videos', { n: videos })}
                      </button>
                    ) : null}
                  </div>
                </AnimatedDetails>
              );
            })}
          </div>
          {shownRecaps.length === 0 ? <p className="empty">{t('catchup.recapsEmpty')}</p> : null}
        </>
      ) : (
        <>
          <div className="segment" role="group" aria-label={t('catchup.videosLangAria')}>
            <button type="button" aria-pressed={scope === 'device'} onClick={() => changeScope('device')}>
              {t(lang === 'es' ? 'news.lang.es' : 'news.lang.en')}
            </button>
            <button type="button" aria-pressed={scope === 'all'} onClick={() => changeScope('all')}>
              {t('news.allLangs')}
            </button>
          </div>
          <p className="muted small notice">{t('catchup.analysisIntro')}</p>
          <div className="stack">
            {shownGroups.map(({ info, videos }) => (
              <section key={info.id} className="card video-group">
                <div className="video-group-head">
                  <ShowHeading info={info} fmt={fmt!} now={now} />
                  {shows.has(info.id) ? (
                    <Link className="link" href={`/shows/${encodeURIComponent(info.id)}`}>
                      {t('catchup.viewShow')} →
                    </Link>
                  ) : null}
                </div>
                <div className="video-grid">
                  {videos.map((v) => (
                    <VideoCard key={v.id} video={v} fmt={fmt!} now={now} />
                  ))}
                </div>
              </section>
            ))}
          </div>
          {shownGroups.length === 0 ? <p className="empty">{t('catchup.analysisEmpty')}</p> : null}
        </>
      )}
    </>
  );
}
