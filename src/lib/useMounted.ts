'use client';

import { useEffect, useState } from 'react';

// Devuelve true solo en el navegador, tras el primer render.
// Evita desajustes de hidratación con horas y fechas (el servidor y el
// navegador tienen zonas horarias y relojes distintos).
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
