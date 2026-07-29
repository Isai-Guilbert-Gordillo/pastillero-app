# Páginas públicas de PastilleroApp

Tres páginas estáticas, sin dependencias externas (ni fuentes, ni scripts, ni CDNs), que Google Play exige para publicar la app:

| Archivo | Para qué | Dónde se usa |
|---|---|---|
| `privacidad.html` | Política de privacidad | **Obligatoria** en la ficha de Play Console (*Contenido de la app → Política de privacidad*) y enlazada desde **Perfil → Política de privacidad** dentro de la app |
| `eliminar-cuenta.html` | Cómo borrar la cuenta y los datos | **Obligatoria** desde 2023 para toda app con creación de cuenta (*Contenido de la app → Eliminación de datos*). Google exige que se pueda pedir **sin instalar la app**, por eso existe esta página además del botón en Perfil |
| `index.html` | Portada con los dos enlaces | Sirve como "sitio web de la app" en la ficha de la tienda |

## Antes de publicarlas: rellenar los marcadores

Todos los marcadores están en MAYÚSCULAS entre corchetes o con `EJEMPLO.COM`. Búscalos y reemplázalos en los tres archivos:

| Marcador | Qué poner |
|---|---|
| `CORREO-DE-CONTACTO@EJEMPLO.COM` | Un correo que revises de verdad. Va a quedar público y lo verán tanto usuarios como el revisor de Google. Considera uno dedicado a la app en vez de tu correo personal: esta dirección la van a recoger robots de spam |
| `[NOMBRE DEL DESARROLLADOR O EMPRESA]` | El mismo nombre con el que registres la cuenta de developer en Google Play — si no coinciden, la revisión lo marca |
| `[REGIÓN DEL PROYECTO, p. ej. Este de EE. UU.]` | La región real de tu proyecto de Supabase: dashboard → *Project Settings → General → Region* |
| `[X] días` (aparece en las dos páginas) | Los días que tu plan de Supabase conserva copias de seguridad: dashboard → *Database → Backups*. En el plan gratuito suelen ser 7 |

## Dónde están publicadas

GitHub Pages las sirve desde la carpeta `/docs` de la rama `master` (**Settings → Pages**, *Deploy from a branch*):

- https://isai-guilbert-gordillo.github.io/pastillero-app/privacidad.html
- https://isai-guilbert-gordillo.github.io/pastillero-app/terminos.html
- https://isai-guilbert-gordillo.github.io/pastillero-app/eliminar-cuenta.html

Esa base también vive en [`lib/links.ts`](../lib/links.ts), que es de donde salen los enlaces de **Perfil** y del consentimiento del registro. Si el sitio se mueve a un dominio propio hay que tocar ese archivo **y** la ficha de Play Console, que guarda la URL de la política por separado.

Cualquier hosting estático sirve igual (Netlify, Vercel, Cloudflare Pages). Lo único que Google exige es que las URLs sean **públicas, estables y accesibles sin iniciar sesión** — el revisor las va a abrir.

> Si algún día el repo pasa a privado, GitHub Pages deja de publicar en el plan gratuito y estas URLs mueren. Con la app ya en la tienda, eso rompe un requisito de Google.

## Al mantenerlas

Si cambia lo que la app recoge o con quién lo comparte, hay que actualizar **la política Y el formulario de "Seguridad de los datos"** de Play Console: si no coinciden, es motivo de suspensión. Actualiza también la fecha del encabezado de la página.

Dos cosas de la política dependen de decisiones que hoy no están tomadas y hay que revisar antes de tocarlas:

- **Publicidad.** La política afirma que no hay anuncios ni rastreadores. Es cierto hoy — `components/AdBanner.tsx` es solo un recuadro de relleno, sin SDK. Si algún día se integra AdMob de verdad, hay que reescribir esa parte y volver a declararlo en la tienda.
- **Analítica y reportes de fallos.** Igual: hoy no hay ninguno. Si se agrega Sentry o similar, deja de ser cierto que no se recoge nada de diagnóstico.
