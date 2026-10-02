'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NewsResponse } from '../lib/news/loadNews';

type Status = 'loading' | 'ready' | 'error';

const FRESH_MS = 5 * 60 * 1000;
// Se conserva entre pantallas para no recargar al cambiar de pestaña.
let cached: { at: number; data: NewsResponse } | null = null;

export function useNews() {
  const [data, setData] = useState<NewsResponse | null>(cached?.data ?? null);
  const [status, setStatus] = useState<Status>(cached ? 'ready' : 'loading');

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const res = await fetch('/api/news');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as NewsResponse;
      cached = { at: Date.now(), data: json };
      setData(json);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!cached || Date.now() - cached.at > FRESH_MS) void load();
  }, [load]);

  return { data, status, reload: load };
}
