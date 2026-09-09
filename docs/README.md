# Páginas públicas de PastilleroApp

Tres páginas estáticas, sin dependencias externas (ni fuentes, ni scripts, ni CDNs), que Google Play exige para publicar la app:

| Archivo | Para qué | Dónde se usa |
|---|---|---|
| `privacidad.html` | Política de privacidad | **Obligatoria** en la ficha de Play Console (*Contenido de la app → Política de privacidad*) y enlazada desde **Perfil → Política de privacidad** dentro de la app |
| `eliminar-cuenta.html` | Cómo borrar la cuenta y los datos | **Obligatoria** desde 2023 para toda app con creación de cuenta (*Contenido de la app → Eliminación de datos*). Google exige que se pueda pedir **sin instalar la app**, por eso existe esta página además del botón en Perfil |
| `index.html` | Portada con los dos enlaces | Sirve como "sitio web de la app" en la ficha de la tienda |

## Datos concretos que afirman estas páginas

No quedan marcadores. Estos son los valores que las páginas declaran hoy y de dónde salen — si alguno cambia, hay que actualizar el texto, porque un dato falso en una política de privacidad es peor que no tenerla:

| Dato | Valor actual | De dónde sale |
|---|---|---|
| Responsable | Isai Guilbert Gordillo | Debe coincidir con el nombre de la cuenta de developer en Google Play; si no, la revisión lo marca |
| Contacto | `duecontrola@gmail.com` | Buzón que hay que revisar de verdad: por ahí llegan las solicitudes de borrado de quien ya no tiene la app |
| Ley aplicable | México, estado de Chihuahua | Tribunales de la ciudad de Chihuahua |
| Región de los datos | Este de Estados Unidos (Ohio), `us-east-2` | Supabase → *Project Settings → General → Region* |
| Copias de seguridad | **Ninguna** | El plan gratuito de Supabase no incluye respaldos programados |

> ⚠️ **Si algún día subes a Supabase Pro**, el plan pasa a incluir hasta 7 días de respaldos y la afirmación "el borrado es definitivo, no queda copia" deja de ser cierta. Hay que reescribir esa parte en `privacidad.html` (sección 6) y en `eliminar-cuenta.html` el mismo día que cambies de plan.

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

- **Publicidad.** La política afirma que no hay anuncios ni rastreadores. Es cierto hoy — no hay ningún SDK de anuncios (el placeholder `AdBanner` se quitó antes de publicar). Si algún día se integra AdMob de verdad, hay que reescribir esa parte y volver a declararlo en la tienda.
- **Analítica y reportes de fallos.** Igual: hoy no hay ninguno. Si se agrega Sentry o similar, deja de ser cierto que no se recoge nada de diagnóstico.
