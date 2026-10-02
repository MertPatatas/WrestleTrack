'use client';

import Link from 'next/link';
import { NewsCard } from '../components/NewsCard';
import { NewsSkeleton } from '../components/NewsSkeleton';
import { PageHeader } from '../components/PageHeader';
import { SampleNotice } from '../components/SampleNotice';
import { ShowRow } from '../components/ShowRow';
import { StorylineCard } from '../components/StorylineCard';
import { useAppData } from '../data/useAppData';
import { useNews } from '../data/useNews';

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
  const news = useNews();
  const now = Date.now();
  const upcoming = data
    ? data.shows.filter((s) => new Date(s.startsAt).getTime() > now).slice(0, 3)
    : [];

  return (
    <>
      <PageHeader title="Inicio" />
      <SampleNotice text="Los shows y las storylines son datos de ejemplo; las noticias son reales." />

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
        {news.data ? (
          <div className="stack">
            {news.data.items.slice(0, 3).map((n) => (
              <NewsCard key={n.id} item={n} now={now} />
            ))}
          </div>
        ) : news.status === 'error' ? (
          <p className="empty">No se pudieron cargar las noticias.</p>
        ) : (
          <NewsSkeleton count={2} />
        )}
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
