# PastilleroApp 💊

App móvil de recordatorio de medicamentos para adultos mayores. Construida con React Native, Expo y Supabase.

## Características

- **Login/Registro** con email y contraseña (Supabase Auth)
- **Lista de medicamentos** con nombre, foto, dosis y horario
- **Agregar medicamento** con foto desde cámara o galería
- **Notificaciones push** a la hora exacta de cada medicamento
- **Historial de tomas** donde el usuario marca si tomó o no la pastilla
- **Banner de publicidad** Google AdMob
- **Diseño amigable** para adultos mayores: letras grandes, botones grandes, colores claros

## Requisitos previos

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Cuenta en [Supabase](https://supabase.com)
- (Opcional) Cuenta en Google AdMob para publicidad

## Instalación

### 1. Instalar dependencias

```bash
cd pastillero-app
npm install
```

### 2. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve al **SQL Editor** y ejecuta todo el contenido de `supabase-schema.sql`
3. Edita `lib/supabase.ts` y reemplaza:
   - `TU_PROYECTO.supabase.co` → tu URL de Supabase
   - `TU_ANON_KEY_AQUI` → tu clave anon/public

### 3. Configurar AdMob (opcional)

1. Crea una cuenta en [Google AdMob](https://admob.google.com)
2. Edita `app.json` y reemplaza los IDs de AdMob:
   - `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY` → tus IDs reales
3. En `components/AdBanner.tsx`, descomenta el código real de BannerAd

### 4. Ejecutar la app

```bash
# Modo desarrollo con Expo Go (sin notificaciones ni AdMob nativo)
npx expo start

# Build de desarrollo (recomendado para todas las funciones)
npx expo run:android
# o
npx expo run:ios
```

> **Nota:** Las notificaciones push y AdMob requieren un build nativo (no funcionan en Expo Go). Usa `npx expo run:android` o crea un build con EAS:
> ```bash
> npx eas build --profile development --platform android
> ```

## Estructura del proyecto

```
pastillero-app/
├── app/
│   ├── _layout.tsx          # Layout raíz con auth routing
│   ├── (auth)/
│   │   ├── _layout.tsx      # Layout de autenticación
│   │   └── login.tsx        # Pantalla de login/registro
│   └── (tabs)/
│       ├── _layout.tsx      # Layout de tabs (navegación inferior)
│       ├── index.tsx        # Inicio - lista de medicamentos + AdMob
│       ├── add.tsx          # Agregar medicamento
│       ├── history.tsx      # Historial de tomas
│       └── profile.tsx      # Perfil y cerrar sesión
├── components/
│   └── AdBanner.tsx         # Componente de banner publicitario
├── context/
│   └── AuthContext.tsx      # Contexto de autenticación
├── lib/
│   ├── supabase.ts          # Cliente de Supabase
│   ├── notifications.ts     # Servicio de notificaciones
│   ├── theme.ts             # Colores, fuentes y espaciado
│   └── types.ts             # Tipos TypeScript
├── supabase-schema.sql      # Esquema SQL para Supabase
├── app.json                 # Configuración de Expo
└── package.json             # Dependencias
```

## Paquetes principales

| Paquete | Uso |
|---------|-----|
| `@supabase/supabase-js` | Base de datos, auth y storage |
| `expo-notifications` | Notificaciones push locales |
| `expo-image-picker` | Cámara y galería de fotos |
| `react-native-google-mobile-ads` | Banner de publicidad AdMob |
| `@react-navigation/bottom-tabs` | Navegación por tabs |
| `expo-router` | File-based routing |
| `@react-native-async-storage/async-storage` | Persistencia de sesión |

## Comandos npm

```bash
# Instalar todas las dependencias
npm install

# Iniciar servidor de desarrollo
npx expo start

# Build Android nativo
npx expo run:android

# Build iOS nativo
npx expo run:ios

# Build con EAS (producción)
npx eas build --platform android
npx eas build --platform ios
```
