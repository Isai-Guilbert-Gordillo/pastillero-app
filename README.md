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
- [Consentimiento y documentos legales](#consentimiento-y-documentos-legales)
- [Permisos de Android](#permisos-de-android)
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
│   │   └── profile.tsx           # Perfil, apariencia, cuidado compartido, cerrar sesión, eliminar cuenta
│   ├── add.tsx                   # Agregar medicamento (pantalla completa, no es un destino)
│   ├── details/[id].tsx          # Detalle y edición de un medicamento
│   ├── alarm.tsx                 # Pantalla de alarma a pantalla completa
│   ├── permissions-guide.tsx     # Guía de activación de permisos (Android)
│   └── delete-account.tsx        # Eliminar cuenta y datos (requisito de Google Play)
├── components/
│   ├── Feedback.tsx               # Snackbar + bottom sheet + diálogo (useFeedback)
│   ├── MedicationPhoto.tsx        # Foto del medicamento: firma la URL del bucket privado
│   ├── PatientBanner.tsx          # Banner "Viendo la cuenta de X" en modo cuidador
│   ├── WebTimePicker.tsx          # Selector de hora propio para la versión web
│   └── ui/                        # Design system Material 3: Text, Surface, Button, Chip,
│                                  # TextField, TopAppBar, NavigationBar, Fab, ListItem,
│                                  # DoseStatus, IconBadge
├── context/
│   ├── AuthContext.tsx            # Sesión de Supabase Auth (login/registro/reset de contraseña)
│   ├── CaregiverContext.tsx       # Cuenta activa (propia o de un paciente), invitaciones, vínculos
│   └── ThemeContext.tsx           # Esquema claro/oscuro (useTheme, useThemedStyles)
├── lib/
│   ├── supabase.ts                # Cliente de Supabase (credenciales desde .env)
│   ├── links.ts                   # URLs públicas (privacidad, términos) y versión legal aceptada
│   ├── push.ts                    # Token de dispositivo para los avisos al cuidador
│   ├── photos.ts                  # Subida, borrado y firma de fotos del bucket privado
│   ├── notifications.ts           # Cálculo de horarios, notificaciones locales, alarma nativa
│   ├── doseSync.ts                # Reconciliación automática de dosis pendientes/no tomadas
│   ├── theme.ts                   # Tokens del sistema: roles de color (claro y oscuro), escala
│   │                              # tipográfica, espaciado, forma, elevación, movimiento
│   └── types.ts                   # Tipos: Medication, DoseRecord, CaregiverLink
├── docs/                          # Páginas públicas: privacidad y eliminación de cuenta (GitHub Pages)
├── DESIGN.md                      # Sistema de diseño: doctrina, roles y reglas (leer antes de tocar UI)
├── PRODUCT.md                     # Contexto de producto: usuarios, promesa, restricciones
├── supabase-schema.sql            # Esquema completo + migraciones (correr en el SQL Editor de Supabase)
├── patches/                       # Parches aplicados con patch-package (postinstall)
├── plugins/                       # Config plugins locales de Expo (permisos del manifiesto Android)
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
3. Activa las extensiones **`pg_cron`** y **`pg_net`** en **Database → Extensions**. Las usan el cierre automático de tratamientos vencidos y los avisos push al cuidador; sin ellas, esas partes del `.sql` fallan.
4. Ve a **Project Settings → API** y copia la **Project URL** y la **anon public key**.

### 3. Variables de entorno

Las credenciales **no van en el código**. Copia la plantilla y llénala:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

`.env` está en `.gitignore`. Si faltan las variables, [`lib/supabase.ts`](./lib/supabase.ts) lanza un error explícito al arrancar en vez de fallar más tarde como "no se pudo guardar, revisa tu conexión".

> La clave `anon` es pública por diseño: viaja dentro del APK y en cada petición. Lo que protege los datos son las políticas RLS del paso anterior. **Nunca** pongas aquí la `service_role` key — esa salta todas las políticas.

**Para los builds de EAS**, que no ven tu `.env` local, hay que registrarlas como variables de entorno de EAS. Cada perfil de [`eas.json`](./eas.json) apunta a su entorno (`development` / `preview` / `production`):

```bash
npx eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://tu-proyecto.supabase.co --visibility plaintext
```

Repite para `EXPO_PUBLIC_SUPABASE_ANON_KEY` y para cada entorno que vayas a compilar. Esto además permite tener un proyecto de Supabase de pruebas y otro de producción sin riesgo de publicar apuntando al equivocado.

### 4. Configurar el correo (SMTP propio)

Por defecto Supabase manda correos con un servicio compartido de **muy pocos envíos por hora** — sirve para desarrollo, se cae con usuarios reales — y **no permite personalizar la plantilla**. Este proyecto necesita mostrar un código en el correo (no un link), así que el SMTP propio no es opcional para producción:

1. Crea una cuenta en un proveedor transaccional. **Resend** es el más simple (3.000 correos/mes gratis); SendGrid o Postmark sirven igual. Gmail con una [contraseña de aplicación](https://myaccount.google.com/apppasswords) alcanza para uso personal, pero no para una app publicada.
2. Verifica tu dominio en el proveedor (registros SPF y DKIM). Sin esto, los correos caen en spam — que en la práctica es lo mismo que no enviarlos.
3. En Supabase, **Authentication → SMTP Settings**, activa *Enable Custom SMTP* y pon los datos del proveedor. El remitente debe ser una dirección de tu dominio verificado.
4. En **Authentication → Email Templates → "Reset Password"**, edita el cuerpo para incluir el código:

   ```html
   <h2>Recupera tu contraseña</h2>
   <p>Tu código para poner una contraseña nueva es:</p>
   <h1>{{ .Token }}</h1>
   <p>Este código vence en 1 hora. Si tú no pediste este cambio, ignora este correo.</p>
   ```

5. En **Authentication → Rate Limits**, sube el límite de correos por hora, que sigue en el valor bajo por defecto aunque ya tengas SMTP propio.

Sin este paso el registro y el login funcionan igual — solo "¿Olvidaste tu contraseña?" queda inservible en cuanto haya más de un puñado de usuarios.

### 5. Personalizar identificadores de la app (opcional)

En [`app.json`](./app.json), si vas a publicar tu propia copia, cambia:

- `expo.name`, `expo.slug`
- `expo.ios.bundleIdentifier` y `expo.android.package` (hoy `com.pastilleroapp.app`)
- `expo.extra.eas.projectId` (lo genera EAS al correr `eas init`)

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
| `device_tokens` | Un token de push de Expo por teléfono. Alimenta los [avisos al cuidador](#avisos-push-al-cuidador). |

Todas las tablas tienen **RLS habilitado**. Cada usuario ve/edita sus propios datos (`auth.uid() = user_id`), y además cualquier fila cuyo dueño lo tenga como cuidador aceptado (`is_caregiver_of(user_id)`).

### Fotos de medicamentos

El bucket `medication-photos` es **privado**. La foto de una caja de pastillas es un dato de salud, así que no se sirve por URL pública:

- Las fotos se guardan en `<user_id del paciente>/<timestamp>.jpg`, y las políticas del bucket resuelven el acceso a partir de esa primera carpeta: pasa el dueño y sus cuidadores aceptados, nadie más (`can_access_photo_folder()`).
- `medications.photo_url` guarda la **ruta dentro del bucket**, no una URL. [`lib/photos.ts`](./lib/photos.ts) pide una URL firmada de 1 hora al momento de mostrarla, con caché en memoria para no firmar una vez por tarjeta de la lista.
- Ninguna pantalla llama a storage directo: todas usan [`components/MedicationPhoto.tsx`](./components/MedicationPhoto.tsx), que firma, cachea y cae al marcador de "sin foto" si no hay conexión.

### Eliminar la cuenta

**Perfil → Eliminar mi cuenta** ([`app/delete-account.tsx`](./app/delete-account.tsx)) llama a la función `delete_my_account()`, que borra —solo del usuario que la invoca, leído de `auth.uid()`— sus fotos del bucket, sus `dose_records`, sus `medications`, sus `caregiver_links` en ambas direcciones y por último su fila de `auth.users`. Si quien borra su cuenta es un cuidador, los datos del paciente **no** se tocan: solo pierde el acceso.

Es requisito de publicación en Google Play, no un extra. Google exige además una página web donde se pueda pedir el borrado **sin instalar la app**: está en [`docs/`](./docs/README.md), junto con la política de privacidad. Ambas tienen marcadores que hay que rellenar antes de publicarlas — ver [docs/README.md](./docs/README.md).

## Sistema de cuidadores

1. El paciente genera un código de 6 caracteres desde **Perfil → Invita a alguien para que te ayude**.
2. El cuidador lo ingresa en **su propia cuenta**, en **Perfil → Tengo un código de invitación**.
3. Al vincularse, el cuidador puede cambiar entre "mi cuenta" y "cuenta del paciente" desde Perfil; mientras ve la cuenta de otra persona, un banner morado lo indica en todas las pantallas y cualquier cambio de horario muestra un aviso de que la alarma no sonará en el teléfono del paciente hasta que esa persona abra la app.
4. Cualquiera de las dos partes puede desvincularse en cualquier momento desde Perfil.

### Avisos push al cuidador

Las alarmas del paciente son y siguen siendo **100% locales**: no dependen de internet ni de que el servidor esté vivo, que es justo lo que las hace fiables. Lo que sí sale del servidor es el aviso al **cuidador**.

Un job de `pg_cron` corre cada 5 minutos dentro de Postgres (`notify_caregivers_of_missed_doses()`), busca dosis que llevan más de **30 minutos** sin confirmar —y menos de 6 horas, porque enterarse de madrugada de una dosis de ayer no sirve— y manda un push por `pg_net` a la API de Expo, al teléfono de cada cuidador aceptado.

Dos decisiones que parecen detalles y no lo son:

- **El mensaje no dice la hora de la dosis.** `scheduled_at` es `timestamptz` y el servidor no conoce la zona horaria del paciente: imprimir "las 14:00" daría una hora equivocada para casi todos. En una app de medicamentos, una hora incorrecta es peor que ninguna.
- **El payload no lleva `medicationId`.** Los observadores de [`app/_layout.tsx`](./app/_layout.tsx) reconocen ese campo como "alarma mía"; incluirlo haría que al cuidador se le abriera la pantalla de alarma a pantalla completa por la medicina de otra persona. Por si acaso, esos observadores ahora exigen además `type === 'ALARM'`.

Los tokens viven en `device_tokens`, uno por teléfono (`expo_push_token` es `UNIQUE`), se reafirman en cada arranque con sesión y se borran al cerrar sesión — antes del `signOut`, porque después RLS ya no dejaría. Un job semanal limpia los que llevan 90 días sin tocarse: teléfonos formateados o con la app desinstalada.

## Consentimiento y documentos legales

Al crear una cuenta hay que marcar a mano una casilla —nunca premarcada— que acepta los [términos de uso](./docs/terminos.html) y autoriza el tratamiento de datos de salud. La distinción entre consentimiento **expreso** y "por usar la app ya aceptaste" es exactamente esa casilla: la ley mexicana (LFPDPPP) exige el primero para datos sensibles, y los de salud lo son.

El consentimiento se guarda en `user_metadata` al registrarse, con la **versión** de los documentos y la fecha (`legal_version`, `legal_accepted_at`, `health_data_consent`). Un "aceptó los términos" sin decir cuáles ni cuándo no demuestra nada en cuanto el texto cambia.

> Al cambiar de forma sustancial `docs/terminos.html` o `docs/privacidad.html`, **sube `LEGAL_VERSION`** en [`lib/links.ts`](./lib/links.ts).

## Permisos de Android

Google Play rechaza —o marca en revisión— los permisos declarados que la app no usa. El manifiesto final **no es** la lista de `android.permissions` de `app.json`: se fusiona con los manifiestos de las librerías y con la plantilla de Expo, y ahí se cuelan permisos que nadie escribió. Estos son los que pide la app y por qué:

| Permiso | Para qué | De dónde sale |
|---|---|---|
| `POST_NOTIFICATIONS` | Avisar de cada dosis | app.json + expo-notifications |
| `SCHEDULE_EXACT_ALARM` | Que la alarma suene a la hora exacta, no "más o menos" | app.json |
| `USE_FULL_SCREEN_INTENT` | Que la alarma tome la pantalla con el teléfono bloqueado | app.json |
| `RECEIVE_BOOT_COMPLETED` | Reprogramar alarmas tras reiniciar el teléfono | app.json + expo-notifications |
| `WAKE_LOCK`, `VIBRATE` | Despertar la pantalla y vibrar al sonar | app.json |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Guía de permisos: evitar que Android mate las alarmas | app.json (`permissions-guide.tsx`) |
| `SET_ALARM` | Crear la alarma de respaldo en el Reloj del sistema (`scheduleNativeAlarms`) | app.json |
| `CAMERA` | Tomar la foto del medicamento | app.json + expo-image-picker |
| `INTERNET` | Hablar con Supabase | plantilla de Expo |
| `MODIFY_AUDIO_SETTINGS` | Tomar el foco de audio para que la alarma suene sobre otras apps | expo-av |
| `READ/WRITE_EXTERNAL_STORAGE` | Elegir foto de la galería **solo en Android 12 o menor** | expo-image-picker (acotados a `maxSdkVersion=32`) |

### Los tres casos que necesitaron trabajo

- **`RECORD_AUDIO` — bloqueado.** El plugin de `expo-image-picker` lo agrega **solo**, aunque nunca se grabe audio, salvo que se le pase `microphonePermission: false`. Quitarlo de la lista de `permissions` no bastaba: hay que bloquearlo. Un micrófono en una app de recordatorios de medicamentos es exactamente la incoherencia que la revisión de Play busca.
- **`SYSTEM_ALERT_WINDOW` ("mostrar sobre otras apps") — bloqueado.** Viene de la plantilla bare de Expo, que lo marca como "OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT NEED" y nadie remueve. La app no dibuja encima de nada: usa full-screen intent. Es un permiso sensible que Google revisa con lupa.
- **`READ/WRITE_EXTERNAL_STORAGE` — acotados, no eliminados.** Los declara el manifiesto de expo-image-picker. Desde Android 13 el selector de fotos no necesita permiso, pero en Android 12 o menor `requestMediaLibraryPermissionsAsync()` sí los pide de verdad, y como `add.tsx` corta si el permiso no se concede, bloquearlos dejaría sin galería justo a los teléfonos viejos. [`plugins/withLegacyStoragePermissions.js`](./plugins/withLegacyStoragePermissions.js) les pone `maxSdkVersion=32` con `tools:replace` — sin `tools:replace` el fusionador ve la declaración sin límite de la librería y el techo se pierde en silencio.

### Comprobar el manifiesto real

`app.json` no dice la verdad completa. Para ver lo que de verdad se va a firmar:

```bash
npx expo prebuild --platform android --no-install --clean
```

Luego revisa `android/app/src/main/AndroidManifest.xml`: los bloqueados deben aparecer con `tools:node="remove"` y los de almacenamiento con `android:maxSdkVersion="32"`. La carpeta `android/` es desechable — bórrala al terminar, el proyecto usa CNG y se regenera en cada build.

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

- **Las alarmas del paciente son 100% locales al dispositivo** — a propósito: no deben depender de internet. El cuidador **sí** recibe push desde el servidor cuando una dosis queda sin confirmar (ver [Avisos push al cuidador](#avisos-push-al-cuidador)), pero un cambio de horario hecho por el cuidador sigue sin sonar en el teléfono del paciente hasta que esa persona abre la app.
- **Solo una tarjeta de "dosis urgente" a la vez** en Inicio: si dos medicamentos coinciden en horario, el segundo solo aparece en la lista normal, sin la misma urgencia visual.
- **La app no tiene anuncios.** Antes había un placeholder visual (`AdBanner`) que se quitó antes de publicar; no hay ningún SDK de anuncios integrado.
- **iOS no está configurado/probado** — `app.json` declara `bundleIdentifier` y permisos de iOS, pero el desarrollo y las pruebas se han hecho en Android; la alarma nativa vía `expo-intent-launcher` es Android-only.
- **Editar el horario de un medicamento crea una alarma nueva** en la app de Reloj sin borrar la anterior — hay que borrar la vieja ahí manualmente.
- **El correo por defecto de Supabase** (sin SMTP propio) tiene un límite muy bajo de envíos por hora — suficiente para desarrollo, no para producción real. Ver el [paso 4 de instalación](#4-configurar-el-correo-smtp-propio).

## Solución de problemas comunes

| Problema | Causa probable / solución |
|---|---|
| Las alarmas dejan de sonar después de un tiempo | Falta activar "sin restricciones de batería" — guía en **Perfil → Configurar Permisos** (Android) |
| No llega el correo de recuperación de contraseña | Falta configurar SMTP propio en Supabase — ver [paso 3](#3-configurar-la-recuperación-de-contraseña-por-correo) |
| `npx expo run:android` falla por Java | Los builds EAS usan Java 17 (`eas.json`); asegúrate de tener JDK 17 en local también |
| La cámara/galería no abren en el navegador | Es normal — la web no tiene acceso completo a cámara nativa; usa un development build |
| Error de RLS ("new row violates row-level security policy") | Falta correr `supabase-schema.sql` completo, o falta la migración de cuidadores al final del archivo |
| Las fotos de los medicamentos salen como el ícono gris | Falta correr la migración "Fotos privadas" (bucket + políticas), o el teléfono está sin conexión y no se pudo firmar la URL |
| "No se pudo eliminar la cuenta" en Perfil → Eliminar mi cuenta | Falta correr la migración "Eliminar mi cuenta" — sin ella la función `delete_my_account()` no existe en la base |
| La app no arranca: "Faltan EXPO_PUBLIC_SUPABASE_URL..." | Falta el archivo `.env` (ver [paso 3](#3-variables-de-entorno)). En builds de EAS, faltan las variables de entorno del perfil |
| El cuidador no recibe avisos de dosis sin confirmar | Revisa en orden: extensión `pg_net` activa, job `notify-caregivers-missed-doses` en `cron.job`, fila del cuidador en `device_tokens`, y que el aviso no se esté probando en Expo Go (el token push necesita un build nativo) |
| El código de invitación de cuidador dice "no es válido" siendo nuevo | Falta correr la migración "Expiración y límite de intentos" al final de `supabase-schema.sql` — la función `redeem_caregiver_invite()` vieja no filtra por `expires_at` |
| "Demasiados intentos" al canjear un código de invitación | Límite de seguridad: 10 intentos cada 15 minutos por cuenta, para que un código de 6 caracteres no se pueda adivinar por fuerza bruta contra la API. Espera y vuelve a intentar |

## Licencia

Proyecto privado (`"private": true` en `package.json`), sin licencia pública de distribución.
