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
