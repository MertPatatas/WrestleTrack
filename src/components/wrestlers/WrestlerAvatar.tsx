'use client';

import { useState } from 'react';
import type { MatchSide, WrestlerPhoto } from '../../data/types';
import { personKey } from '../../lib/wrestlers/people';

type Photos = Record<string, WrestlerPhoto | null | undefined>;

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

// Cara de un luchador en círculo (centrada en su cara); sin foto, sus iniciales con el color de la marca
export function WrestlerAvatar({ name, photo, size = 44 }: { name: string; photo?: WrestlerPhoto | null; size?: number }) {
  // Si la foto no carga (borrada en su web, enlace caducado…), las iniciales
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} title={name}>
      {photo && failed !== photo.url ? (
        <img
          src={photo.url}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          style={{ objectPosition: `${photo.focusX}% ${photo.focusY}%` }}
          onError={() => setFailed(photo.url)}
        />
      ) : (
        <span aria-label={name}>{initials(name)}</span>
      )}
    </span>
  );
}

/** Caras de cada lado de un combate, con "VS" entre medias. Nada si ningún participante tiene foto. */
export function MatchFaces({ sides, photos }: { sides: MatchSide[]; photos: Photos }) {
  const any = sides.some((s) => s.people.some((p) => photos[personKey(p.name)]));
  // Sin fotos, o una batalla real con decenas de participantes: solo el texto
  if (!any || sides.length > 6) return null;
  const size = sides.length > 2 ? 36 : 50;
  return (
    <div className="match-faces" aria-hidden="true">
      {sides.map((side, i) => (
        <span key={i} className="match-faces-side-wrap">
          {i > 0 ? <span className="match-faces-vs">VS</span> : null}
          <span className="match-faces-side">
            {side.people.map((p) => (
              <WrestlerAvatar key={p.name} name={p.name} photo={photos[personKey(p.name)]} size={side.people.length > 2 ? size - 8 : size} />
            ))}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Créditos de las fotos (las licencias libres exigen citar al autor y la licencia). */
export function PhotoCredits({ people, photos, label }: { people: string[]; photos: Photos; label: string }) {
  const seen = new Set<string>();
  const items = people.flatMap((name) => {
    const key = personKey(name);
    const photo = photos[key];
    if (!photo || seen.has(key) || photo.source === 'upload') return [];
    seen.add(key);
    return [{ name, photo }];
  });
  if (!items.length) return null;
  return (
    <details className="photo-credits">
      <summary className="muted small">{label}</summary>
      <ul>
        {items.map(({ name, photo }) => (
          <li key={name} className="small">
            {name}:{' '}
            {photo.creditUrl ? (
              <a className="link link--inline" href={photo.creditUrl} target="_blank" rel="noopener noreferrer">
                {photo.credit ?? 'Wikimedia Commons'}
              </a>
            ) : (
              (photo.credit ?? '—')
            )}
            {photo.license ? (
              <>
                {' · '}
                {photo.licenseUrl ? (
                  <a className="link link--inline" href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">
                    {photo.license}
                  </a>
                ) : (
                  photo.license
                )}
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
