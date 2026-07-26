---
name: PastilleroApp
description: Material 3 templado para manos que tiemblan — el teal de la marca convertido en un sistema tonal completo, claro y oscuro.
colors:
  primary: "#0F766E"
  on-primary: "#FFFFFF"
  primary-container: "#99F6E4"
  on-primary-container: "#00201C"
  brand-teal: "#0D9488"
  secondary: "#4338CA"
  on-secondary: "#FFFFFF"
  secondary-container: "#E0E7FF"
  on-secondary-container: "#16135C"
  tertiary: "#BE123C"
  on-tertiary: "#FFFFFF"
  tertiary-container: "#FFE4E8"
  on-tertiary-container: "#4C0519"
  error: "#B91C1C"
  on-error: "#FFFFFF"
  error-container: "#FEE2E2"
  on-error-container: "#450A0A"
  warning: "#92400E"
  warning-container: "#FEF3C7"
  on-warning-container: "#451A03"
  success: "#047857"
  success-container: "#D1FAE5"
  on-success-container: "#022C22"
  background: "#EEF2F6"
  surface: "#FFFFFF"
  surface-container: "#F6F8FA"
  surface-variant: "#E2E8F0"
  on-surface: "#0F172A"
  on-surface-variant: "#475569"
  on-surface-muted: "#64748B"
  outline: "#7C8BA1"
  outline-variant: "#CBD5E1"
  dark-background: "#0B1416"
  dark-surface: "#121D20"
  dark-surface-variant: "#1F2E31"
  dark-surface-container: "#172427"
  dark-on-surface: "#E6EDEF"
  dark-on-surface-variant: "#B3C1C4"
  dark-on-surface-muted: "#8CA0A3"
  dark-outline: "#7E9295"
  dark-outline-variant: "#334144"
  dark-primary: "#5EEAD4"
  dark-on-primary: "#00382F"
  dark-primary-container: "#00554C"
  dark-on-primary-container: "#99F6E4"
typography:
  display:
    fontFamily: "Poppins_800ExtraBold"
    fontSize: "44sp"
    lineHeight: "52sp"
    letterSpacing: "-0.5"
  headline:
    fontFamily: "Poppins_700Bold"
    fontSize: "26sp"
    lineHeight: "34sp"
    letterSpacing: "0"
  title:
    fontFamily: "Poppins_600SemiBold"
    fontSize: "20sp"
    lineHeight: "28sp"
    letterSpacing: "0.15"
  body:
    fontFamily: "Poppins_400Regular"
    fontSize: "19sp"
    lineHeight: "30sp"
    letterSpacing: "0.15"
  label:
    fontFamily: "Poppins_700Bold"
    fontSize: "18sp"
    lineHeight: "24sp"
    letterSpacing: "0.1"
rounded:
  extraSmall: "4dp"
  small: "8dp"
  medium: "12dp"
  large: "16dp"
  extraLarge: "28dp"
  full: "999dp"
spacing:
  xs: "4dp"
  sm: "8dp"
  md: "12dp"
  lg: "16dp"
  xl: "24dp"
  xxl: "32dp"
  xxxl: "48dp"
components:
  button-filled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "16dp 24dp"
    height: "64dp"
  button-tonal:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.full}"
    height: "64dp"
  button-info:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "{rounded.full}"
    height: "64dp"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    height: "64dp"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    height: "48dp"
  fab-extended:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.large}"
    padding: "0 24dp"
    height: "72dp"
  fab-collapsed:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.large}"
    size: "72dp 72dp"
  chip-filter-selected:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.small}"
    height: "56dp"
  chip-filter-unselected:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.small}"
    height: "56dp"
  card-elevated:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.large}"
    padding: "16dp"
  text-field:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.extraSmall}"
    height: "72dp"
  nav-bar-item-active:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.full}"
    size: "64dp 40dp"
---

# Design System: PastilleroApp

## Overview

**Creative North Star: "El Pastillero de Metal"**

