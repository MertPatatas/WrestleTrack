'use client';

import Link from 'next/link';
import { PageHeader } from '../components/PageHeader';
import { NewsCard } from '../components/NewsCard';
import { SampleNotice } from '../components/SampleNotice';
import { ShowRow } from '../components/ShowRow';
import { StorylineCard } from '../components/StorylineCard';
import { useAppData } from '../data/useAppData';

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="section-head">
      <h2 className="section-title">{title}</h2>
      <Link href={href} className="link">
        Ver todo
      </Link>
    </div>
  );
}

export function HomeView() {
  const data = useAppData();
  const now = Date.now();
  const upcoming = data
    ? data.shows.filter((s) => new Date(s.startsAt).getTime() > now).slice(0, 3)
    : [];

  return (
    <>
      <PageHeader title="Inicio" />
      <SampleNotice />

      {/* En escritorio los próximos shows viven en la columna lateral */}
      <section className="hide-desktop">
        <SectionHead title="Próximos shows" href="/shows" />
        <div className="stack">
          {upcoming.map((s) => (
            <ShowRow key={s.id} show={s} />
          ))}
        </div>
      </section>

      <section>
        <SectionHead title="Últimas noticias" href="/noticias" />
        <div className="stack">
          {data?.news.slice(0, 2).map((n) => <NewsCard key={n.id} item={n} now={now} />)}
        </div>
      </section>

      <section>
        <SectionHead title="Storylines en curso" href="/storylines" />
        <div className="stack">
          {data?.storylines.slice(0, 2).map((s) => <StorylineCard key={s.id} item={s} now={now} />)}
        </div>
      </section>
    </>
  );
}
