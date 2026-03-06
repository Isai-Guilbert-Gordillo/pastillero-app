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