Un pastillero físico de los que se compran en la farmacia: compartimentos de tapa dura, una casilla por día, un chasquido inequívoco cuando cierra. No hay ambigüedad sobre si una casilla está llena o vacía; no hace falta leer nada para saberlo. Ese objeto es la referencia. La app es su versión en pantalla: **compartimentos explícitos, estados binarios legibles a un metro de distancia, y una sola cosa que hacer por pantalla.**

El vocabulario es Material 3 sin diluir —roles de color, escala de tipos, barra de navegación, FAB, snackbar, bottom sheet, diálogos— porque una persona de 80 años ya aprendió estos gestos en el resto de su teléfono Android, y cada componente inventado es una lección nueva que no pidió. Sobre esa gramática la marca aporta una sola cosa: el teal. El resto es rigor.

La densidad es deliberadamente baja. Donde una app de productividad mete seis acciones, aquí va una. Donde una app moderna usa 14sp, aquí el piso es 16sp y el cuerpo son 19sp. El espacio en blanco no es estética: es el margen de error de un dedo que no apunta fino.

Anti-referencia confirmada, tomada del código anterior: **la pila infinita de tarjetas blancas idénticas sobre gris con sombra suave**, cada pantalla coronada por el mismo encabezado de degradado teal con emoji. Todo se veía igual de importante, así que nada lo era.

**Key Characteristics:**
- Material 3 nativo: nada de controles inventados ni portados de iOS.
- Esquema tonal completo desde un solo tono teal, claro y oscuro de primera clase.
- Piso tipográfico de 16sp, cuerpo de 19sp, todo escalable con el ajuste del sistema.
- Objetivo táctil mínimo de 64×64dp (por encima de los 48dp de Material) con 8dp de separación.
- Un FAB, una acción principal por pantalla.
- Profundidad por elevación tonal antes que por sombra.

## Colors

Un solo tono —el teal de la marca— extendido a una rampa tonal completa, con índigo para lo informativo, rosa para el calor humano y tres roles semánticos (éxito / aviso / error) que jamás se usan decorativamente.

### Primary
- **Teal Clínico** (`{colors.primary}`): el rol primario real. Es el `brand-teal` de la marca bajado dos tonos para que texto blanco encima pase 4.5:1 a cualquier tamaño. Vive en el botón principal, el estado activo de navegación, los enlaces y los valores de hora.
- **Teal Marca** (`{colors.brand-teal}`): el tono de identidad declarado en PRODUCT.md. Se reserva para superficies grandes donde no hay texto encima (el campo de la pantalla de alarma, el ícono adaptativo) y como `primary` del esquema oscuro en su versión clara (`{colors.dark-primary}`).
- **Menta de Contenedor** (`{colors.primary-container}`): el fondo de todo lo que es "lo siguiente que va a pasar" — la píldora de próxima toma, el FAB, el indicador activo de la barra de navegación.

### Secondary
- **Índigo de Aviso** (`{colors.secondary}`): estrictamente informativo, nunca decorativo. Marca el modo cuidador —la única condición en la que el usuario no está viendo su propia cuenta— y los pasos de configuración del sistema.

**La Regla del Índigo Prestado.** El índigo NO es "el segundo color de la marca": es una señal de que estás fuera de tu propia cuenta. En Material 3 el rol `secondary` es una versión desaturada del primario, y ahí un botón tonal sale del mismo tono que el relleno; aquí `secondary` es otro tono, así que **un botón tonal jamás lo usa** — saldría morado junto a un botón teal y leería como dos productos pegados. Los botones de baja énfasis toman `{colors.primary-container}`.

### Tertiary
- **Rosa de Medicina** (`{colors.tertiary}`): el calor humano del sistema. Identifica al medicamento como objeto (el ícono de la píldora, el encabezado de las secciones del formulario). Nunca es un estado.

