'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ScheduleResponse } from '../app/api/schedule/route';
import { buildSchedule } from '../lib/schedule/build';
import { useMounted } from '../lib/useMounted';

type AutoData = Pick<ScheduleResponse, 'episodes' | 'events' | 'showImages'>;

// Datos automáticos del calendario, compartidos entre pantallas para no repetir la petición
let autoCache: AutoData | null = null;
let autoRequest: Promise<AutoData | null> | null = null;

function loadAutoData(): Promise<AutoData | null> {
  autoRequest ??= fetch('/api/schedule')
    .then((res) => (res.ok ? (res.json() as Promise<ScheduleResponse>) : null))
    .then(
      (data) =>
        (autoCache = data ? { episodes: data.episodes, events: data.events, showImages: data.showImages ?? {} } : null),
    )
    .catch(() => {
      autoRequest = null; // se reintenta en la próxima visita
      return null;
    });
  return autoRequest;
}

// Calendario (fuentes automáticas de /api/schedule + reglas de src/data/schedule.ts)
// Las noticias viven en useNews y las storylines en useStorylines.
export function useAppData() {
  const mounted = useMounted();
  const [auto, setAuto] = useState<AutoData | null>(autoCache);

  useEffect(() => {
    if (autoCache) return;
    let alive = true;
    void loadAutoData().then((data) => alive && data && setAuto(data));
    return () => {
      alive = false;
    };
  }, []);

  // Mientras llegan los datos automáticos (o si fallan) se muestran los shows semanales habituales
  return useMemo(
    () =>
      mounted
        ? {
            shows: buildSchedule(Date.now(), {
              futureDays: 120,
              // Los grandes eventos se anuncian con muchos meses de antelación (Royal Rumble, WrestleMania...)
              specialDays: 450,
              episodes: auto?.episodes,
              autoEvents: auto?.events,
              showImages: auto?.showImages,
            }),
            scheduleLive: auto !== null,
          }
        : null,
    [mounted, auto],
  );
}
