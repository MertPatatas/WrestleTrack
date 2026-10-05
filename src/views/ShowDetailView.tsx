'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RecapResults } from '../components/catchup/RecapResults';
import { VideoCard } from '../components/catchup/VideoCard';
import { HeroWithPoster } from '../components/NextEventHero';
import { PromoLogo } from '../components/PromoLogo';
import { REGIONS, detectRegion, whereToWatch, type Region } from '../data/broadcast';
import { isSpecial, type Show } from '../data/types';
import { useAppData } from '../data/useAppData';
import { useRecaps } from '../data/useRecaps';
import { useSettings } from '../i18n/SettingsProvider';
import type { MessageKey } from '../i18n/messages';
import { showDayKey, useFormat } from '../lib/dates';
import type { EventCard } from '../lib/schedule/card';

const REGION_KEY = 'wrestletrack:watch-region';

// Web oficial de los shows semanales sin cartelera publicada en un formato legible
const OFFICIAL_PAGES: Record<string, string> = {
  raw: 'https://www.wwe.com/shows/raw',
  smackdown: 'https://www.wwe.com/shows/smackdown',
  nxt: 'https://www.wwe.com/shows/wwenxt',
  'cmll-martes': 'https://cmll.com/cartelera/',
};

type CardState = { status: 'loading' } | { status: 'ready'; card: EventCard | null } | { status: 'error' };

