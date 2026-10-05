'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FilterChips, type Filter } from '../components/FilterChips';
import { PageHeader } from '../components/PageHeader';
import { ShowRow } from '../components/ShowRow';
import { promotions } from '../data/mock';
import { isSpecial, type Show } from '../data/types';
import { useAppData } from '../data/useAppData';
import { useT } from '../i18n/SettingsProvider';
import { showDayKey, useFormat, utcOffsetLabel, type Formatter } from '../lib/dates';
import { checkScheduleData } from '../lib/schedule/build';
import { normalize } from '../lib/recaps/match';

type Tab = 'upcoming' | 'past';
type Kind = 'all' | 'weekly' | 'special';

const PROMO_NAMES = new Map(promotions.map((p) => [p.id, `${p.name} ${p.short}`]));

/** Texto en el que se busca: nombre, empresa, recinto y cadena, sin acentos ni mayúsculas. */
const searchText = (s: Show) => normalize([s.name, PROMO_NAMES.get(s.promotion), s.venue, s.broadcast].filter(Boolean).join(' '));

function groupByDay(shows: Show[], fmt: Formatter): [string, Show[]][] {
  const groups = new Map<string, Show[]>();
  for (const s of shows) {
    const key = showDayKey(s, fmt);
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

export function ShowsView() {
  const data = useAppData();
  const fmt = useFormat();
  const t = useT();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [filter, setFilter] = useState<Filter>('all');
  const [kind, setKind] = useState<Kind>('all');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // Refresca la cuenta atrás y el "En directo" cada minuto
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Avisa en desarrollo si hay errores en las correcciones manuales de src/data/schedule.ts
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') checkScheduleData().forEach((p) => console.warn(`[calendario] ${p}`));
  }, []);

  const index = useMemo(() => new Map((data?.shows ?? []).map((s) => [s.id, searchText(s)])), [data]);
  // Todas las palabras buscadas tienen que aparecer ("wwe rumble", "dynamite paris")
  const words = normalize(query).split(' ').filter(Boolean);
  const searching = words.length > 0;

  const matches = (data?.shows ?? [])
    .filter((s) => filter === 'all' || s.promotion === filter)
    .filter((s) => kind === 'all' || (kind === 'special') === isSpecial(s))
    .filter((s) => words.every((w) => index.get(s.id)?.includes(w)));
  // Un show sigue en "Próximos" mientras está en directo. Al buscar se muestran los dos.
  const isUpcoming = (s: Show) => new Date(s.endsAt).getTime() > now;
  const upcoming = matches.filter(isUpcoming);
  const past = matches.filter((s) => !isUpcoming(s)).reverse();
  const sections: { id: string; title?: string; days: [string, Show[]][] }[] = !fmt
    ? []
    : searching
      ? [
          { id: 'upcoming', title: t('shows.upcoming'), days: groupByDay(upcoming, fmt) },
          { id: 'past', title: t('shows.past'), days: groupByDay(past, fmt) },
        ].filter((sec) => sec.days.length)
      : [{ id: tab, days: groupByDay(tab === 'upcoming' ? upcoming : past, fmt) }];
  const count = searching ? matches.length : (tab === 'upcoming' ? upcoming : past).length;
  const ready = Boolean(data && fmt);

  return (
    <>
      <PageHeader title={t('shows.title')} />

      <div className="search">
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          className="input search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('shows.searchPlaceholder')}
          aria-label={t('shows.searchAria')}
          enterKeyHint="search"
        />
        {query ? (
          <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label={t('shows.searchClear')}>
            ×
          </button>
        ) : null}
      </div>

      <div className={`segment${searching ? ' segment--disabled' : ''}`} role="group" aria-label={t('shows.tabsAria')}>
        <button type="button" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
          {t('shows.upcoming')}
        </button>
        <button type="button" aria-pressed={tab === 'past'} onClick={() => setTab('past')}>
          {t('shows.past')}
        </button>
      </div>

      <FilterChips value={filter} onChange={setFilter} />
      <div className="kind-filter" role="group" aria-label={t('shows.kindAria')}>
        {(['all', 'weekly', 'special'] as const).map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {t(k === 'all' ? 'shows.kindAll' : k === 'weekly' ? 'shows.kindWeekly' : 'shows.kindSpecial')}
          </button>
        ))}
      </div>
      {fmt ? (
        <p className="muted small tz">
          {t('shows.timesIn', { tz: `${fmt.timeZone} (${utcOffsetLabel(fmt.timeZone, now)})` })}{' '}
          <Link href="/perfil" className="link link--inline">
            {t('common.change')}
          </Link>
          {' · '}
          <span className="show-star">★</span> {t('shows.specialLegend')}
        </p>
      ) : null}

      {searching && ready ? (
        <p className="muted small search-count" aria-live="polite">
          {t(count === 1 ? 'shows.searchOne' : 'shows.searchCount', { n: count })}
        </p>
      ) : null}

      {fmt
        ? sections.map((sec) => (
            <div key={sec.id} className="fade-in">
              {sec.title ? <h2 className="section-title section-title--solo">{sec.title}</h2> : null}
              {sec.days.map(([day, shows]) => (
                <section key={day} className="day-group" aria-label={fmt.dayHeading(day, now)}>
                  <h3 className="day-heading">{fmt.dayHeading(day, now)}</h3>
                  <div className="stack stack--tight">
                    {shows.map((s) => (
                      <ShowRow key={s.id} show={s} fmt={fmt} now={now} variant="day" />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ))
        : null}
      {ready && count === 0 ? <p className="empty">{t(searching ? 'shows.searchEmpty' : 'shows.empty')}</p> : null}

      {ready ? (
        <p className="muted small sources">
          {data?.scheduleLive ? t('shows.footerLive') : t('shows.footerOffline')} {t('shows.footerLegend')}
        </p>
      ) : null}
    </>
  );
}
