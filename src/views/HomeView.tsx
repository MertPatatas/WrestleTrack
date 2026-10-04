'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NewsCard } from '../components/NewsCard';
import { NewsSkeleton } from '../components/NewsSkeleton';
import { NextEventHero } from '../components/NextEventHero';
import { PageHeader } from '../components/PageHeader';
import { SampleNotice } from '../components/SampleNotice';
import { ShowRow } from '../components/ShowRow';
import { StorylineCard } from '../components/StorylineCard';
import { useAppData } from '../data/useAppData';
import { useNews } from '../data/useNews';
import { useT } from '../i18n/SettingsProvider';
import { useFormat } from '../lib/dates';

function SectionHead({ title, href }: { title: string; href: string }) {
  const t = useT();
  return (
    <div className="section-head">
      <h2 className="section-title">{title}</h2>
      <Link href={href} className="link">
        {t('common.seeAll')}
      </Link>
    </div>
  );
}

export function HomeView() {
  const data = useAppData();
  const news = useNews();
  const fmt = useFormat();
  const t = useT();
  // Se refresca cada minuto para la cuenta atrás
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const upcoming = data ? data.shows.filter((s) => new Date(s.endsAt).getTime() > now).slice(0, 3) : [];
  // El próximo PPV/PLE que aún no ha terminado, para la tarjeta destacada
  const nextBig = data?.shows.find((s) => s.kind !== 'weekly' && new Date(s.endsAt).getTime() > now);

  return (
    <>
      <PageHeader title={t('home.title')} />
      {nextBig && fmt ? <NextEventHero show={nextBig} fmt={fmt} now={now} /> : null}
      <SampleNotice text={t('home.sample')} />

      {/* En escritorio los próximos shows viven en la columna lateral */}
      <section className="hide-desktop">
        <SectionHead title={t('home.upcoming')} href="/shows" />
        <div className="stack">
          {fmt ? upcoming.map((s) => <ShowRow key={s.id} show={s} fmt={fmt} now={now} />) : null}
        </div>
      </section>

      <section>
        <SectionHead title={t('home.latestNews')} href="/noticias" />
        {news.data ? (
          <div className="stack">
            {news.data.items.slice(0, 3).map((n) => (
              <NewsCard key={n.id} item={n} now={now} />
            ))}
          </div>
        ) : news.status === 'error' ? (
          <p className="empty">{t('home.newsError')}</p>
        ) : (
          <NewsSkeleton count={2} />
        )}
      </section>

      <section>
        <SectionHead title={t('home.storylines')} href="/al-dia?tab=storylines" />
        <div className="stack">
          {data?.storylines.slice(0, 2).map((s) => <StorylineCard key={s.id} item={s} now={now} />)}
        </div>
      </section>
    </>
  );
}
