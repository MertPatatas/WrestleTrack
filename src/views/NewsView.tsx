'use client';

import { useEffect, useState } from 'react';
import { FilterChips, type Filter } from '../components/FilterChips';
import { NewsCard } from '../components/NewsCard';
import { NewsSkeleton } from '../components/NewsSkeleton';
import { PageHeader } from '../components/PageHeader';
import type { NewsItem } from '../data/types';
import { useNews } from '../data/useNews';

const PAGE = 20;

type Lang = NonNullable<NewsItem['lang']>;
type LangScope = 'device' | 'all';

const LANG_LABEL: Record<Lang, string> = { es: 'En español', en: 'En inglés' };
const SCOPE_KEY = 'wrestletrack:news-lang';

// Idioma del dispositivo, solo si hay fuentes en ese idioma (si no, no se muestra el filtro)
function deviceLang(): Lang | null {
  const base = (navigator.language || '').slice(0, 2).toLowerCase();
  return base in LANG_LABEL ? (base as Lang) : null;
}

export function NewsView() {
  const { data, status, reload } = useNews();
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE);
  const [lang, setLang] = useState<Lang | null>(null);
  const [scope, setScope] = useState<LangScope>('device');
  const now = Date.now();

  // navigator solo existe en el navegador: se lee tras montar para no romper la hidratación
  useEffect(() => {
    setLang(deviceLang());
    try {
      if (localStorage.getItem(SCOPE_KEY) === 'all') setScope('all');
    } catch {
      // almacenamiento no disponible (modo privado): se usa el valor por defecto
    }
  }, []);

  const changeScope = (next: LangScope) => {
    setScope(next);
    setVisible(PAGE);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      // sin almacenamiento la preferencia dura solo esta visita
    }
  };

  const onlyDeviceLang = lang !== null && scope === 'device';
  const all = (data?.items ?? []).filter(
    (n) => (filter === 'all' || n.promotion === filter) && (!onlyDeviceLang || n.lang === lang),
  );
  const shown = all.slice(0, visible);
  const sourceNames = data ? [...new Set(data.sources.filter((s) => s.ok).map((s) => s.name))] : [];
  const updated = data
    ? new Date(data.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <>
      <PageHeader title="Noticias" />
      {lang ? (
        <div className="segment" role="group" aria-label="Idioma de las noticias">
          <button type="button" aria-pressed={scope === 'device'} onClick={() => changeScope('device')}>
            {LANG_LABEL[lang]}
          </button>
          <button type="button" aria-pressed={scope === 'all'} onClick={() => changeScope('all')}>
            Todos los idiomas
          </button>
        </div>
      ) : null}
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
              {onlyDeviceLang ? ' Prueba con «Todos los idiomas».' : ''}
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
