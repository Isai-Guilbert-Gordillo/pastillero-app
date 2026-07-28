// ─────────────────────────────────────────────────────────────────────────────
// Enlaces públicos de la app.
//
// Las páginas viven en docs/ de este mismo repo y se publican con GitHub Pages
// (ver docs/README.md). Google Play pide la URL de la política de privacidad
// en la ficha de la tienda Y que sea accesible desde dentro de la app.
//
// ⚠️ CAMBIAR ESTA BASE por el dominio real antes de publicar en la tienda.
// ─────────────────────────────────────────────────────────────────────────────

const SITIO_BASE = 'https://TU-USUARIO.github.io/pastillero-app';

export const LINKS = {
  privacidad: `${SITIO_BASE}/privacidad.html`,
  terminos: `${SITIO_BASE}/terminos.html`,
  eliminarCuenta: `${SITIO_BASE}/eliminar-cuenta.html`,
} as const;

/**
 * Versión de los documentos que el usuario acepta al registrarse. Se guarda
 * junto al consentimiento (ver AuthContext.signUp) para poder demostrar QUÉ
 * texto aceptó y cuándo — un "aceptó los términos" sin versión no prueba nada
 * en cuanto los términos cambian.
 *
 * ⚠️ SUBIR ESTE NÚMERO cada vez que cambie el texto de docs/terminos.html o
 * docs/privacidad.html de forma sustancial.
 */
export const LEGAL_VERSION = 1;
