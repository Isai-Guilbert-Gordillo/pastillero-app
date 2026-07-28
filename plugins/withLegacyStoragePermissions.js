const { withAndroidManifest } = require('expo/config-plugins');

// ─────────────────────────────────────────────────────────────────────────────
// Limita READ/WRITE_EXTERNAL_STORAGE a Android 12 (API 32) y anteriores.
//
// Estos dos permisos NO están en app.json: los declara el manifiesto de
// expo-image-picker y se cuelan al fusionar manifiestos. Quitarlos del todo no
// es opción — en Android 12 o menos, requestMediaLibraryPermissionsAsync() los
// pide de verdad (ver getMediaLibraryPermissions en ImagePickerModule.kt), y
// como app/add.tsx y app/details/[id].tsx cortan si el permiso no se concede,
// bloquearlos dejaría sin galería a los teléfonos viejos. Que es justo el
// teléfono que suele tener el público de esta app.
//
// Desde Android 13 el selector de fotos no necesita permiso ninguno, así que
// acotarlos a maxSdkVersion=32 los deja fuera en los teléfonos modernos: no se
// piden, y no aparecen en la ficha de Play para esos dispositivos. Es la
// recomendación de Google y evita que un revisor vea "acceso a todas tus
// fotos" en una app de recordatorios.
//
// tools:replace es imprescindible: sin él, el fusionador de manifiestos ve la
// declaración SIN límite de la librería y el maxSdkVersion se pierde en
// silencio. Conviene comprobar el resultado (ver plugins/README.md).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SDK = '32';

const LEGACY_STORAGE_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

module.exports = function withLegacyStoragePermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    manifest['uses-permission'] = manifest['uses-permission'] || [];

    for (const name of LEGACY_STORAGE_PERMISSIONS) {
      let entry = manifest['uses-permission'].find((p) => p.$?.['android:name'] === name);

      if (!entry) {
        // Todavía no está en el manifiesto de la app porque la aporta la
        // librería: se declara aquí solo para poder ponerle el techo.
        entry = { $: { 'android:name': name } };
        manifest['uses-permission'].push(entry);
      }

      entry.$['android:maxSdkVersion'] = MAX_SDK;
      entry.$['tools:replace'] = 'android:maxSdkVersion';
    }

    return cfg;
  });
};
