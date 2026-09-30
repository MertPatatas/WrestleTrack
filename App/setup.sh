#!/usr/bin/env bash
# Genera el proyecto Expo con la versión actual de Expo y aplica el código de WrestleTrack.
# Uso: ./setup.sh [directorio]   (por defecto: WrestleTrack)
set -euo pipefail

APP_DIR="${1:-WrestleTrack}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ -e "$APP_DIR" ]; then
  echo "Ya existe '$APP_DIR'. Elige otro nombre o bórralo." >&2
  exit 1
fi

npx create-expo-app@latest "$APP_DIR" --template blank-typescript --no-install
cd "$APP_DIR"

npm install
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar @expo/vector-icons

# Quitar el punto de entrada de la plantilla y copiar nuestro código
rm -f App.tsx index.ts index.js
cp -R "$HERE/overlay/." .

# Ajustar package.json y app.json para Expo Router
node <<'NODE'
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.main = 'expo-router/entry';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const e = app.expo;
e.name = 'WrestleTrack';
e.slug = 'wrestletrack';
e.scheme = 'wrestletrack';
e.userInterfaceStyle = 'dark';
e.backgroundColor = '#0D0D0E';
e.plugins = Array.from(new Set([...(e.plugins || []), 'expo-router']));
e.ios = { ...(e.ios || {}), bundleIdentifier: (e.ios && e.ios.bundleIdentifier) || 'com.example.wrestletrack' };
e.android = { ...(e.android || {}), package: (e.android && e.android.package) || 'com.example.wrestletrack' };
fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
NODE

echo
echo "Listo. Entra en '$APP_DIR' y ejecuta: npx expo start"
