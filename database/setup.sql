-- =====================================================
-- SimpleFleet 데이터베이스 초기 설정
-- =====================================================
-- 이 파일을 Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 1. drivers 테이블 생성 (사용자 정보)
CREATE TABLE IF NOT EXISTS drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'master_admin', 'pending_admin')),
  main_vehicle_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. driving_records 테이블 생성 (운행 기록)
CREATE TABLE IF NOT EXISTS driving_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  department TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME NOT NULL,
  end_time TIME,
  vehicle_number TEXT NOT NULL,
  start_odometer INTEGER NOT NULL,
  end_odometer INTEGER,
  total_distance INTEGER,
  destination TEXT,
  purpose TEXT,
  passengers INTEGER,
  fuel_cost INTEGER DEFAULT 0,
  toll_cost INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_department ON drivers(department);
CREATE INDEX IF NOT EXISTS idx_driving_records_user_id ON driving_records(user_id);
CREATE INDEX IF NOT EXISTS idx_driving_records_vehicle ON driving_records(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_driving_records_date ON driving_records(start_date);

-- =====================================================
-- 4. RLS (Row Level Security) 정책 설정
-- =====================================================

-- RLS 활성화
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driving_records ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- drivers 테이블 정책
-- =====================================================

-- 모든 사람이 읽을 수 있음 (로그인 검증용)
DROP POLICY IF EXISTS "Allow public read for login verification" ON drivers;
CREATE POLICY "Allow public read for login verification"
ON drivers FOR SELECT
USING (true);

-- 사용자는 자신의 프로필만 수정 가능
DROP POLICY IF EXISTS "Users can update own profile" ON drivers;
CREATE POLICY "Users can update own profile"
ON drivers FOR UPDATE
USING (auth.uid() = user_id);

-- 관리자는 모든 사용자 정보 수정 가능
DROP POLICY IF EXISTS "Admins can update all profiles" ON drivers;
CREATE POLICY "Admins can update all profiles"
ON drivers FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM drivers
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'master_admin')
));

-- 마스터 관리자는 사용자 삭제 가능
DROP POLICY IF EXISTS "Master admin can delete users" ON drivers;
CREATE POLICY "Master admin can delete users"
ON drivers FOR DELETE
USING (EXISTS (
  SELECT 1 FROM drivers
  WHERE user_id = auth.uid()
  AND role = 'master_admin'
));

-- =====================================================
-- driving_records 테이블 정책
-- =====================================================

-- 사용자는 자신의 기록만 조회
DROP POLICY IF EXISTS "Users can view own records" ON driving_records;
CREATE POLICY "Users can view own records"
ON driving_records FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 자신의 기록만 추가
DROP POLICY IF EXISTS "Users can insert own records" ON driving_records;
CREATE POLICY "Users can insert own records"
ON driving_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 기록만 수정
DROP POLICY IF EXISTS "Users can update own records" ON driving_records;
CREATE POLICY "Users can update own records"
ON driving_records FOR UPDATE
USING (auth.uid() = user_id);

-- 사용자는 자신의 기록만 삭제
DROP POLICY IF EXISTS "Users can delete own records" ON driving_records;
CREATE POLICY "Users can delete own records"
ON driving_records FOR DELETE
USING (auth.uid() = user_id);

-- 관리자는 모든 기록 조회 가능
DROP POLICY IF EXISTS "Admins can view all records" ON driving_records;
CREATE POLICY "Admins can view all records"
ON driving_records FOR SELECT
USING (EXISTS (
  SELECT 1 FROM drivers
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'master_admin')
));

-- 관리자는 모든 기록 수정 가능
DROP POLICY IF EXISTS "Admins can update all records" ON driving_records;
CREATE POLICY "Admins can update all records"
ON driving_records FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM drivers
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'master_admin')
));

-- 관리자는 모든 기록 삭제 가능
DROP POLICY IF EXISTS "Admins can delete all records" ON driving_records;
CREATE POLICY "Admins can delete all records"
ON driving_records FOR DELETE
USING (EXISTS (
  SELECT 1 FROM drivers
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'master_admin')
));

-- =====================================================
-- 완료!
-- =====================================================
-- 테이블과 정책이 성공적으로 생성되었습니다.
-- 다음 단계: initial-data.sql 파일을 실행하여
-- 마스터 관리자 계정을 생성하세요.
-- =====================================================
