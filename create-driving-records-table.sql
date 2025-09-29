-- 운행 기록 테이블 생성
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. driving_records 테이블 생성
CREATE TABLE IF NOT EXISTS driving_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE NOT NULL,
  end_time TIME,
  vehicle_number VARCHAR(20) NOT NULL,
  department VARCHAR(100),
  driver_name VARCHAR(50) NOT NULL,
  purpose VARCHAR(200) NOT NULL,
  destination VARCHAR(200) NOT NULL,
  waypoint VARCHAR(200),
  cumulative_distance DECIMAL(10,1),
  fuel_amount DECIMAL(8,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_driving_records_user_id ON driving_records(user_id);
CREATE INDEX IF NOT EXISTS idx_driving_records_start_date ON driving_records(start_date);
CREATE INDEX IF NOT EXISTS idx_driving_records_vehicle_number ON driving_records(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_driving_records_created_at ON driving_records(created_at);

-- 3. Row Level Security (RLS) 활성화
ALTER TABLE driving_records ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성
-- 사용자는 자신의 기록만 조회/수정 가능
CREATE POLICY "Users can view own driving records" ON driving_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own driving records" ON driving_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own driving records" ON driving_records
  FOR UPDATE USING (auth.uid() = user_id);

-- 관리자는 모든 기록 조회 가능
CREATE POLICY "Admins can view all driving records" ON driving_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM drivers 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'master_admin')
    )
  );

-- 5. updated_at 자동 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. updated_at 트리거 적용
CREATE TRIGGER update_driving_records_updated_at 
  BEFORE UPDATE ON driving_records 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 7. 테이블 생성 확인
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'driving_records' 
ORDER BY ordinal_position;