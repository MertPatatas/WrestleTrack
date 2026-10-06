'use client';

import type { Recap, WrestlerPhoto } from '../../data/types';
import { useT } from '../../i18n/SettingsProvider';
import { MatchFaces, PhotoCredits } from '../wrestlers/WrestlerAvatar';

// Lista de resultados de un show (con las caras de los luchadores), y la fuente enlazada
export function RecapResults({ recap, photos = {} }: { recap: Recap; photos?: Record<string, WrestlerPhoto | null> }) {
  const t = useT();
  const people = recap.items.flatMap((i) => (i.sides ?? []).flatMap((side) => side.people.map((p) => p.name)));
  return (
    <>
      <ol className="match-list recap-list">
        {recap.items.map((item, i) => (
          <li key={i} className={item.segment ? 'recap-segment' : undefined}>
            {item.title ? <span className="match-title">{item.title}</span> : null}
            {item.sides ? <MatchFaces sides={item.sides} photos={photos} /> : null}
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
      <PhotoCredits people={people} photos={photos} label={t('detail.photoCredits')} />
    </>
  );
}
