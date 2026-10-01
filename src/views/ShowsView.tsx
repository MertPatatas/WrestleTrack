'use client';

import { useState } from 'react';
import { FilterChips, type Filter } from '../components/FilterChips';
import { PageHeader } from '../components/PageHeader';
import { SampleNotice } from '../components/SampleNotice';
import { ShowRow } from '../components/ShowRow';
import { useAppData } from '../data/useAppData';
import { deviceTimeZone } from '../lib/dates';

type Tab = 'upcoming' | 'past';

export function ShowsView() {
  const data = useAppData();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [filter, setFilter] = useState<Filter>('all');

  const now = Date.now();
  const items = (data?.shows ?? [])
    .filter((s) => filter === 'all' || s.promotion === filter)
    .filter((s) => (new Date(s.startsAt).getTime() > now) === (tab === 'upcoming'));
  if (tab === 'past') items.reverse();

  return (
    <>
      <PageHeader title="Calendario de shows" />
      <SampleNotice />

      <div className="segment" role="group" aria-label="Tipo de lista">
        <button type="button" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
          Próximos
        </button>
        <button type="button" aria-pressed={tab === 'past'} onClick={() => setTab('past')}>
          Pasados
        </button>
      </div>

      <FilterChips value={filter} onChange={setFilter} />
      {data ? (
        <p className="muted small tz">Horas en tu zona horaria ({deviceTimeZone()})</p>
      ) : null}

      <div className="stack stack--tight">
        {items.map((s) => (
          <ShowRow key={s.id} show={s} />
        ))}
      </div>
      {data && items.length === 0 ? <p className="empty">No hay shows en esta lista.</p> : null}
    </>
  );
}
