-- SimpleFleet Database Schema

-- 부서 마스터
CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 차량 마스터
CREATE TABLE IF NOT EXISTS vehicles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  license_plate TEXT NOT NULL UNIQUE,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 직원 마스터 (시스템운영자가 등록, 별도 인증 없음)
CREATE TABLE IF NOT EXISTS employees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 용무 마스터
CREATE TABLE IF NOT EXISTS purposes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 관리자 프로필 (Supabase Auth 연동)
CREATE TABLE IF NOT EXISTS admin_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  role          TEXT NOT NULL CHECK (role IN ('system_operator', 'department_manager')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 운행 기록
CREATE TABLE IF NOT EXISTS driving_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  usage_date          DATE NOT NULL,
  vehicle_id          UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  department_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
  employee_id         UUID REFERENCES employees(id) ON DELETE SET NULL,
  driver_name         TEXT NOT NULL,
  purpose             TEXT NOT NULL,
  waypoint            TEXT,
  destination         TEXT NOT NULL,
  duration_hours      NUMERIC(5,1),
  distance_traveled   NUMERIC(8,1),
  cumulative_distance NUMERIC(10,1) NOT NULL,
  fuel_amount         NUMERIC(6,2),
  odometer_image_url  TEXT,
  receipt_image_url   TEXT
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_driving_records_usage_date ON driving_records(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_driving_records_vehicle_id ON driving_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_driving_records_employee_id ON driving_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_driving_records_department_id ON driving_records(department_id);
