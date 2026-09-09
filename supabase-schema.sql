-- ============================================
-- PastilleroApp - Esquema de Base de Datos
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- 1. Tabla de medicamentos
CREATE TABLE IF NOT EXISTS medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  dose_mg NUMERIC NOT NULL CHECK (dose_mg > 0),
  frequency_hours NUMERIC NOT NULL CHECK (frequency_hours > 0),
  start_time TEXT NOT NULL, -- formato HH:MM
  days_of_week TEXT[] NOT NULL DEFAULT '{mon,tue,wed,thu,fri,sat,sun}', -- días activos: mon,tue,wed,thu,fri,sat,sun
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de registros de dosis (historial de tomas)
CREATE TABLE IF NOT EXISTS dose_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  taken BOOLEAN, -- null = pendiente, true = tomado, false = no tomado
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(active);
CREATE INDEX IF NOT EXISTS idx_dose_records_user_id ON dose_records(user_id);
CREATE INDEX IF NOT EXISTS idx_dose_records_medication_id ON dose_records(medication_id);
CREATE INDEX IF NOT EXISTS idx_dose_records_scheduled_at ON dose_records(scheduled_at);

-- 4. Row Level Security (RLS) - MUY IMPORTANTE
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dose_records ENABLE ROW LEVEL SECURITY;

-- Políticas para medications: cada usuario solo ve/modifica sus propios medicamentos
CREATE POLICY "Users can view own medications"
  ON medications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medications"
  ON medications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medications"
  ON medications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own medications"
  ON medications FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para dose_records: cada usuario solo ve/modifica sus propios registros
CREATE POLICY "Users can view own dose_records"
  ON dose_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dose_records"
  ON dose_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dose_records"
  ON dose_records FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dose_records"
  ON dose_records FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Storage bucket para fotos de medicamentos
--
-- PRIVADO (public = false). La foto de una caja de medicamento es un dato de
-- salud: con el bucket público, cualquiera con la URL —sin cuenta, sin sesión—
-- podía verla. Las fotos se sirven con URLs firmadas de corta duración; ver
-- lib/photos.ts y la migración "Fotos privadas" al final de este archivo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('medication-photos', 'medication-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Las políticas del bucket viven en la migración "Fotos privadas" al final de
-- este archivo: dependen de is_caregiver_of(), que se define más abajo.

-- ============================================
-- MIGRACIÓN: Agregar columna days_of_week
-- Ejecutar esto si la tabla medications ya existe
-- ============================================
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS days_of_week TEXT[] NOT NULL DEFAULT '{mon,tue,wed,thu,fri,sat,sun}';

COMMENT ON COLUMN medications.days_of_week IS 'Días de la semana activos: mon, tue, wed, thu, fri, sat, sun';

-- ============================================
-- MIGRACIÓN: Agregar columna notification_ids
-- Ejecutar esto si la tabla medications ya existe
-- ============================================
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS notification_ids TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN medications.notification_ids IS 'IDs de notificaciones programadas en expo-notifications para este medicamento';

-- ============================================
-- MIGRACIÓN: Evitar dose_records duplicados
-- La reconciliación automática (lib/doseSync.ts) inserta un registro por
-- (medication_id, scheduled_at). Esta restricción evita que dos llamadas
-- casi simultáneas (por ejemplo Inicio e Historial enfocándose a la vez)
-- creen dos filas para la misma dosis.
--
-- Primero hay que limpiar los duplicados que ya existan (si no, la
-- restricción UNIQUE de abajo falla). Por cada grupo duplicado se conserva
-- una sola fila: de preferencia una que ya esté resuelta (taken no nulo) y,
-- entre empates, la más antigua — así no se pierde un "tomada"/"no tomada"
-- real a favor de un duplicado que quedó pendiente.
-- ============================================
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY medication_id, scheduled_at
      ORDER BY (taken IS NOT NULL) DESC, created_at ASC
    ) AS rn
  FROM dose_records
)
DELETE FROM dose_records
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dose_records_medication_scheduled_unique'
  ) THEN
    ALTER TABLE dose_records
      ADD CONSTRAINT dose_records_medication_scheduled_unique
      UNIQUE (medication_id, scheduled_at);
  END IF;