function useCard(show: Show | undefined, ended: boolean): CardState | null {
  const [state, setState] = useState<CardState | null>(null);
  useEffect(() => {
    if (!show || ended) return;
    const params = new URLSearchParams({ id: show.id, kind: show.kind, promotion: show.promotion, date: show.eventDate });
    // La API solo necesita (y solo acepta) el enlace cuando la cartelera sale de Wikipedia
    if (show.url?.startsWith('https://en.wikipedia.org/wiki/')) params.set('url', show.url);
    if (show.night) params.set('night', String(show.night));
    let alive = true;
    setState({ status: 'loading' });
    fetch(`/api/card?${params}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ card: EventCard | null }>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => alive && setState({ status: 'ready', card: data.card }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => {
      alive = false;
    };
    // El show se identifica por su id; el resto de campos no cambian para el mismo id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show?.id, show?.url, ended]);
  return state;
}

export function ShowDetailView({ id }: { id: string }) {
  const data = useAppData();
  const fmt = useFormat();
  const { t, locale, timeZone, lang } = useSettings();
  const show = useMemo(() => data?.shows.find((s) => s.id === id), [data, id]);
  const [now, setNow] = useState(() => Date.now());
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Región para "dónde verlo": la elegida antes en este navegador o la detectada
  useEffect(() => {
    if (!timeZone) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(REGION_KEY);
    } catch {
      // sin almacenamiento: se usa la detectada
    }
    setRegion(REGIONS.includes(saved as Region) ? (saved as Region) : detectRegion(locale, timeZone));
  }, [locale, timeZone]);

  const changeRegion = (next: Region) => {
    setRegion(next);
    try {
      localStorage.setItem(REGION_KEY, next);
    } catch {
      // la elección dura solo esta visita
    }
  };

  const ended = show ? new Date(show.endsAt).getTime() <= now : false;
  const card = useCard(show, ended);
  // Ya emitido: resultados y vídeos de análisis ("Ponme al día")
  const recaps = useRecaps(ended);
  const recap = recaps.data?.recaps.find((r) => r.showId === id);
  const videos = (recaps.data?.videos ?? [])
    .filter((v) => v.showId === id)
    .sort((a, b) => Number(b.lang === lang) - Number(a.lang === lang) || b.publishedAt.localeCompare(a.publishedAt));

  if (!data || !fmt) {
    return (
      <div className="detail">
        <div className="skeleton-line skeleton-line--title" aria-hidden="true" />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="detail">
        <Link href="/shows" className="link">
          ← {t('detail.back')}
        </Link>
        <p className="empty">{t('detail.notFound')}</p>
      </div>
    );
  }

  const special = isSpecial(show);
  const name = show.night ? `${show.name} · ${t('shows.night', { n: show.night })}` : show.name;
  const status = show.timeTbd ? null : fmt.status(show.startsAt, show.endsAt, now);
  const time = show.timeTbd ? t('shows.tbdLong') : `${fmt.time(show.startsAt)}${show.timeApprox ? ` (${t('shows.approx')})` : ''}`;
  const watch = region ? whereToWatch(show, region) : null;
  const weeklyId = show.id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  const officialPage = show.kind === 'weekly' ? OFFICIAL_PAGES[weeklyId] : undefined;

  return (
    <article className="detail">
      <Link href="/shows" className="link">
        ← {t('detail.back')}
      </Link>

      <header className={`hero hero--static brand-${show.promotion}`}>
        <HeroWithPoster image={show.image}>
          {special ? <p className="hero-kicker">★ {t('shows.special')}</p> : null}
          <div className="hero-logo">
            <PromoLogo id={show.promotion} height={40} />
          </div>
          <h1 className="hero-title">{name}</h1>
          {status?.text || ended ? (
            <p className={status?.live ? 'hero-live' : 'hero-meta'}>{ended ? t('detail.finished') : status?.text}</p>
          ) : null}
        </HeroWithPoster>
      </header>

      <section className="card detail-facts">
        <div className="detail-fact">
          <span className="detail-label">{t('detail.when')}</span>
          <span>
            {fmt.dayHeading(showDayKey(show, fmt), now)} · {time}
          </span>
        </div>
        {show.venue ? (
          <div className="detail-fact">
            <span className="detail-label">{t('detail.venue')}</span>
            <span>{show.venue}</span>
          </div>
        ) : null}
        {show.tapedOn ? (
          <div className="detail-fact">
            <span className="detail-label">{t('detail.taped')}</span>
            <span>{fmt.shortDate(show.tapedOn)}</span>
          </div>
        ) : null}
        {show.note ? <p className="small show-note">{show.note}</p> : null}
        {show.url ? (
          <a className="link" href={show.url} target="_blank" rel="noopener noreferrer">
            {t('detail.moreInfo')} ↗
          </a>
        ) : null}
      </section>

      <section>
        <div className="section-head">
          <h2 className="section-title">{t('detail.watch')}</h2>
          {region ? (
            <select
              className="select select--compact"
              aria-label={t('detail.region')}
              value={region}
              onChange={(e) => changeRegion(e.target.value as Region)}
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`region.${r}` as MessageKey)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="card">
          {watch && watch.options.length > 0 ? (
            <ul className="watch-list">
              {watch.options.map((o) => (
                <li key={o.name}>
                  <span className="watch-name">{o.name}</span>
                  {o.note ? <span className="muted small"> · {t(`watch.${o.note}` as MessageKey)}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="card-text">{t('detail.watchUnknown')}</p>
          )}
          <p className="muted small setting-help">
            {t('detail.watchDisclaimer')}
            {watch?.moreUrl ? (
              <>
                {' '}
                <a className="link link--inline" href={watch.moreUrl} target="_blank" rel="noopener noreferrer">
                  {t('detail.watchMore')} ↗
                </a>
              </>
            ) : null}
          </p>
        </div>
      </section>

      <section>
        <h2 className="section-title section-title--solo">{t(ended ? 'detail.resultsTitle' : 'detail.card')}</h2>
        <div className="card">
          {ended ? (
            recap ? (
              <RecapResults recap={recap} />
            ) : recaps.status === 'loading' ? (
              <div aria-hidden="true">
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-line--short" />
              </div>
            ) : (
              <>
                <p className="card-text">{t('detail.noResults')}</p>
                {show.url ? (
                  <a className="link" href={show.url} target="_blank" rel="noopener noreferrer">
                    {t('detail.results')} ↗
                  </a>
                ) : null}
              </>
            )
          ) : !card || card.status === 'loading' ? (
            <div aria-hidden="true">
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
          ) : card.status === 'error' ? (
            <p className="card-text">{t('detail.cardError')}</p>
          ) : card.card ? (
            <>
              {card.card.note ? <p className="small show-note">{card.card.note}</p> : null}
              {card.card.matches.length ? (
                <ol className="match-list">
                  {card.card.matches.map((m, i, all) => (
                    <li key={i} className={m.group && m.group !== all[i - 1]?.group ? 'match-group-start' : undefined}>
                      {/* Parte del evento (noche, pre-show) al empezar cada una */}
                      {m.group && m.group !== all[i - 1]?.group ? <span className="match-group">{m.group}</span> : null}
                      {m.title ? <span className="match-title">{m.title.split(' / ')[0]}</span> : null}
                      <span className="match-participants">{m.participants}</span>
                      {/* Aclaraciones tras el tipo de combate ("el ganador se clasifica para…") */}
                      {m.title?.includes(' / ') ? (
                        <span className="muted small">{m.title.split(' / ').slice(1).join(' · ')}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
              <p className="muted small setting-help">
                {t('detail.cardSource')}{' '}
                <a className="link link--inline" href={card.card.source.url} target="_blank" rel="noopener noreferrer">
                  {card.card.source.name} ↗
                </a>
              </p>
            </>
          ) : (
            <>
              <p className="card-text">{t('detail.cardNone')}</p>
              {officialPage ? (
                <a className="link" href={officialPage} target="_blank" rel="noopener noreferrer">
                  {t('detail.officialSite')} ↗
                </a>
              ) : null}
            </>
          )}
        </div>
      </section>

      {ended && videos.length > 0 ? (
        <section>
          <h2 className="section-title section-title--solo">{t('detail.analysisTitle')}</h2>
          <div className="card">
            <div className="video-grid">
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} fmt={fmt} now={now} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
