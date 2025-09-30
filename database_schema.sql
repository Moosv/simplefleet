-- SimpleFleet Production Database Schema
-- Supabase SQL Editor에서 실행할 스키마

-- 1. drivers 테이블 생성 (사용자 관리)
CREATE TABLE drivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    department TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'master_admin', 'pending_admin')),
    main_vehicle_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. driving_records 테이블 생성 (운행기록)
CREATE TABLE driving_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    driver_name TEXT NOT NULL,
    department TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    vehicle_number TEXT NOT NULL,
    start_odometer INTEGER NOT NULL,
    end_odometer INTEGER NOT NULL,
    total_distance INTEGER GENERATED ALWAYS AS (end_odometer - start_odometer) STORED,
    destination TEXT NOT NULL,
    purpose TEXT NOT NULL,
    passengers INTEGER DEFAULT 1,
    fuel_cost INTEGER DEFAULT 0,
    toll_cost INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Row Level Security (RLS) 정책 활성화
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driving_records ENABLE ROW LEVEL SECURITY;

-- 4. drivers 테이블 RLS 정책
-- 로그인 검증을 위한 공개 읽기 허용
CREATE POLICY "Allow public read for login verification"
ON drivers FOR SELECT USING (true);

-- 인증된 사용자는 자신의 정보 수정 가능
CREATE POLICY "Users can update own profile"
ON drivers FOR UPDATE
USING (auth.uid() = user_id);

-- 관리자는 모든 사용자 정보 조회/수정 가능
CREATE POLICY "Admins can manage all users"
ON drivers FOR ALL
USING (EXISTS (
    SELECT 1 FROM drivers
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'master_admin')
));

-- 새 사용자 등록 허용
CREATE POLICY "Allow user registration"
ON drivers FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 5. driving_records 테이블 RLS 정책
-- 사용자는 자신의 운행기록 조회 가능
CREATE POLICY "Users can view own records"
ON driving_records FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 자신의 운행기록 생성 가능
CREATE POLICY "Users can create own records"
ON driving_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 운행기록 수정 가능
CREATE POLICY "Users can update own records"
ON driving_records FOR UPDATE
USING (auth.uid() = user_id);

-- 관리자는 모든 운행기록 조회 가능
CREATE POLICY "Admins can view all records"
ON driving_records FOR SELECT
USING (EXISTS (
    SELECT 1 FROM drivers
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'master_admin')
));

-- 관리자는 모든 운행기록 수정/삭제 가능
CREATE POLICY "Admins can manage all records"
ON driving_records FOR ALL
USING (EXISTS (
    SELECT 1 FROM drivers
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'master_admin')
));

-- 6. 인덱스 생성 (성능 최적화)
CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_role ON drivers(role);
CREATE INDEX idx_drivers_department ON drivers(department);

CREATE INDEX idx_driving_records_user_id ON driving_records(user_id);
CREATE INDEX idx_driving_records_driver_name ON driving_records(driver_name);
CREATE INDEX idx_driving_records_department ON driving_records(department);
CREATE INDEX idx_driving_records_date ON driving_records(start_date, end_date);

-- 7. 트리거 함수 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driving_records_updated_at
    BEFORE UPDATE ON driving_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. 마스터 관리자 계정 생성 준비
-- 이 부분은 Authentication에서 master@korea.kr 계정 생성 후 실행
-- INSERT INTO drivers (user_id, name, email, role, department)
-- SELECT id, 'Master Admin', email, 'master_admin', 'System'
-- FROM auth.users
-- WHERE email = 'master@korea.kr';