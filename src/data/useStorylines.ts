'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Storyline } from './types';

type Status = 'loading' | 'ready' | 'error';

// Storylines publicadas (/api/storylines), compartidas entre pantallas durante la visita
let cache: Storyline[] | null = null;
let request: Promise<Storyline[]> | null = null;

function load(): Promise<Storyline[]> {
  request ??= fetch('/api/storylines')
    .then((res) => (res.ok ? (res.json() as Promise<{ storylines: Storyline[] }>) : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data) => (cache = data.storylines))
    .catch((err: unknown) => {
      request = null; // se reintenta en la próxima petición
      throw err;
    });
  return request;
}

export function useStorylines(): { storylines: Storyline[] | null; status: Status; reload: () => void } {
  const [storylines, setStorylines] = useState<Storyline[] | null>(cache);
  const [status, setStatus] = useState<Status>(cache ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    setStatus('loading');
    load()
      .then((list) => {
        if (!alive) return;
        setStorylines(list);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { storylines, status, reload };
}

/** Fecha del último avance (o de inicio) de una storyline, para ordenar. */
export const lastActivity = (s: Storyline) => s.beats[s.beats.length - 1]?.date ?? s.startedOn ?? s.updatedAt.slice(0, 10);

/** Activas primero (por último avance), luego las terminadas (por fecha de fin). */
export function sortStorylines(list: Storyline[]): Storyline[] {
  return [...list].sort(
    (a, b) => Number(a.status === 'closed') - Number(b.status === 'closed') || lastActivity(b).localeCompare(lastActivity(a)),
  );
}
