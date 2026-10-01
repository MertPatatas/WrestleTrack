# WrestleTrack

App móvil (Android e iOS) con noticias de lucha libre, resúmenes de storylines y calendario de shows.
Promociones principales: WWE (Raw, SmackDown, NXT y PLE), AEW, CMLL, AAA y NJPW.

Estado: esqueleto con datos de ejemplo. Ver `docs/ROADMAP.md`.

## Stack
Expo (React Native) + TypeScript + Expo Router. Backend previsto: Supabase (`supabase/schema.sql`).

## Arrancar
```bash
npm install
npx expo start
```
Escanea el QR con Expo Go (Android/iOS) o pulsa `a` / `i` para un emulador.

## Estructura
```
app/            pantallas (Expo Router): Inicio, Noticias, Storylines, Shows, Perfil
src/components/ componentes de UI
src/data/       tipos y datos de ejemplo (mock.ts)
src/lib/        utilidades (fechas y zona horaria)
src/theme.ts    colores y espaciado
supabase/       esquema de base de datos
docs/           hoja de ruta
```

## Antes de publicar
Cambia `ios.bundleIdentifier` y `android.package` en `app.json` (el script deja `com.example.wrestletrack` como marcador) por un identificador tuyo definitivo.
