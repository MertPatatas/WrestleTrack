'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RecapsResponse } from './types';

type Status = 'loading' | 'ready' | 'error';

// Resultados y vídeos de análisis (/api/recaps), compartidos entre pantallas durante la visita
let cache: RecapsResponse | null = null;
let request: Promise<RecapsResponse> | null = null;

function load(): Promise<RecapsResponse> {
  request ??= fetch('/api/recaps')
    .then((res) => (res.ok ? (res.json() as Promise<RecapsResponse>) : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data) => (cache = data))
    .catch((err: unknown) => {
      request = null; // se reintenta en la próxima petición
      throw err;
    });
  return request;
}

/** enabled=false: no pide nada (p. ej. en la página de un show que aún no se ha emitido). */
export function useRecaps(enabled = true): { data: RecapsResponse | null; status: Status; reload: () => void } {
  const [data, setData] = useState<RecapsResponse | null>(cache);
  const [status, setStatus] = useState<Status>(cache ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache || !enabled) return;
    let alive = true;
    setStatus('loading');
    load()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [attempt, enabled]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, status, reload };
}
