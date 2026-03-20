-- Row Level Security Policies

-- RLS 활성화
ALTER TABLE departments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purposes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE driving_records  ENABLE ROW LEVEL SECURITY;

-- Helper: 현재 사용자 역할 조회
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM admin_profiles WHERE id = auth.uid() AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: 현재 사용자 소속 부서
CREATE OR REPLACE FUNCTION get_my_department()
RETURNS UUID AS $$
  SELECT department_id FROM admin_profiles WHERE id = auth.uid() AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================
-- departments 정책
-- =====================
CREATE POLICY "departments_select_all" ON departments
  FOR SELECT USING (true);

CREATE POLICY "departments_insert_operator" ON departments
  FOR INSERT WITH CHECK (get_my_role() = 'system_operator');

CREATE POLICY "departments_update_operator" ON departments
  FOR UPDATE USING (get_my_role() = 'system_operator');

CREATE POLICY "departments_delete_operator" ON departments
  FOR DELETE USING (get_my_role() = 'system_operator');

-- =====================
-- vehicles 정책
-- =====================
CREATE POLICY "vehicles_select_all" ON vehicles
  FOR SELECT USING (true);

CREATE POLICY "vehicles_insert_operator" ON vehicles
  FOR INSERT WITH CHECK (get_my_role() = 'system_operator');

CREATE POLICY "vehicles_update_operator" ON vehicles
  FOR UPDATE USING (get_my_role() = 'system_operator');

CREATE POLICY "vehicles_delete_operator" ON vehicles
  FOR DELETE USING (get_my_role() = 'system_operator');

-- =====================
-- employees 정책
-- =====================
CREATE POLICY "employees_select_all" ON employees
  FOR SELECT USING (true);  -- 드롭다운용 공개 조회

CREATE POLICY "employees_insert_operator" ON employees
  FOR INSERT WITH CHECK (get_my_role() = 'system_operator');

CREATE POLICY "employees_update_operator" ON employees
  FOR UPDATE USING (get_my_role() = 'system_operator');

CREATE POLICY "employees_delete_operator" ON employees
  FOR DELETE USING (get_my_role() = 'system_operator');

-- =====================
-- purposes 정책
-- =====================
CREATE POLICY "purposes_select_all" ON purposes
  FOR SELECT USING (true);

CREATE POLICY "purposes_insert_operator" ON purposes
  FOR INSERT WITH CHECK (get_my_role() = 'system_operator');

CREATE POLICY "purposes_update_operator" ON purposes
  FOR UPDATE USING (get_my_role() = 'system_operator');

CREATE POLICY "purposes_delete_operator" ON purposes
  FOR DELETE USING (get_my_role() = 'system_operator');

-- =====================
-- admin_profiles 정책
-- =====================
-- 본인 프로필 조회
CREATE POLICY "admin_profiles_select_own" ON admin_profiles
  FOR SELECT USING (id = auth.uid() OR get_my_role() = 'system_operator');

-- 회원가입 시 본인 프로필 생성
CREATE POLICY "admin_profiles_insert_self" ON admin_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- 본인 또는 운영자가 업데이트
CREATE POLICY "admin_profiles_update" ON admin_profiles
  FOR UPDATE USING (id = auth.uid() OR get_my_role() = 'system_operator');

-- 운영자만 삭제
CREATE POLICY "admin_profiles_delete_operator" ON admin_profiles
  FOR DELETE USING (get_my_role() = 'system_operator');

-- =====================
-- driving_records 정책
-- =====================
-- INSERT: 누구나 가능 (QR 공개 폼)
CREATE POLICY "driving_records_insert_public" ON driving_records
  FOR INSERT WITH CHECK (true);

-- SELECT: 운영자는 전체, 부서관리자는 소속 부서만
CREATE POLICY "driving_records_select_operator" ON driving_records
  FOR SELECT USING (
    get_my_role() = 'system_operator'
    OR (get_my_role() = 'department_manager' AND department_id = get_my_department())
  );

-- UPDATE: 운영자 전체 + 관리자는 소속 부서만
CREATE POLICY "driving_records_update_operator" ON driving_records
  FOR UPDATE USING (
    get_my_role() = 'system_operator'
    OR (get_my_role() = 'department_manager' AND department_id = get_my_department())
  );

-- DELETE: 운영자 전체 + 관리자는 소속 부서만
CREATE POLICY "driving_records_delete_operator" ON driving_records
  FOR DELETE USING (
    get_my_role() = 'system_operator'
    OR (get_my_role() = 'department_manager' AND department_id = get_my_department())
  );
