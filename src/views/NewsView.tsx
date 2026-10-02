'use client';

import { useState } from 'react';
import { FilterChips, type Filter } from '../components/FilterChips';
import { NewsCard } from '../components/NewsCard';
import { NewsSkeleton } from '../components/NewsSkeleton';
import { PageHeader } from '../components/PageHeader';
import { useNews } from '../data/useNews';

const PAGE = 20;

export function NewsView() {
  const { data, status, reload } = useNews();
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE);
  const now = Date.now();

  const all = (data?.items ?? []).filter((n) => filter === 'all' || n.promotion === filter);
  const shown = all.slice(0, visible);
  const sourceNames = data ? [...new Set(data.sources.filter((s) => s.ok).map((s) => s.name))] : [];
  const updated = data
    ? new Date(data.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <>
      <PageHeader title="Noticias" />
      <FilterChips
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setVisible(PAGE);
        }}
        includeGeneral
      />

      {status === 'loading' && !data ? (
        <>
          <p className="muted small notice">Cargando noticias…</p>
          <NewsSkeleton />
        </>
      ) : null}

      {status === 'error' && !data ? (
        <div className="state">
          <p>No se pudieron cargar las noticias. Comprueba tu conexión e inténtalo de nuevo.</p>
          <button type="button" className="button" onClick={reload}>
            Reintentar
          </button>
        </div>
      ) : null}

      {status === 'error' && data ? (
        <p className="muted small notice">No se pudo actualizar; se muestran las últimas noticias cargadas.</p>
      ) : null}

      {data ? (
        <>
          <div className="stack stack--grid">
            {shown.map((n) => (
              <NewsCard key={n.id} item={n} now={now} />
            ))}
          </div>

          {all.length === 0 ? (
            <p className="empty">
              {filter === 'all'
                ? 'No hay noticias ahora mismo.'
                : 'No hay noticias de esta promoción por ahora.'}
            </p>
          ) : null}

          {all.length > visible ? (
            <div className="stack">
              <button
                type="button"
                className="button button--center"
                onClick={() => setVisible((v) => v + PAGE)}
              >
                Mostrar más
              </button>
            </div>
          ) : null}

          <p className="muted small sources">
            Fuentes: {sourceNames.join(', ') || 'ninguna disponible'}. Actualizado a las {updated}. Cada noticia
            enlaza a la web original.
          </p>
        </>
      ) : null}
    </>
  );
}
