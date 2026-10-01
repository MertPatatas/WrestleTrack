'use client';

import Link from 'next/link';
import { useAppData } from '../data/useAppData';
import { ShowRow } from './ShowRow';

// Columna lateral que solo aparece en escritorio.
export function UpcomingRail() {
  const data = useAppData();
  const now = Date.now();
  const upcoming = data
    ? data.shows.filter((s) => new Date(s.startsAt).getTime() > now).slice(0, 5)
    : [];

  return (
    <section>
      <div className="section-head">
        <h2 className="section-title">Próximos shows</h2>
        <Link href="/shows" className="link">
          Ver todo
        </Link>
      </div>
      <div className="stack stack--tight">
        {upcoming.map((s) => (
          <ShowRow key={s.id} show={s} />
        ))}
      </div>
    </section>
  );
}