### Neutral
- **Gris Sala de Espera** (`{colors.background}`): el suelo de la app. Un slate frío y clarísimo que hace que las superficies blancas floten sin necesidad de sombra.
- **Blanco Compartimento** (`{colors.surface}`): las tarjetas, hojas y diálogos. El "compartimento" del pastillero.
- **Tinta** (`{colors.on-surface}`): el texto. Slate-900, no negro puro — 17:1 contra blanco.
- **Tinta Suave** (`{colors.on-surface-variant}`): el texto secundario, a 7.6:1. El slate-500 del sistema anterior (4.7:1) queda solo para placeholders.
- **Contorno** (`{colors.outline}`): bordes de componentes interactivos, a 3.4:1 — el mínimo de Material para elementos no textuales.

### Named Rules

**La Regla del Semáforo Honesto.** Verde (`{colors.success}`), ámbar (`{colors.warning}`) y rojo (`{colors.error}`) solo describen el estado de una dosis o de una operación: tomada, pendiente, no tomada, fallida. Un ámbar decorativo destruye la única señal que esta app no puede permitirse perder.

**La Regla del Rojo Reservado.** El rojo nunca decora urgencia. La alarma no es un error; es la app funcionando. La urgencia se transmite con escala, movimiento, sonido y vibración, no con un degradado rojo en la cara a las 3 AM.

**La Regla del Rol, no del Hex.** Ningún componente escribe un hexadecimal. Todo pasa por un rol del esquema activo, porque un hex no sabe resolverse en modo oscuro.

## Typography

**Display / Body / Label Font:** Poppins (400 Regular, 500 Medium, 600 SemiBold, 700 Bold, 800 ExtraBold)

**Character:** Poppins es una geométrica de formas casi circulares y aperturas amplias — la `a` de un piso, la `e` de barra horizontal recta. A tamaños grandes lee cálida y sin adornos; es exactamente la razón por la que sostiene 44sp sin volverse pomposa y 19sp sin volverse frágil.

### Hierarchy
- **Display** (ExtraBold, 44/36/30sp, interlínea 1.18): un solo uso por pantalla y solo cuando el dato ES la pantalla — el nombre del medicamento en la alarma, la cuenta regresiva de la próxima toma.
- **Headline** (Bold, 30/26/24sp, interlínea 1.3): títulos de pantalla en la barra superior grande y encabezados de estado vacío.
- **Title** (SemiBold, 22/20/18sp, interlínea 1.4): nombres de medicamento en lista, títulos de tarjeta y de diálogo.
- **Body** (Regular, 19/18/16sp, interlínea 1.55): toda la prosa. Instrucciones, texto de apoyo, descripciones.
- **Label** (Bold/SemiBold, 18/16/14sp, tracking +0.1 a +0.5): texto dentro de controles — botones, chips, etiquetas de navegación, leyendas.

### Named Rules

**La Regla de los 16.** Ningún texto baja de 16sp. Ninguno. Si algo no cabe a 16sp, el problema es la caja, no el texto.

**La Regla del sp Con Techo.** Todo tamaño está en sp y sigue el ajuste de fuente del sistema, pero con `maxFontSizeMultiplier` (1.5 en display/headline, 1.8 en body, 1.6 en label): al 200% del sistema una alarma ilegible por desbordamiento es peor que una alarma un poco más chica.

**La Regla del Peso, no del Color.** El énfasis dentro de un párrafo se hace subiendo de peso (Regular → Bold), nunca coloreando la palabra. El color está reservado al estado.

## Layout

Cuadrícula base de **4dp**, con la mayoría de las decisiones sobre múltiplos de **8dp**.

- **Margen de pantalla:** 16dp en ancho compacto (el margen de Material para compact window). Todo lo que sea contenido de lectura o control comparte ese borde izquierdo — la alineación es lo que evita que la pantalla se lea como una colección de recortes.
- **Ritmo vertical:** 8dp entre elementos del mismo grupo, 16dp dentro de una tarjeta, 24dp entre grupos, 32dp antes de un encabezado de sección. Siempre más aire arriba de un encabezado que abajo.
- **Objetivo táctil:** **64×64dp mínimo** con 8dp de separación entre objetivos adyacentes. Material pide 48dp; el compromiso de PRODUCT.md para 80+ manda, y este sistema lo formaliza como un token (`TOUCH.min`), no como un número suelto en cada archivo.
- **Insets:** contenido de borde a borde. Cada pantalla aplica los insets de barra de estado, barra de navegación, cutout y teclado (IME) explícitamente. La barra de navegación inferior absorbe el inset inferior; los `ScrollView` suman el inset al `contentContainerStyle`, nunca lo pintan con un `View` vacío.
- **Clases de ventana:** el objetivo real es compact. La cuadrícula de opciones (horarios, días) usa `flexWrap` con anchos mínimos en dp, así que al crecer el ancho o la fuente reflow en lugar de romperse.

