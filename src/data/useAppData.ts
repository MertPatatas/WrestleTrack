'use client';

import { useMemo } from 'react';
import { useMounted } from '../lib/useMounted';
import { getNews, getShows, getStorylines } from './mock';

// Único punto de acceso a los datos. Cuando haya backend, se sustituye aquí
// por llamadas reales (por ejemplo a /api/news) sin tocar las pantallas.
export function useAppData() {
  const mounted = useMounted();
  return useMemo(
    () => (mounted ? { news: getNews(), storylines: getStorylines(), shows: getShows() } : null),
    [mounted],
  );
}
