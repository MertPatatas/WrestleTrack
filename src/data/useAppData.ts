'use client';

import { useMemo } from 'react';
import { useMounted } from '../lib/useMounted';
import { getShows, getStorylines } from './mock';

// Shows y storylines (datos de ejemplo por ahora). Las noticias reales viven en useNews.
export function useAppData() {
  const mounted = useMounted();
  return useMemo(
    () => (mounted ? { storylines: getStorylines(), shows: getShows() } : null),
    [mounted],
  );
}
