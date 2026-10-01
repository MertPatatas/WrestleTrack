'use client';

import { useState } from 'react';
import { FilterChips, type Filter } from '../components/FilterChips';
import { PageHeader } from '../components/PageHeader';
import { SampleNotice } from '../components/SampleNotice';
import { StorylineCard } from '../components/StorylineCard';
import { useAppData } from '../data/useAppData';

export function StorylinesView() {
  const data = useAppData();
  const [filter, setFilter] = useState<Filter>('all');
  const now = Date.now();
  const items = (data?.storylines ?? []).filter((s) => filter === 'all' || s.promotion === filter);

  return (
    <>
      <PageHeader title="Storylines" />
      <SampleNotice />
      <FilterChips value={filter} onChange={setFilter} />
      <div className="stack stack--grid">
        {items.map((s) => (
          <StorylineCard key={s.id} item={s} now={now} />
        ))}
      </div>
      {data && items.length === 0 ? (
        <p className="empty">Todavía no seguimos storylines de esta promoción.</p>
      ) : null}
    </>
  );
}
