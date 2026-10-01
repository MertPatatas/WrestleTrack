'use client';

import { useState } from 'react';
import { FilterChips, type Filter } from '../components/FilterChips';
import { NewsCard } from '../components/NewsCard';
import { PageHeader } from '../components/PageHeader';
import { SampleNotice } from '../components/SampleNotice';
import { useAppData } from '../data/useAppData';

export function NewsView() {
  const data = useAppData();
  const [filter, setFilter] = useState<Filter>('all');
  const now = Date.now();
  const items = (data?.news ?? []).filter((n) => filter === 'all' || n.promotion === filter);

  return (
    <>
      <PageHeader title="Noticias" />
      <SampleNotice />
      <FilterChips value={filter} onChange={setFilter} includeGeneral />
      <div className="stack stack--grid">
        {items.map((n) => (
          <NewsCard key={n.id} item={n} now={now} />
        ))}
      </div>
      {data && items.length === 0 ? (
        <p className="empty">No hay noticias de esta promoción por ahora.</p>
      ) : null}
    </>
  );
}
