# Hoja de ruta

- [x] 1. Esqueleto web con diseño móvil y de escritorio, y datos de ejemplo
- [ ] 2. Publicar (Vercel u otro) para probar la instalación como aplicación
- [x] 3. Noticias reales: ruta de servidor `/api/news` que lee RSS/Atom de varias fuentes, etiqueta por promoción y filtra publicidad y contenido que no es wrestling
- [ ] 3b. Revisar qué fuentes responden (`/api/news`, campo `sources`) y ampliar la lista (más fuentes en español y de NJPW)
- [x] 4. Calendario real de WWE, AEW, CMLL, AAA y NJPW (PLE a mano + shows semanales automatizados) en `src/data/schedule.ts`
- [x] 4b. Calendario automático (`/api/schedule`, se refresca cada 6 h): TVmaze (semanales con cambios y PLE/PPV de WWE, NXT y AEW), API oficial de NJPW (eventos grandes con hora) y Wikipedia (resto, solo fecha)
- [ ] 4c. Fuente automática para CMLL (ahora usa su horario semanal fijo) y hora de los PLE de AAA
- [ ] 5. Storylines: modelo de datos + resúmenes generados con IA (primero WWE y AEW)
- [ ] 6. Notificaciones web push (en iPhone requieren la app instalada en la pantalla de inicio)
- [ ] 7. Si se quisiera publicar en las tiendas: envolver la web (TWA en Google Play; Apple es más estricto con apps que son solo una web)

## Notas
- Noticias: titular + extracto corto + enlace a la fuente, sin copiar artículos completos.
- Resúmenes con IA: indicarlo y citar fuentes.
- Evitar logos oficiales y fotos de luchadores sin licencia; usar etiquetas de texto.
