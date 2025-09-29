-- 운전자 정보 테이블 생성
CREATE TABLE IF NOT EXISTS drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  department VARCHAR(100) NOT NULL,
  main_vehicle_number VARCHAR(20) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'master_admin', 'pending_admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 정책 활성화
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- 관리자만 운전자 정보를 조회할 수 있는 정책
CREATE POLICY "Admins can view all drivers" ON drivers
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

-- 관리자만 운전자 정보를 삽입할 수 있는 정책
CREATE POLICY "Admins can insert drivers" ON drivers
  FOR INSERT WITH CHECK (
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

-- 관리자만 운전자 정보를 수정할 수 있는 정책
CREATE POLICY "Admins can update drivers" ON drivers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_user_meta_data->>'role' = 'admin'
        OR auth.users.email LIKE '%admin%'
        OR auth.users.email LIKE '%master%'
      )
    )
  ) WITH CHECK (
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

-- 관리자만 운전자 정보를 삭제할 수 있는 정책
CREATE POLICY "Admins can delete drivers" ON drivers
  FOR DELETE USING (
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

-- updated_at 트리거 생성
CREATE TRIGGER update_drivers_updated_at 
  BEFORE UPDATE ON drivers 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();