### Named Rules

**La Regla del Borde Único.** Todo el contenido de una pantalla arranca en el mismo x = 16dp. Un elemento que se sale de ese borde está reclamando importancia; si no la tiene, está mal alineado.

## Elevation & Depth

**Híbrido, con la elevación tonal primero.** La separación entre capas se consigue cambiando el color de superficie (blanco sobre `background` gris); la sombra solo confirma lo que el tono ya dijo, y solo en elementos que de verdad flotan sobre el contenido: FAB, bottom sheet, diálogo, snackbar y la barra superior cuando el contenido pasa por debajo.

En modo oscuro las sombras son prácticamente invisibles, así que la elevación es **exclusivamente tonal**: cada nivel sube el tono de la superficie (`dark-surface` → `dark-surface-container` → más claro).

### Shadow Vocabulary
- **level1** (`offset 0/1, blur 3, opacity 0.10, elevation 1`): tarjeta en reposo. Casi imperceptible; el tono hace el trabajo.
- **level2** (`offset 0/2, blur 6, opacity 0.12, elevation 3`): barra superior con contenido debajo, chip elevado.
- **level3** (`offset 0/4, blur 12, opacity 0.14, elevation 6`): FAB, snackbar.
- **level4** (`offset 0/8, blur 24, opacity 0.18, elevation 8`): bottom sheet, diálogo.

### Named Rules

**La Regla del Halo Prohibido.** Ninguna sombra tiene offset 0 y color de marca. Un resplandor teal centrado no es profundidad, es decoración; y en modo oscuro no existe.

**La Regla de la Tarjeta que No Anida.** Una tarjeta nunca contiene otra tarjeta. Si un bloque dentro de una tarjeta necesita separarse, cambia de tono (`surface-container`), no de elevación.

## Shapes

Escala de forma de Material 3 completa, aplicada por función y no por gusto:

- **extraSmall (4dp):** campos de texto (que son rectángulos con borde superior redondeado en Material, aquí simplificados a caja outlined), indicadores pequeños.
- **small (8dp):** chips, píldoras de la cuadrícula del historial.
- **medium (12dp):** contenedores internos dentro de una tarjeta, bloques de código de invitación.
- **large (16dp):** tarjetas, hojas de contenido, FAB.
- **extraLarge (28dp):** diálogos, bottom sheets, el contenedor de la alarma.
- **full (999dp):** botones, badges, indicador activo de navegación, avatares.

La silueta recurrente es el **rectángulo de esquina generosa**: nada es un círculo salvo lo que representa a una persona o a un ícono; nada es un ángulo recto salvo un separador.

### Named Rules

**La Regla del Botón Cápsula.** Todo botón de acción es `full`. Es la forma que Material usa para "esto se toca" y a 80 años se reconoce antes de leerla.

## Components

### Buttons
- **Shape:** cápsula completa (`{rounded.full}`).
- **Altura:** 64dp de mínimo (`TOUCH.min`), 72dp en la acción principal de una pantalla.
- **Filled (`{components.button-filled}`):** la única acción principal. Un `filled` por pantalla; dos compiten.
- **Tonal (`{components.button-tonal}`):** el hermano de baja énfasis del `filled`, y por lo tanto de **su misma familia de color** — "El doctor lo extendió" junto a "Ya terminé", o "Ya la tomé" en una dosis pendiente secundaria. Un tonal en otro tono se lee como otro producto.
- **Info (`{components.button-info}`):** el único índigo con forma de botón, reservado al modo cuidador. Ver *La Regla del Índigo Prestado*.
- **Outlined (`{components.button-outlined}`):** acción de bajo compromiso con borde de 1dp en `{colors.outline}`.
- **Text (`{components.button-text}`):** acciones dentro de diálogos y snackbars.
- **Pressed:** capa de estado del 12% del color de contenido sobre el fondo, más una compresión de escala a 0.97 en 100ms. No cambia el color base.
- **Loading:** el rótulo se reemplaza por un indicador del color de contenido; la caja no cambia de tamaño.

