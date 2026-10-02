# WrestleTrack

Aplicación web (instalable como app) con noticias de lucha libre, resúmenes de storylines y calendario de shows.
Promociones principales: WWE (Raw, SmackDown, NXT y PLE), AEW, CMLL, AAA y NJPW.

Estado: esqueleto con datos de ejemplo. Ver `docs/ROADMAP.md`.

## Stack
Next.js (App Router) + React + TypeScript. Backend previsto: Supabase (`supabase/schema.sql`).

## Arrancar
```bash
npm install
npm run dev
```
Abre http://localhost:3000. Para ver la versión móvil, reduce la ventana del navegador o usa las
herramientas de desarrollador (F12) con el modo dispositivo. Por encima de 960 px de ancho aparece
el diseño de escritorio (barra lateral y columna de próximos shows).

Versión de producción local (aquí sí se activa el service worker):
```bash
npm run build
npm start
```

## Instalar como aplicación (PWA)
La instalación necesita HTTPS, así que funciona en la versión publicada (Vercel, Netlify, Cloudflare Pages...).
- Chrome / Edge (escritorio y Android): icono de instalar en la barra de direcciones, o botón en la pestaña Perfil.
- iPhone / iPad (Safari): Compartir > Añadir a pantalla de inicio.

## Noticias
`GET /api/news` lee los feeds de `src/lib/news/sources.ts` en el servidor, los une, quita duplicados,
etiqueta cada noticia por promoción (palabras clave en título, categorías y extracto) y descarta publicidad
de apuestas y contenido de MMA/boxeo/fútbol. Guarda el resultado 10 minutos. El campo `sources` de la
respuesta indica qué fuentes han funcionado y por qué ha fallado cada una de las demás.
Para añadir una fuente, basta una línea en `sources.ts`.

## Estructura
```
src/app/          rutas y metadatos (layout, manifest, páginas)
src/views/        pantallas (Inicio, Noticias, Storylines, Shows, Perfil)
src/components/   interfaz: AppShell (móvil/escritorio), tarjetas, filtros...
src/data/         tipos, datos de ejemplo y useAppData (único punto de acceso a datos)
src/lib/          utilidades (fechas, useMounted)
public/           service worker e iconos
supabase/         esquema de base de datos
```

## Notas
- Las horas se muestran en la zona horaria del navegador; por eso las pantallas con fechas se
  pintan tras montar (`useMounted`), para evitar desajustes entre servidor y navegador.
- Logo e iconos: `public/brand/` (marca y rótulo), `public/icons/` (iconos de instalación) y `src/app/`
  (`icon.png`, `apple-icon.png`, `favicon.ico`, `opengraph-image.png`). Los PNG originales eran pequeños;
  conviene regenerarlos desde la versión de alta resolución (1024 px) cuando se tenga.
- `package.json` usa `latest`; al instalar, `package-lock.json` fija las versiones. Súbelo a Git.
