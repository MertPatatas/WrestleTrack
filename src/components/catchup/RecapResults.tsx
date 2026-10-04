'use client';

import type { Recap } from '../../data/types';
import { useT } from '../../i18n/SettingsProvider';

// Lista de resultados de un show, con la fuente enlazada
export function RecapResults({ recap }: { recap: Recap }) {
  const t = useT();
  return (
    <>
      <ol className="match-list recap-list">
        {recap.items.map((item, i) => (
          <li key={i} className={item.segment ? 'recap-segment' : undefined}>
            {item.title ? <span className="match-title">{item.title}</span> : null}
            <span className={item.segment ? 'recap-segment-text' : 'match-participants'}>{item.text}</span>
            {item.result ? <span className="recap-result">{item.result}</span> : null}
          </li>
        ))}
      </ol>
      <p className="muted small">
        {t('catchup.source')}{' '}
        <a className="link link--inline" href={recap.source.url} target="_blank" rel="noopener noreferrer">
          {recap.source.name} ↗
        </a>
      </p>
    </>
  );
}