END $$;

-- ============================================
-- MIGRACIÓN: Cuidadores (acceso compartido a distancia)
--
-- Una "abuela" (paciente) genera un código de invitación desde su Perfil.
-- Un familiar (cuidador) lo ingresa en SU PROPIA cuenta y queda vinculado.
-- Una vez vinculado, el cuidador tiene control total (ver, agregar, editar,
-- marcar dosis) sobre los medicamentos e historial del paciente, a través
-- de políticas RLS adicionales — sin compartir contraseña ni cuenta.
--
-- OJO: las alarmas son locales a cada teléfono (expo-notifications + Reloj
-- del sistema). Si el cuidador agrega/edita un medicamento desde su propio
-- teléfono, la alarma NO suena en el teléfono del paciente hasta que esa
-- persona abra la app (la reconciliación en lib/doseSync.ts se encarga de
-- ponerse al día en ese momento, pero no reprograma alarmas sonoras solas).
-- ============================================

CREATE TABLE IF NOT EXISTS caregiver_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_email TEXT NOT NULL,
  caregiver_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_email TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_caregiver_links_patient ON caregiver_links(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_links_caregiver ON caregiver_links(caregiver_user_id);

ALTER TABLE caregiver_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients manage their own invites" ON caregiver_links;
CREATE POLICY "Patients manage their own invites"
  ON caregiver_links FOR ALL
  USING (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);

DROP POLICY IF EXISTS "Caregivers can view their accepted links" ON caregiver_links;
CREATE POLICY "Caregivers can view their accepted links"
  ON caregiver_links FOR SELECT
  USING (auth.uid() = caregiver_user_id);

DROP POLICY IF EXISTS "Caregivers can remove their own link" ON caregiver_links;
CREATE POLICY "Caregivers can remove their own link"
  ON caregiver_links FOR DELETE
  USING (auth.uid() = caregiver_user_id);

-- Helper: ¿auth.uid() es cuidador ACEPTADO de p_patient_id?
-- SECURITY DEFINER para que se pueda usar dentro de las políticas de
-- medications/dose_records sin que esas tablas necesiten exponer caregiver_links.
CREATE OR REPLACE FUNCTION is_caregiver_of(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM caregiver_links
    WHERE patient_user_id = p_patient_id
      AND caregiver_user_id = auth.uid()
      AND status = 'accepted'
  );
$$;

-- Redimir un código de invitación. SECURITY DEFINER porque quien llama
-- (el futuro cuidador) todavía no tiene permiso de UPDATE sobre esta fila.
CREATE OR REPLACE FUNCTION redeem_caregiver_invite(p_code TEXT)
RETURNS TABLE (patient_user_id UUID, patient_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row caregiver_links%ROWTYPE;
  v_caregiver_email TEXT;
BEGIN
  SELECT * INTO v_row FROM caregiver_links WHERE invite_code = upper(p_code) AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_used_code';
  END IF;

  IF v_row.patient_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_link_self';
  END IF;

  SELECT email INTO v_caregiver_email FROM auth.users WHERE id = auth.uid();

  UPDATE caregiver_links
    SET caregiver_user_id = auth.uid(),
        caregiver_email = v_caregiver_email,
        status = 'accepted',
        accepted_at = now()
    WHERE id = v_row.id;

  RETURN QUERY SELECT v_row.patient_user_id, v_row.patient_email;
END;
$$;

-- Ampliar el acceso a medications/dose_records: un cuidador aceptado tiene
-- el mismo control que el propio paciente (política adicional, se combina
-- con las políticas "Users can ... own ..." ya existentes).
DROP POLICY IF EXISTS "Caregivers can view patient medications" ON medications;
CREATE POLICY "Caregivers can view patient medications"
  ON medications FOR SELECT
  USING (is_caregiver_of(user_id));

DROP POLICY IF EXISTS "Caregivers can insert patient medications" ON medications;
CREATE POLICY "Caregivers can insert patient medications"
  ON medications FOR INSERT
  WITH CHECK (is_caregiver_of(user_id));

DROP POLICY IF EXISTS "Caregivers can update patient medications" ON medications;
CREATE POLICY "Caregivers can update patient medications"
  ON medications FOR UPDATE
  USING (is_caregiver_of(user_id));

DROP POLICY IF EXISTS "Caregivers can delete patient medications" ON medications;
CREATE POLICY "Caregivers can delete patient medications"
  ON medications FOR DELETE
  USING (is_caregiver_of(user_id));

DROP POLICY IF EXISTS "Caregivers can view patient dose_records" ON dose_records;
CREATE POLICY "Caregivers can view patient dose_records"
  ON dose_records FOR SELECT
  USING (is_caregiver_of(user_id));

DROP POLICY IF EXISTS "Caregivers can insert patient dose_records" ON dose_records;
CREATE POLICY "Caregivers can insert patient dose_records"
  ON dose_records FOR INSERT
  WITH CHECK (is_caregiver_of(user_id));

DROP POLICY IF EXISTS "Caregivers can update patient dose_records" ON dose_records;
CREATE POLICY "Caregivers can update patient dose_records"
  ON dose_records FOR UPDATE
  USING (is_caregiver_of(user_id));

-- ============================================
-- MIGRACIÓN: Duración del tratamiento (crónico vs. por tiempo limitado)
--
-- Hasta ahora medications solo guardaba el RITMO de la toma (cada cuántas
-- horas, a qué hora, qué días), pero nunca por CUÁNTO TIEMPO TOTAL — el
-- sistema asumía implícitamente que todo medicamento es para siempre.
--
-- regimen_type es explícito (no inferido) para que la UI pueda preguntar
-- directo: "¿lo vas a tomar para siempre o por unos días?".
--   - 'indefinido'  → tratamiento crónico, sin fecha de fin.
--   - 'por_tiempo'  → tratamiento con duración fija (ej. antibiótico).
--
-- duration_days y end_date solo aplican a 'por_tiempo' (NULL en 'indefinido').
-- end_date se calcula en el cliente como created_at + duration_days y se
-- recalcula solo si duration_days cambia, para no reiniciar la cuenta con
-- cada edición menor.
-- ============================================
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS regimen_type TEXT NOT NULL DEFAULT 'indefinido'
    CHECK (regimen_type IN ('indefinido', 'por_tiempo'));

ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS duration_days INTEGER CHECK (duration_days IS NULL OR duration_days > 0);

ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS end_date DATE;

COMMENT ON COLUMN medications.regimen_type IS '''indefinido'' (crónico, sin fecha de fin) o ''por_tiempo'' (duración fija, ej. antibiótico)';
COMMENT ON COLUMN medications.duration_days IS 'Duración total del tratamiento en días. NULL si regimen_type = indefinido';
COMMENT ON COLUMN medications.end_date IS 'Fecha en que termina el tratamiento (created_at + duration_days). NULL si regimen_type = indefinido';

-- ============================================
-- MIGRACIÓN: Pendiente de borrar la alarma del Reloj
--
-- La alarma nativa del Reloj (scheduleNativeAlarms en lib/notifications.ts)
-- solo se crea para medicamentos "indefinido" — Android no da forma de que
-- la app la borre sola. Si un medicamento pasa de "indefinido" a
-- "por_tiempo", la alarma vieja puede seguir viva en el Reloj para siempre
-- sin que nadie la borre.
--
-- has_native_alarm: la app cree que existe una alarma activa en el Reloj
-- para este medicamento (se puso en true la última vez que scheduleNativeAlarms
-- tuvo éxito). Es una suposición, no una certeza — Android no expone forma
-- de confirmarlo.
--
-- native_alarm_cleanup_pending: true cuando el medicamento acaba de dejar de
-- ser "indefinido" teniendo has_native_alarm = true. Dispara un recordatorio
-- PERSISTENTE en la app (banner en Inicio + tarjeta en el detalle) hasta que
-- el usuario confirma manualmente haber borrado la alarma en la app de Reloj.
-- ============================================
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS has_native_alarm BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS native_alarm_cleanup_pending BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN medications.has_native_alarm IS 'true si la app cree que hay una alarma activa en el Reloj del teléfono para este medicamento (creada mientras era indefinido)';
COMMENT ON COLUMN medications.native_alarm_cleanup_pending IS 'true si puede quedar una alarma vieja en el Reloj que la app no puede borrar sola — se muestra un recordatorio persistente hasta que el usuario confirme haberla borrado';

-- ============================================
-- MIGRACIÓN: Cierre automático de tratamientos vencidos (revisión en servidor)
--
-- Hasta ahora, un tratamiento "por_tiempo" que ya venció se queda "activo"
-- en la base de datos hasta que alguien abre PastilleroApp y responde al
-- aviso de TreatmentEndedCard ("Ya terminé" / "El doctor lo extendió"). Si
-- nadie abre la app, ese registro queda en limbo para siempre.
--
-- close_expired_treatments() corre DENTRO del propio Postgres de Supabase
-- via pg_cron — no depende de que ningún teléfono esté encendido. Si un
-- tratamiento por tiempo limitado lleva más de GRACE_DAYS días vencido sin
-- que nadie lo haya resuelto, lo desactiva solo (active = false) y cierra
-- cualquier dosis que se hubiera quedado "pendiente" sin confirmar. El
-- historial en dose_records NO se borra — sigue disponible en el Historial
-- de la app.
--
-- LÍMITES — son de la plataforma, no se pueden evitar con más código:
--  - NO cancela notificaciones locales del teléfono (expo-notifications):
--    ya dejaron de agendarse solas al llegar a end_date (ver
--    computeDoseDates / renewMedicationNotificationsIfNeeded en
--    lib/notifications.ts), así que no queda nada que cancelar para cuando
--    este cron corre.
--  - NO borra ni puede borrar la alarma nativa del Reloj de Android — eso
--    siempre requiere que un humano la borre a mano desde la app de Reloj
--    del teléfono (ver native_alarm_cleanup_pending arriba).
--
-- CÓMO ACTIVARLO (una sola vez, manual):
--  1. En el dashboard de Supabase → Database → Extensions, activa "pg_cron"
--     (algunos proyectos ya la traen activada; si el CREATE EXTENSION de
--     abajo falla por permisos, actívala ahí en vez de por SQL).
--  2. Corre todo este bloque en el SQL Editor.
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION close_expired_treatments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grace_days CONSTANT INTEGER := 3;
  closed_count INTEGER;
BEGIN
  -- Cerrar como "no tomada" cualquier dosis que se haya quedado pendiente
  -- de confirmar, antes de desactivar el medicamento.
  UPDATE dose_records dr
    SET taken = false
    FROM medications m
    WHERE dr.medication_id = m.id
      AND dr.taken IS NULL
      AND m.active = true
      AND m.regimen_type = 'por_tiempo'
      AND m.end_date IS NOT NULL
      AND m.end_date < (CURRENT_DATE - grace_days);

  UPDATE medications
    SET active = false
    WHERE active = true
      AND regimen_type = 'por_tiempo'
      AND end_date IS NOT NULL
      AND end_date < (CURRENT_DATE - grace_days);

  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$$;

-- Reprogramable: si ya existía el job (por ejemplo al re-ejecutar esta
-- migración), lo quita antes de volver a crearlo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close-expired-treatments-daily') THEN
    PERFORM cron.unschedule('close-expired-treatments-daily');
  END IF;
END $$;

-- Todos los días a las 3:00 AM UTC.
SELECT cron.schedule(
  'close-expired-treatments-daily',
  '0 3 * * *',
  $$SELECT close_expired_treatments();$$
);

-- ============================================
-- MIGRACIÓN: Fotos privadas (bucket cerrado + URLs firmadas)
--
-- ANTES: el bucket 'medication-photos' era público y sus políticas eran
--   · SELECT  TO public         → cualquiera en internet con la URL veía la
--                                 foto del medicamento de cualquier paciente.
--   · INSERT  TO authenticated  → sin filtro de carpeta: cualquier usuario
--                                 registrado podía escribir en la carpeta de
--                                 otro.
--   · DELETE  TO authenticated  → sin filtro de dueño: cualquier usuario
--                                 registrado podía BORRAR las fotos de otro.
--
-- La foto de una caja de pastillas es un dato de salud. Además de la fuga en
-- sí, un bucket público contradice lo que hay que declarar en el formulario
-- de "Seguridad de los datos" de Google Play.
--
-- AHORA: bucket privado, y el acceso se decide por la PRIMERA CARPETA de la
-- ruta, que es el user_id del paciente dueño ('<uuid>/<timestamp>.jpg' — así
-- es como ya subían las fotos app/add.tsx y app/details/[id].tsx). Pasan solo
-- el dueño y sus cuidadores aceptados, la misma regla que ya rige
-- medications/dose_records. La app pide URLs firmadas de 1 hora
-- (lib/photos.ts); Supabase solo las emite si esta política deja pasar.
-- ============================================

UPDATE storage.buckets SET public = false WHERE id = 'medication-photos';

-- Devuelve true si auth.uid() puede tocar la carpeta p_folder del bucket.
-- Valida el formato UUID antes de castear: un nombre de archivo suelto en la
-- raíz del bucket (sin carpeta) haría fallar el cast y con él toda la
-- política, y una política que revienta no protege nada.
CREATE OR REPLACE FUNCTION can_access_photo_folder(p_folder TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF p_folder IS NULL OR p_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  v_owner := p_folder::uuid;
  RETURN v_owner = auth.uid() OR is_caregiver_of(v_owner);
END;
$$;

-- Las tres políticas viejas y permisivas, fuera.
DROP POLICY IF EXISTS "Authenticated users can upload medication photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view medication photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own medication photos" ON storage.objects;

DROP POLICY IF EXISTS "Photo owners and caregivers can view" ON storage.objects;
CREATE POLICY "Photo owners and caregivers can view"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'medication-photos'
    AND can_access_photo_folder((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Photo owners and caregivers can upload" ON storage.objects;
CREATE POLICY "Photo owners and caregivers can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'medication-photos'
    AND can_access_photo_folder((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Photo owners and caregivers can update" ON storage.objects;
CREATE POLICY "Photo owners and caregivers can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'medication-photos'
    AND can_access_photo_folder((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'medication-photos'
    AND can_access_photo_folder((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Photo owners and caregivers can delete" ON storage.objects;
CREATE POLICY "Photo owners and caregivers can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'medication-photos'
    AND can_access_photo_folder((storage.foldername(name))[1])
  );

-- Normalizar las filas viejas: medications.photo_url guardaba la URL pública
-- completa, que con el bucket cerrado ya no carga. A partir de ahora se guarda
-- solo la RUTA dentro del bucket ('<uuid>/<timestamp>.jpg') y la app la firma
-- al momento de mostrarla. lib/photos.ts igual sabe leer las URLs viejas por
-- si alguna se escapa, pero conviene dejar la columna consistente.
UPDATE medications
  SET photo_url = split_part(photo_url, '/storage/v1/object/public/medication-photos/', 2)
  WHERE photo_url LIKE '%/storage/v1/object/public/medication-photos/%';

-- ============================================
-- MIGRACIÓN: Eliminar mi cuenta
--
-- Google Play exige, para toda app que permite crear una cuenta, que se pueda
-- BORRAR esa cuenta y sus datos desde dentro de la app. Sin esto la ficha se
-- rechaza, y es de lo primero que revisan.
--
-- Tiene que ser SECURITY DEFINER: el cliente con la anon key nunca puede
-- tocar auth.users por su cuenta. La función no recibe ningún id — siempre
-- borra al que llama, leído de auth.uid(), para que nadie pueda pedir el
-- borrado de la cuenta de otro pasando un uuid ajeno.
--
-- QUÉ BORRA (todo lo del propio usuario, nada de nadie más):
--  · sus fotos en el bucket (la carpeta '<su uuid>/'),
--  · sus dose_records y medications,
--  · sus vínculos de cuidado, en las dos direcciones: los cuidadores que
--    invitó Y los pacientes que cuida. Si un cuidador borra SU cuenta, los
--    medicamentos del paciente NO se tocan; solo pierde el acceso.
-- ============================================

CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  DELETE FROM storage.objects
    WHERE bucket_id = 'medication-photos'
      AND (storage.foldername(name))[1] = v_uid::text;

  DELETE FROM dose_records WHERE user_id = v_uid;
  DELETE FROM medications WHERE user_id = v_uid;
  DELETE FROM caregiver_links
    WHERE patient_user_id = v_uid OR caregiver_user_id = v_uid;

  -- Al final: auth.users arrastra en cascada sesiones e identidades, así que
  -- la sesión del teléfono queda muerta en cuanto termine esta transacción.
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- Solo una sesión iniciada puede llamarla; anon no.
REVOKE ALL ON FUNCTION delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;

-- ============================================
-- MIGRACIÓN: Avisos push al cuidador (dosis sin confirmar)
--
-- Hasta ahora TODO era local al teléfono del paciente: si nadie abría la app,
-- nadie se enteraba de nada. Un cuidador a distancia no tenía forma de saber
-- que su familiar no se tomó la medicina hasta entrar a mirar.
--
-- Esto lo cambia SOLO para el cuidador. Las alarmas del paciente siguen siendo
-- 100% locales a propósito: no deben depender de internet ni de que este
-- servidor esté vivo. Lo que se agrega es un vigilante que corre dentro de
-- Postgres, ve las dosis que quedaron sin confirmar pasado un margen, y manda
-- un push al teléfono de quien lo cuida.
--
-- REQUIERE la extensión pg_net (Database → Extensions en el dashboard). Si el
-- CREATE EXTENSION de abajo falla por permisos, actívala ahí y vuelve a correr
-- el resto.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Tokens de dispositivo ────────────────────────────────────────────────────
-- Uno por teléfono, no por usuario: alguien puede tener teléfono y tablet, y
-- un mismo teléfono puede cambiar de dueño. Por eso el token es UNIQUE y no
-- (user_id, token).
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expo_push_token TEXT NOT NULL UNIQUE,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own device tokens" ON device_tokens;
CREATE POLICY "Users manage their own device tokens"
  ON device_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Registrar el token del teléfono actual.
--
-- Es SECURITY DEFINER por un caso concreto: si el teléfono cambió de manos y
-- el dueño anterior no cerró sesión, la fila de ese token pertenece a OTRO
-- usuario y la política de arriba impediría reclamarla — el nuevo dueño se
-- quedaría sin avisos para siempre. Aquí se borra la fila vieja y se crea la
-- nueva a nombre de quien llama, que siempre es auth.uid().
CREATE OR REPLACE FUNCTION register_device_token(p_token TEXT, p_platform TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'empty_token';
  END IF;

  DELETE FROM device_tokens WHERE expo_push_token = p_token;

  INSERT INTO device_tokens (user_id, expo_push_token, platform)
  VALUES (v_uid, p_token, p_platform);
END;
$fn$;

REVOKE ALL ON FUNCTION register_device_token(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION register_device_token(TEXT, TEXT) TO authenticated;

-- 2. Marca de "ya revisada" en cada dosis ─────────────────────────────────────
-- OJO con el nombre: se marca aunque no hubiera a quién avisar (paciente sin
-- cuidadores, o cuidador sin token). Significa "el vigilante ya la evaluó",
-- no "se envió un aviso". Sin esto, cada corrida volvería a notificar la
-- misma dosis cada 5 minutos.
ALTER TABLE dose_records
  ADD COLUMN IF NOT EXISTS caregiver_alert_processed_at TIMESTAMPTZ;

COMMENT ON COLUMN dose_records.caregiver_alert_processed_at IS 'Cuándo el vigilante de dosis sin confirmar evaluó esta fila. No implica que se haya enviado un aviso.';

CREATE INDEX IF NOT EXISTS idx_dose_records_pending_alert
  ON dose_records(scheduled_at)
  WHERE taken IS NULL AND caregiver_alert_processed_at IS NULL;

-- 3. El vigilante ─────────────────────────────────────────────────────────────
--
-- El mensaje NO lleva la hora de la dosis a propósito: scheduled_at es
-- timestamptz y aquí no se conoce la zona horaria del paciente, así que
-- imprimir "las 14:00" daría una hora equivocada para casi todo el mundo. En
-- una app de medicamentos, una hora incorrecta es peor que ninguna hora.
--
-- El payload TAMPOCO lleva medicationId. El teléfono del cuidador reconoce ese
-- campo como "alarma mía" y abriría la pantalla de alarma a pantalla completa
-- por la medicina de otra persona (ver los observadores en app/_layout.tsx).
CREATE OR REPLACE FUNCTION notify_caregivers_of_missed_doses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions, auth
AS $fn$
DECLARE
  -- Margen antes de molestar a nadie: una persona mayor puede tardar en
  -- responder la alarma sin que pase nada malo.
  grace_minutes CONSTANT INTEGER := 30;
  -- Más allá de esto ya no se avisa: enterarse a las 3 de la mañana de una
  -- dosis de ayer no ayuda a nadie.
  lookback_hours CONSTANT INTEGER := 6;
  batch_size CONSTANT INTEGER := 100;
  v_messages JSONB;
  v_batch JSONB;
  v_total INTEGER := 0;
  i INTEGER;
BEGIN
  WITH pendientes AS (
    SELECT dr.id, m.name AS med_name, m.user_id AS patient_id
    FROM dose_records dr
    JOIN medications m ON m.id = dr.medication_id
    WHERE dr.taken IS NULL
      AND dr.caregiver_alert_processed_at IS NULL
      AND m.active
      AND dr.scheduled_at < now() - make_interval(mins => grace_minutes)
      AND dr.scheduled_at > now() - make_interval(hours => lookback_hours)
  ),
  marcadas AS (
    UPDATE dose_records
      SET caregiver_alert_processed_at = now()
      WHERE id IN (SELECT id FROM pendientes)
  ),
  destinatarios AS (
    SELECT DISTINCT
      dt.expo_push_token,
      p.med_name,
      COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), cl.patient_email) AS paciente
    FROM pendientes p
    JOIN caregiver_links cl
      ON cl.patient_user_id = p.patient_id
     AND cl.status = 'accepted'
     AND cl.caregiver_user_id IS NOT NULL
    JOIN device_tokens dt ON dt.user_id = cl.caregiver_user_id
    LEFT JOIN auth.users u ON u.id = p.patient_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'to', expo_push_token,
      'title', 'Dosis sin confirmar',
      'body', paciente || ' no ha confirmado su dosis de ' || med_name || '.',
      'sound', 'default',
      'priority', 'high',
      'channelId', 'avisos_cuidador',
      'data', jsonb_build_object('type', 'CAREGIVER_ALERT')
    )
  )
  INTO v_messages
  FROM destinatarios;

  IF v_messages IS NULL THEN
    RETURN 0;
  END IF;

  v_total := jsonb_array_length(v_messages);

  -- Expo acepta como máximo 100 mensajes por petición.
  i := 0;
  WHILE i < v_total LOOP
    SELECT jsonb_agg(elem)
      INTO v_batch
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_messages) WITH ORDINALITY AS t(elem, ord)
        WHERE ord > i AND ord <= i + batch_size
      ) s;

    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      body := v_batch
    );

    i := i + batch_size;
  END LOOP;

  RETURN v_total;
END;
$fn$;

-- Cada 5 minutos. Reprogramable: quita el job si ya existía.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-caregivers-missed-doses') THEN
    PERFORM cron.unschedule('notify-caregivers-missed-doses');
  END IF;
END $do$;

SELECT cron.schedule(
  'notify-caregivers-missed-doses',
  '*/5 * * * *',
  $job$SELECT notify_caregivers_of_missed_doses();$job$
);

-- 4. Limpieza de tokens muertos ───────────────────────────────────────────────
-- Un token de un teléfono que se formateó o desinstaló la app queda vivo en la
-- tabla para siempre y Expo devuelve DeviceNotRegistered en cada envío. Leer
-- esa respuesta desde aquí sería otro trabajo entero, así que se usa lo que sí
-- se sabe: la app reafirma su token en cada arranque con sesión (lib/push.ts),
-- o sea que un token sin tocar en 90 días es de un teléfono que ya no entra.
CREATE OR REPLACE FUNCTION prune_stale_device_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  removed INTEGER;
BEGIN
  DELETE FROM device_tokens WHERE updated_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$fn$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-stale-device-tokens') THEN
    PERFORM cron.unschedule('prune-stale-device-tokens');
  END IF;
END $do$;

SELECT cron.schedule(
  'prune-stale-device-tokens',
  '30 3 * * 0',
  $job$SELECT prune_stale_device_tokens();$job$
);

-- ============================================
-- MIGRACIÓN: Expiración y límite de intentos en el código de invitación
--
-- invite_code son 6 caracteres de un alfabeto de 33 (sin 0/O/1/I) — unas
-- 1.300 millones de combinaciones. A mano nadie lo adivina, pero el código
-- no expiraba nunca y el RPC redeem_caregiver_invite no tenía límite de
-- intentos: una cuenta cualquiera podía llamarlo en bucle probando códigos
-- hasta pegarle a una invitación pendiente de otra persona (fuerza bruta
-- contra la API de Supabase, no contra la app).
--
-- Dos capas, ninguna depende de que el cliente se porte bien:
--  1. expires_at: la invitación deja de ser válida a las 24 h de creada
--     (default en la columna, no requiere tocar el cliente que la inserta).
--  2. invite_redemption_attempts: máximo 10 intentos de canje cada 15
--     minutos por usuario. Sin RLS ni policies — solo la accede el propio
--     redeem_caregiver_invite() como SECURITY DEFINER, nunca el cliente
--     directo.
-- ============================================
ALTER TABLE caregiver_links
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours');

COMMENT ON COLUMN caregiver_links.expires_at IS 'La invitación deja de poder canjearse después de esta fecha (24 h desde su creación)';

CREATE TABLE IF NOT EXISTS invite_redemption_attempts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_redemption_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION redeem_caregiver_invite(p_code TEXT)
RETURNS TABLE (patient_user_id UUID, patient_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row caregiver_links%ROWTYPE;
  v_caregiver_email TEXT;
  v_attempts invite_redemption_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_attempts FROM invite_redemption_attempts WHERE user_id = auth.uid();

  IF v_attempts.user_id IS NULL THEN
    INSERT INTO invite_redemption_attempts (user_id, attempt_count, first_attempt_at)
    VALUES (auth.uid(), 1, now());
  ELSIF v_attempts.first_attempt_at < now() - INTERVAL '15 minutes' THEN
    UPDATE invite_redemption_attempts
      SET attempt_count = 1, first_attempt_at = now()
      WHERE user_id = auth.uid();
  ELSIF v_attempts.attempt_count >= 10 THEN
    RAISE EXCEPTION 'too_many_attempts';
  ELSE
    UPDATE invite_redemption_attempts
      SET attempt_count = attempt_count + 1
      WHERE user_id = auth.uid();
  END IF;

  SELECT * INTO v_row FROM caregiver_links
    WHERE invite_code = upper(p_code) AND status = 'pending' AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_used_code';
  END IF;

  IF v_row.patient_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_link_self';
  END IF;

  SELECT email INTO v_caregiver_email FROM auth.users WHERE id = auth.uid();

  UPDATE caregiver_links
    SET caregiver_user_id = auth.uid(),
        caregiver_email = v_caregiver_email,
        status = 'accepted',
        accepted_at = now()
    WHERE id = v_row.id;

  DELETE FROM invite_redemption_attempts WHERE user_id = auth.uid();

  RETURN QUERY SELECT v_row.patient_user_id, v_row.patient_email;
END;
$$;
