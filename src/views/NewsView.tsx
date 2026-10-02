'use client';

import { useEffect, useState } from 'react';
import { FilterChips, type Filter } from '../components/FilterChips';
import { NewsCard } from '../components/NewsCard';
import { NewsSkeleton } from '../components/NewsSkeleton';
import { PageHeader } from '../components/PageHeader';
import { useNews } from '../data/useNews';
import { useSettings } from '../i18n/SettingsProvider';

const PAGE = 20;

type LangScope = 'device' | 'all';

const SCOPE_KEY = 'wrestletrack:news-lang';

export function NewsView() {
  const { data, status, reload } = useNews();
  // Las noticias se filtran por el idioma de la app (el del dispositivo, o el elegido en el perfil)
  const { lang, locale, timeZone, t } = useSettings();
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE);
  const [scope, setScope] = useState<LangScope>('device');
  const now = Date.now();

  // La preferencia se lee tras montar: localStorage no existe en el servidor
  useEffect(() => {
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

  const onlyDeviceLang = scope === 'device';
  const all = (data?.items ?? []).filter(
    (n) => (filter === 'all' || n.promotion === filter) && (!onlyDeviceLang || n.lang === lang),
  );
  const shown = all.slice(0, visible);
  const sourceNames = data ? [...new Set(data.sources.filter((s) => s.ok).map((s) => s.name))] : [];
  const updated =
    data && timeZone
      ? new Date(data.updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone })
      : '';

  return (
    <>
      <PageHeader title={t('news.title')} />
      <div className="segment" role="group" aria-label={t('news.langAria')}>
        <button type="button" aria-pressed={scope === 'device'} onClick={() => changeScope('device')}>
          {t(lang === 'es' ? 'news.lang.es' : 'news.lang.en')}
        </button>
        <button type="button" aria-pressed={scope === 'all'} onClick={() => changeScope('all')}>
          {t('news.allLangs')}
        </button>
      </div>
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
          <p className="muted small notice">{t('news.loading')}</p>
          <NewsSkeleton />
        </>
      ) : null}

      {status === 'error' && !data ? (
        <div className="state">
          <p>{t('news.error')}</p>
          <button type="button" className="button" onClick={reload}>
            {t('common.retry')}
          </button>
        </div>
      ) : null}

      {status === 'error' && data ? <p className="muted small notice">{t('news.stale')}</p> : null}

      {data ? (
        <>
          <div className="stack stack--grid">
            {shown.map((n) => (
              <NewsCard key={n.id} item={n} now={now} />
            ))}
          </div>

          {all.length === 0 ? (
            <p className="empty">
              {filter === 'all' ? t('news.empty') : t('news.emptyPromo')}
              {onlyDeviceLang ? ` ${t('news.tryAllLangs')}` : ''}
            </p>
          ) : null}

          {all.length > visible ? (
            <div className="stack">
              <button
                type="button"
                className="button button--center"
                onClick={() => setVisible((v) => v + PAGE)}
              >
                {t('common.showMore')}
              </button>
            </div>
          ) : null}

          <p className="muted small sources">
            {t('news.sources', { sources: sourceNames.join(', ') || t('news.noSources'), time: updated })}
          </p>
        </>
      ) : null}
    </>
  );
}
