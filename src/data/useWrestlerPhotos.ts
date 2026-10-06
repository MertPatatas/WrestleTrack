'use client';

import { useEffect, useState } from 'react';
import type { WrestlerPhoto } from './types';

type Photos = Record<string, WrestlerPhoto | null>;

/** Fotos de unas personas (/api/wrestlers); {} mientras llegan o si fallan. */
export function useWrestlerPhotos(names: string[]): Photos {
  const [photos, setPhotos] = useState<Photos>({});
  const query = names.slice(0, 16).join('|');

  useEffect(() => {
    if (!query) return;
    let alive = true;
    fetch(`/api/wrestlers?names=${encodeURIComponent(query)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ photos: Photos }>) : { photos: {} }))
      .then((data) => alive && setPhotos(data.photos))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [query]);

  return photos;
}
