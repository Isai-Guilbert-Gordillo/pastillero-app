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
-- Ejecutar esto en el SQL Editor o crear manualmente desde el dashboard:
INSERT INTO storage.buckets (id, name, public)
VALUES ('medication-photos', 'medication-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: usuarios autenticados pueden subir fotos
CREATE POLICY "Authenticated users can upload medication photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'medication-photos');

CREATE POLICY "Anyone can view medication photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'medication-photos');

CREATE POLICY "Users can delete own medication photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'medication-photos');

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
