'use client';

import Link from 'next/link';
import { useAppData } from '../data/useAppData';
import { useT } from '../i18n/SettingsProvider';
import { useFormat } from '../lib/dates';
import { ShowRow } from './ShowRow';

// Columna lateral que solo aparece en escritorio.
export function UpcomingRail() {
  const data = useAppData();
  const fmt = useFormat();
  const t = useT();
  const now = Date.now();
  const upcoming = data ? data.shows.filter((s) => new Date(s.endsAt).getTime() > now).slice(0, 5) : [];

  return (
    <section>
      <div className="section-head">
        <h2 className="section-title">{t('home.upcoming')}</h2>
        <Link href="/shows" className="link">
          {t('common.seeAll')}
        </Link>
      </div>
      <div className="stack stack--tight">
        {fmt ? upcoming.map((s) => <ShowRow key={s.id} show={s} fmt={fmt} now={now} />) : null}
      </div>
    </section>
  );
}
