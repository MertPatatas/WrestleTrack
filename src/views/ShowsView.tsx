'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FilterChips, type Filter } from '../components/FilterChips';
import { PageHeader } from '../components/PageHeader';
import { ShowRow } from '../components/ShowRow';
import type { Show } from '../data/types';
import { useAppData } from '../data/useAppData';
import { useT } from '../i18n/SettingsProvider';
import { showDayKey, useFormat, utcOffsetLabel, type Formatter } from '../lib/dates';
import { checkScheduleData } from '../lib/schedule/build';

type Tab = 'upcoming' | 'past';

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

  // Un show sigue en "Próximos" mientras está en directo
  const items = (data?.shows ?? [])
    .filter((s) => filter === 'all' || s.promotion === filter)
    .filter((s) => (new Date(s.endsAt).getTime() > now) === (tab === 'upcoming'));
  if (tab === 'past') items.reverse();
  const days = fmt ? groupByDay(items, fmt) : [];
  const ready = Boolean(data && fmt);

  return (
    <>
      <PageHeader title={t('shows.title')} />

      <div className="segment" role="group" aria-label={t('shows.tabsAria')}>
        <button type="button" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
          {t('shows.upcoming')}
        </button>
        <button type="button" aria-pressed={tab === 'past'} onClick={() => setTab('past')}>
          {t('shows.past')}
        </button>
      </div>

      <FilterChips value={filter} onChange={setFilter} />
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

      {fmt
        ? days.map(([day, shows]) => (
            <section key={day} className="day-group" aria-label={fmt.dayHeading(day, now)}>
              <h2 className="day-heading">{fmt.dayHeading(day, now)}</h2>
              <div className="stack stack--tight">
                {shows.map((s) => (
                  <ShowRow key={s.id} show={s} fmt={fmt} now={now} variant="day" />
                ))}
              </div>
            </section>
          ))
        : null}
      {ready && items.length === 0 ? <p className="empty">{t('shows.empty')}</p> : null}

      {ready ? (
        <p className="muted small sources">
          {data?.scheduleLive ? t('shows.footerLive') : t('shows.footerOffline')} {t('shows.footerLegend')}
        </p>
      ) : null}
    </>
  );
}