### Chips
- **Style:** chip de filtro de Material. Sin seleccionar: transparente con borde de 1dp en `{colors.outline}`. Seleccionado: `{colors.primary-container}` sin borde, con un ícono de palomita a la izquierda que aparece en 150ms.
- **Altura:** 56dp (por encima de los 32dp de Material, por el compromiso de accesibilidad).
- **State:** la palomita, no solo el color, comunica la selección — daltonismo y cataratas son parte del público.

### Cards / Containers
- **Corner Style:** `{rounded.large}`.
- **Background:** `{colors.surface}`.
- **Shadow Strategy:** `level1` y nada más; ver *La Regla de la Tarjeta que No Anida*.
- **Border:** ninguno en reposo. Un borde de 1dp en un rol semántico marca estado (tratamiento vencido, pendiente de limpieza).
- **Internal Padding:** 16dp.

### Inputs / Fields
- **Style:** campo outlined de Material — borde de 1dp en `{colors.outline}`, esquina `{rounded.extraSmall}`, etiqueta persistente arriba del campo (no flotante: una etiqueta que se mueve al enfocar es un truco que confunde a este público).
- **Focus:** borde a 2dp en `{colors.primary}` y etiqueta al mismo color.
- **Error:** borde y etiqueta en `{colors.error}` más una línea de texto de apoyo que nombra el problema y la salida.
- **Sufijo de unidad:** "mg", "horas", "días" viven dentro del campo como texto en `{colors.on-surface-variant}`, alineado a la derecha.

### Navigation
- **Barra de navegación inferior (3 destinos):** Inicio, Historial, Perfil. Ícono relleno cuando está activo dentro de una píldora `{colors.primary-container}` de 64×40dp, contorneado cuando no. Etiqueta siempre visible en Label Small.
- **"Agregar" no es un destino.** Es la acción principal, y por lo tanto un FAB extendido en Inicio. Un formulario de alta es una tarea, no un lugar.
- **Barra superior:** `large` (título en Headline sobre dos líneas de alto) en las pantallas raíz; `small` con flecha de retroceso en las pantallas apiladas. Gana `level2` solo cuando hay contenido desplazado por debajo.
- **Back del sistema** siempre funciona y hace lo mismo que la flecha.

**La Regla del FAB que Cede el Paso.** El FAB nunca se queda quieto y extendido sobre una lista. Al desplazarse hacia abajo se contrae a un círculo de 72dp (`{components.fab-collapsed}`); arriba del todo, o al desplazarse hacia arriba, recupera su rótulo (`{components.fab-extended}`). Extendido mide ~180dp y se posa justo encima de la fila que la persona iba a tocar; contraído ocupa un tercio y se queda en la esquina. Además la lista reserva `TOUCH.primary + 24dp` de relleno inferior, para que el último renglón pueda desplazarse por encima del FAB y quedar libre.

**La Regla del Rótulo en el FAB.** El FAB de esta app nunca es solo un "+". A 80 años, un ícono suelto en una esquina no dice qué va a pasar al tocarlo. El círculo es un estado transitorio del scroll, no la forma en reposo: en cuanto la lista se detiene arriba, el rótulo vuelve.

