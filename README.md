# 💊 PastilleroApp

App móvil de recordatorio de medicamentos pensada para adultos mayores: texto grande, botones de al menos 70×70px, alarmas sonoras persistentes y un sistema de cuidadores para que un familiar pueda ayudar a administrarla a distancia.

![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web-lightgrey)

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura y decisiones importantes](#arquitectura-y-decisiones-importantes)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración](#instalación-y-configuración)
- [Ejecutar en desarrollo](#ejecutar-en-desarrollo)
- [Base de datos](#base-de-datos-supabase)
- [Sistema de cuidadores](#sistema-de-cuidadores)
- [Scripts disponibles](#scripts-disponibles)
- [Build y despliegue](#build-y-despliegue-eas)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Solución de problemas](#solución-de-problemas-comunes)
- [Licencia](#licencia)

## Características

**Medicamentos y alarmas**
- Agregar medicamento con foto (cámara o galería), dosis, frecuencia, hora de inicio y días de la semana.
- Alarma nativa en la app de Reloj del sistema (suena aunque PastilleroApp esté cerrada) + notificaciones locales con recordatorios de seguimiento cada 60s durante 10 minutos si no se confirma la toma.
- Pantalla de alarma a pantalla completa con sonido en loop, vibración agresiva y botones grandes de "Ya la tomé" / "Posponer 5 min".
- Editar y eliminar (borrado suave) medicamentos.

**Historial**
- Registro de cada dosis como Pendiente / Tomada / No tomada, con filtros en Historial.
- Reconciliación automática (`lib/doseSync.ts`): al abrir Inicio o Historial, la app rellena sola las dosis pasadas que nunca se confirmaron y cierra como "no tomadas" las que ya quedaron vencidas — no depende de que el usuario recuerde marcar nada.

**Cuenta y acceso**
- Registro e inicio de sesión con correo y contraseña (Supabase Auth).
- Recuperación de contraseña con código de 6+ dígitos por correo (sin depender de deep links).
- **Cuidado compartido**: una persona puede invitar a un familiar con un código; una vez vinculado, el cuidador tiene control total (ver, agregar, editar, marcar dosis) sobre la cuenta del paciente desde su propio teléfono, con cuenta y contraseña separadas.
- Guía de permisos guiada (notificaciones, batería sin restricciones, alarmas exactas) para Android.

**Diseño**
- Sistema de diseño propio en `lib/theme.ts`: tipografía Poppins, paleta de alto contraste, radios/espaciados consistentes, área mínima de toque de 70×70px pensada para precisión motora reducida.

## Stack tecnológico

| Categoría | Tecnología |
|---|---|
| Framework | [Expo](https://expo.dev) SDK 54 + [React Native](https://reactnative.dev) 0.81 (New Architecture) |
| Lenguaje | TypeScript 5.9 (`strict: true`) |
| Navegación | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing) v6 |
| Backend / DB | [Supabase](https://supabase.com) (Postgres + Auth + Storage + Row Level Security) |
| Notificaciones y alarmas | `expo-notifications`, `expo-intent-launcher` (alarma nativa de Android), `expo-av` (audio en loop) |
| Imágenes | `expo-image`, `expo-image-picker` |
| Animaciones | `react-native-reanimated` v4 |
| Fuentes | `@expo-google-fonts/poppins` |
| Almacenamiento local | `@react-native-async-storage/async-storage` |
| Build / distribución | [EAS Build](https://docs.expo.dev/eas/) |
| Lint | ESLint (`eslint-config-expo`) |

## Arquitectura y decisiones importantes

- **App cliente-pesada, sin servidor propio.** Todo el backend es Supabase (Postgres + Auth + Storage). No hay API intermedia: la app habla directo con Supabase usando la clave `anon` pública, y toda la seguridad de "quién puede ver/editar qué" vive en **Row Level Security (RLS)** de Postgres, no en el cliente.
- **Las alarmas son locales al teléfono.** Se programan con `expo-notifications` (canal `alarma_medicamentos`) y con `expo-intent-launcher` (`ACTION_SET_ALARM`, crea una alarma real en el Reloj de Android). No hay push notifications desde servidor — si un cuidador agrega o edita un medicamento desde su propio teléfono, la app lo avisa explícitamente: la alarma **no** sonará en el teléfono del paciente hasta que esa persona abra PastilleroApp al menos una vez.
- **Cuidado compartido vía RLS, no vía cuenta compartida.** Cada persona tiene su propio correo/contraseña. El acceso de un cuidador a los datos de un paciente se resuelve con políticas RLS adicionales (`is_caregiver_of()`) sobre `medications` y `dose_records`, activadas al redimir un código de invitación (`redeem_caregiver_invite()`, función `SECURITY DEFINER`). Ver [Sistema de cuidadores](#sistema-de-cuidadores).
- **Alerta de bloque único en Inicio.** La pantalla de Inicio destaca la dosis más urgente en el bloque grande de arriba; si hay varios medicamentos con horarios cercanos, los demás aparecen como filas compactas debajo (ver [Limitaciones conocidas](#limitaciones-conocidas)).

## Estructura del proyecto

```
pastillero-app/
├── app/                          # Rutas (expo-router, file-based)
│   ├── _layout.tsx               # Layout raíz: fuentes, providers, routing de auth, deep links de alarma
│   ├── (auth)/
│   │   └── login.tsx             # Login, registro y recuperación de contraseña (código por correo)
│   ├── (tabs)/                   # Barra de navegación inferior — 3 destinos
│   │   ├── index.tsx             # Inicio — bloque de "ahora" + lista de medicamentos + FAB
│   │   ├── history.tsx           # Historial — tira semanal + línea de tiempo del día
│   │   └── profile.tsx           # Perfil, apariencia, cuidado compartido, cerrar sesión
│   ├── add.tsx                   # Agregar medicamento (pantalla completa, no es un destino)
│   ├── details/[id].tsx          # Detalle y edición de un medicamento
│   ├── alarm.tsx                 # Pantalla de alarma a pantalla completa
│   └── permissions-guide.tsx     # Guía de activación de permisos (Android)
├── components/
│   ├── Feedback.tsx               # Snackbar + bottom sheet + diálogo (useFeedback)
│   ├── PatientBanner.tsx          # Banner "Viendo la cuenta de X" en modo cuidador
│   ├── AdBanner.tsx               # Placeholder de banner publicitario (ver Limitaciones)
│   ├── WebTimePicker.tsx          # Selector de hora propio para la versión web
│   └── ui/                        # Design system Material 3: Text, Surface, Button, Chip,
│                                  # TextField, TopAppBar, NavigationBar, Fab, ListItem,
│                                  # DoseStatus, IconBadge
├── context/
│   ├── AuthContext.tsx            # Sesión de Supabase Auth (login/registro/reset de contraseña)
│   ├── CaregiverContext.tsx       # Cuenta activa (propia o de un paciente), invitaciones, vínculos
│   └── ThemeContext.tsx           # Esquema claro/oscuro (useTheme, useThemedStyles)
├── lib/
│   ├── supabase.ts                # Cliente de Supabase (URL + anon key)
│   ├── notifications.ts           # Cálculo de horarios, notificaciones locales, alarma nativa
│   ├── doseSync.ts                # Reconciliación automática de dosis pendientes/no tomadas
│   ├── theme.ts                   # Tokens del sistema: roles de color (claro y oscuro), escala
│   │                              # tipográfica, espaciado, forma, elevación, movimiento
│   └── types.ts                   # Tipos: Medication, DoseRecord, CaregiverLink
├── DESIGN.md                      # Sistema de diseño: doctrina, roles y reglas (leer antes de tocar UI)
├── PRODUCT.md                     # Contexto de producto: usuarios, promesa, restricciones
├── supabase-schema.sql            # Esquema completo + migraciones (correr en el SQL Editor de Supabase)
├── patches/                       # Parches aplicados con patch-package (postinstall)
├── app.json                       # Configuración de Expo (permisos, plugins, bundle ids)
└── eas.json                       # Perfiles de build (development / preview / production)
```

> Antes de escribir o modificar cualquier pantalla, lee [DESIGN.md](DESIGN.md): todo color, tamaño de texto, espaciado y forma sale de un token de `lib/theme.ts` resuelto con `useTheme()`, nunca de un valor escrito a mano.

## Requisitos previos

- **Node.js 18+** (recomendado 20 LTS)
- **npm** (viene con Node)
- Cuenta gratuita en [Supabase](https://supabase.com)
- Para probar alarmas/cámara/notificaciones reales: **Android físico o emulador** — este proyecto usa módulos nativos (`expo-intent-launcher`, alarma en loop con `expo-av`, notificaciones con acciones) que **no funcionan completos en Expo Go**, necesitas un *development build* (ver [Ejecutar en desarrollo](#ejecutar-en-desarrollo)).
- (Opcional) Cuenta en [Expo Application Services (EAS)](https://expo.dev/eas) para generar APKs sin compilar localmente.
- (Opcional) Cuenta en [Google AdMob](https://admob.google.com) — el banner de anuncios hoy es solo un placeholder visual, ver [Limitaciones conocidas](#limitaciones-conocidas).

## Instalación y configuración

### 1. Clonar e instalar dependencias

```bash
cd pastillero-app
npm install
```

`postinstall` corre automáticamente `patch-package` para aplicar los parches en `patches/`.

### 2. Crear el proyecto en Supabase

1. Crea un proyecto nuevo en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** y ejecuta **todo** el contenido de [`supabase-schema.sql`](./supabase-schema.sql) — incluye las tablas, los índices, las políticas de Row Level Security y las funciones del sistema de cuidadores. El archivo es idempotente (usa `IF NOT EXISTS` / `DROP POLICY IF EXISTS`), lo puedes volver a correr sin romper nada si ya existía parcialmente.
3. Ve a **Project Settings → API** y copia la **Project URL** y la **anon public key**.
4. Pégalas en [`lib/supabase.ts`](./lib/supabase.ts):

   ```ts
   const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
   const SUPABASE_ANON_KEY = 'tu-anon-key';
   ```

   > La clave `anon` es pública por diseño (se usa desde el cliente); la seguridad real la dan las políticas RLS del paso 2, no esta clave.

### 3. Configurar la recuperación de contraseña por correo

Por defecto, Supabase manda correos con un servicio compartido muy limitado en envíos por hora y **no permite personalizar la plantilla** sin un SMTP propio. Este proyecto necesita mostrar un código en el correo (no un link), así que:

1. Configura un SMTP propio en **Authentication → SMTP Settings** (Gmail con una [contraseña de aplicación](https://myaccount.google.com/apppasswords) funciona bien para desarrollo/uso personal; para producción real se recomienda un proveedor transaccional como Resend o SendGrid).
2. En **Authentication → Email Templates → "Reset Password"**, edita el cuerpo para incluir el código:

   ```html
   <h2>Recupera tu contraseña</h2>
   <p>Tu código para poner una contraseña nueva es:</p>
   <h1>{{ .Token }}</h1>
   <p>Este código vence en 1 hora. Si tú no pediste este cambio, ignora este correo.</p>
   ```

Sin este paso, el registro y el login normales funcionan igual — solo "¿Olvidaste tu contraseña?" no podrá completarse.

### 4. Personalizar identificadores de la app (opcional)

En [`app.json`](./app.json), si vas a publicar tu propia copia, cambia:

- `expo.name`, `expo.slug`
- `expo.ios.bundleIdentifier` y `expo.android.package` (hoy `com.pastilleroapp.app`)
- `expo.extra.eas.projectId` (lo genera EAS al correr `eas init`)

### 5. (Opcional) Anuncios AdMob reales

`components/AdBanner.tsx` hoy es un placeholder visual (no depende de ningún SDK de anuncios). Para anuncios reales:

1. `npm install react-native-google-mobile-ads`
2. Agrega el plugin correspondiente en `app.json` con tus IDs de AdMob.
3. Reemplaza el contenido de `AdBanner.tsx` por el componente `BannerAd` real.
4. Genera un nuevo development build (los módulos nativos no aparecen en Expo Go).

## Ejecutar en desarrollo

```bash
# Servidor de desarrollo (Metro) — elige plataforma desde la terminal
npx expo start

# Directo en navegador (funcionalidad reducida: sin alarma nativa ni cámara)
npx expo start --web

# Build de desarrollo nativo — necesario para probar alarmas, cámara y notificaciones reales
npx expo run:android
```

> **Sobre Expo Go:** esta app usa módulos nativos personalizados (alarma del sistema, audio en loop, notificaciones con botones de acción) que Expo Go no soporta. Para probar la funcionalidad completa en un dispositivo Android real, corre `npx expo run:android` una vez (crea un *development build* con `expo-dev-client`) o genera uno con EAS:
> ```bash
> npx eas build --profile development --platform android
> ```

## Base de datos (Supabase)

| Tabla | Descripción |
|---|---|
| `medications` | Un medicamento por fila: nombre, foto, dosis, frecuencia (horas), hora de inicio, días de la semana activos, IDs de notificaciones programadas. `active=false` = borrado suave. |
| `dose_records` | Una fila por cada toma programada. `taken`: `null` = pendiente, `true` = tomada, `false` = no tomada. Se llena sola vía `lib/doseSync.ts`. |
| `caregiver_links` | Vínculos entre un paciente y sus cuidadores: código de invitación, estado (`pending`/`accepted`), correos de ambas partes. |

Todas las tablas tienen **RLS habilitado**. Cada usuario ve/edita sus propios datos (`auth.uid() = user_id`), y además cualquier fila cuyo dueño lo tenga como cuidador aceptado (`is_caregiver_of(user_id)`). El storage de fotos (`medication-photos`) es un bucket público de solo-subida-autenticada.

## Sistema de cuidadores

1. El paciente genera un código de 6 caracteres desde **Perfil → Invita a alguien para que te ayude**.
2. El cuidador lo ingresa en **su propia cuenta**, en **Perfil → Tengo un código de invitación**.
3. Al vincularse, el cuidador puede cambiar entre "mi cuenta" y "cuenta del paciente" desde Perfil; mientras ve la cuenta de otra persona, un banner morado lo indica en todas las pantallas y cualquier cambio de horario muestra un aviso de que la alarma no sonará en el teléfono del paciente hasta que esa persona abra la app.
4. Cualquiera de las dos partes puede desvincularse en cualquier momento desde Perfil.

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm start` | Inicia el servidor de desarrollo de Expo |
| `npm run android` | Compila y corre un build nativo en Android |
| `npm run ios` | Compila y corre un build nativo en iOS |
| `npm run web` | Corre la app en el navegador |
| `npm run lint` | Corre ESLint (`eslint-config-expo`) |

## Build y despliegue (EAS)

Perfiles definidos en [`eas.json`](./eas.json):

| Perfil | Uso | Tipo de build (Android) |
|---|---|---|
| `development` | Development client para seguir desarrollando con hot reload | APK |
| `preview` | Compartir un build instalable sin pasar por la tienda | APK |
| `production` | Publicar en Google Play | App Bundle (`.aab`) |

```bash
npx eas login
npx eas build --profile preview --platform android      # APK para probar/compartir
npx eas build --profile production --platform android   # App Bundle para Play Store
```

## Limitaciones conocidas

- **Alarmas 100% locales al dispositivo** — no hay push notifications desde servidor. Ver la nota en [Arquitectura](#arquitectura-y-decisiones-importantes).
- **Solo una tarjeta de "dosis urgente" a la vez** en Inicio: si dos medicamentos coinciden en horario, el segundo solo aparece en la lista normal, sin la misma urgencia visual.
- **AdBanner es un placeholder** — no hay integración real de AdMob todavía (ver [paso 5 de instalación](#5-opcional-anuncios-admob-reales)).
- **iOS no está configurado/probado** — `app.json` declara `bundleIdentifier` y permisos de iOS, pero el desarrollo y las pruebas se han hecho en Android; la alarma nativa vía `expo-intent-launcher` es Android-only.
- **Editar el horario de un medicamento crea una alarma nueva** en la app de Reloj sin borrar la anterior — hay que borrar la vieja ahí manualmente.
- **El correo por defecto de Supabase** (sin SMTP propio) tiene un límite muy bajo de envíos por hora — suficiente para desarrollo, no para producción real.

## Solución de problemas comunes

| Problema | Causa probable / solución |
|---|---|
| Las alarmas dejan de sonar después de un tiempo | Falta activar "sin restricciones de batería" — guía en **Perfil → Configurar Permisos** (Android) |
| No llega el correo de recuperación de contraseña | Falta configurar SMTP propio en Supabase — ver [paso 3](#3-configurar-la-recuperación-de-contraseña-por-correo) |
| `npx expo run:android` falla por Java | Los builds EAS usan Java 17 (`eas.json`); asegúrate de tener JDK 17 en local también |
| La cámara/galería no abren en el navegador | Es normal — la web no tiene acceso completo a cámara nativa; usa un development build |
| Error de RLS ("new row violates row-level security policy") | Falta correr `supabase-schema.sql` completo, o falta la migración de cuidadores al final del archivo |

## Licencia

Proyecto privado (`"private": true` en `package.json`), sin licencia pública de distribución.
