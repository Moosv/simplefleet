-- 관리자 신청 테이블 생성
CREATE TABLE IF NOT EXISTS admin_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  department VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id)
);

-- RLS (Row Level Security) 정책 활성화
ALTER TABLE admin_requests ENABLE ROW LEVEL SECURITY;

-- 마스터 관리자만 모든 요청을 조회할 수 있는 정책
CREATE POLICY "Master admins can view all admin requests" ON admin_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'master_admin'
    )
  );

-- 사용자는 본인의 요청만 조회할 수 있는 정책
CREATE POLICY "Users can view their own admin requests" ON admin_requests
  FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 본인의 요청만 생성할 수 있는 정책
CREATE POLICY "Users can create their own admin requests" ON admin_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 마스터 관리자만 요청을 수정할 수 있는 정책
CREATE POLICY "Master admins can update admin requests" ON admin_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'master_admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'master_admin'
    )
  );