### Feedback
- **Snackbar:** confirmación transitoria de algo que ya pasó ("Dosis registrada"). Aparece sobre la barra de navegación, 4s, con acción opcional de una palabra.
- **Bottom sheet:** elección entre opciones equivalentes (cámara / galería). Manija de arrastre, esquina `{rounded.extraLarge}` solo arriba, scrim al 40%.
- **Dialog:** solo decisiones que deben interrumpir y que son destructivas o irreversibles (eliminar, cerrar sesión, confirmar el alta). Ícono opcional, título en Title, cuerpo en Body, acciones de texto alineadas a la derecha.

### Signature Component: El Semáforo de Dosis
Cada estado de una toma se comunica con **forma y color a la vez**, nunca con color solo: círculo con palomita sobre contenedor verde (tomada), con reloj sobre ámbar (pendiente), con equis sobre rojo (no tomada), contorno vacío sobre gris (aún no llega). Las cuatro siluetas son distinguibles sin percibir el tono. La misma pieza aparece a 44dp en la línea de tiempo del historial, a 28dp en su leyenda y como punto de 6dp en la tira semanal — una sola gramática a tres escalas.

### Signature Component: El Bloque de "Ahora"
Lo primero y más grande de Inicio, y la única cosa de la app que ocupa ese lugar. Píldora de estado arriba (`{colors.primary-container}` para "en N minutos", `{colors.warning-container}` para "es ahora" o "pendiente de confirmar", esta última latiendo a 900 ms por lado), nombre del medicamento en Display Small, dosis y hora en Title, y un botón `filled` de 72dp a ancho completo. Cuando la toma está vencida, el bloque gana borde de 1dp en `{colors.warning}`. Las tomas pendientes adicionales caen debajo como filas sobre `{colors.surface-container}` con un botón `tonal` — variaciones de lo mismo no merecen contenedor propio.

### Signature Component: La Tarjeta de Medicamento
El compartimento del pastillero. Ancho completo menos márgenes, foto real del medicamento (o su relleno en `{colors.tertiary-container}`) a 72dp a la izquierda, nombre en Title Medium, `dosis · cada N h` en Body Small, y una línea de "Próxima HH:MM" en `{colors.primary}` con su ícono de alarma. Chevron a la derecha: la tarjeta navega al detalle, no ejecuta una acción.

## Do's and Don'ts

### Do:
- **Do** resolver todo color a través de `useTheme()`; el esquema activo decide claro u oscuro.
- **Do** dar a cada control 64×64dp y 8dp de aire alrededor.
- **Do** comunicar cada estado con forma **y** color, nunca con color solo.
- **Do** usar snackbar para lo que ya pasó y diálogo solo para lo que hay que decidir.
- **Do** aplicar insets de sistema explícitamente en cada pantalla, incluido el del teclado.
- **Do** dejar un solo `filled` por pantalla y un solo FAB en toda la app.
- **Do** contraer el FAB al desplazarse hacia abajo, y reservar relleno inferior para que el último renglón de la lista quede libre de él.
- **Do** apilar el rótulo y su botón cuando la fila mide menos de 200dp de ancho útil: un botón al lado del texto le deja migajas, y el texto se parte en cuatro renglones.

### Don't:
- **Don't** coronar pantallas con un encabezado de degradado teal y emoji. Ese era el patrón anterior y hacía todas las pantallas indistinguibles.
- **Don't** apilar tarjetas blancas idénticas como estructura de pantalla; una lista es una lista.
- **Don't** anidar una tarjeta dentro de otra.
- **Don't** usar rojo para urgencia programada, ni ámbar como decoración.
- **Don't** escribir un tamaño de fuente menor a 16 ni un hexadecimal dentro de un componente.
- **Don't** poner un `border-left` de color de más de 1dp como recurso de jerarquía.
- **Don't** convertir una tarea (agregar un medicamento) en un destino de la barra de navegación.
- **Don't** dejar el FAB extendido y quieto mientras la lista se desplaza. Ver *La Regla del FAB que Cede el Paso*.
- **Don't** dejar el FAB como un "+" pelado en reposo. Ver *La Regla del Rótulo en el FAB*.
- **Don't** dar a un botón `tonal` el índigo de `{colors.secondary-container}`. Ver *La Regla del Índigo Prestado*.
