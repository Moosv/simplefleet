-- 운행기록 테이블 생성
CREATE TABLE IF NOT EXISTS driving_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE NOT NULL,
  end_time TIME,
  vehicle_number VARCHAR(20) NOT NULL,
  department VARCHAR(100) NOT NULL,
  driver_name VARCHAR(50) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  custom_purpose TEXT,
  destination VARCHAR(200) NOT NULL,
  waypoint VARCHAR(200),
  cumulative_distance DECIMAL(10,1),
  fuel_amount DECIMAL(8,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 정책 활성화
ALTER TABLE driving_records ENABLE ROW LEVEL SECURITY;

-- 사용자가 본인의 기록만 조회할 수 있는 정책
CREATE POLICY "Users can view their own driving records" ON driving_records
  FOR SELECT USING (auth.uid() = user_id);

-- 사용자가 본인의 기록만 삽입할 수 있는 정책
CREATE POLICY "Users can insert their own driving records" ON driving_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 사용자가 본인의 기록만 수정할 수 있는 정책
CREATE POLICY "Users can update their own driving records" ON driving_records
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 사용자가 본인의 기록만 삭제할 수 있는 정책
CREATE POLICY "Users can delete their own driving records" ON driving_records
  FOR DELETE USING (auth.uid() = user_id);

-- 관리자는 모든 기록을 조회할 수 있는 정책
CREATE POLICY "Admins can view all driving records" ON driving_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_user_meta_data->>'role' = 'admin'
        OR auth.users.email LIKE '%admin%'
        OR auth.users.email LIKE '%master%'
      )
    )
  );

-- updated_at 자동 업데이트를 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
CREATE TRIGGER update_driving_records_updated_at 
  BEFORE UPDATE ON driving_records 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();