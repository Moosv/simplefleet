-- master@korea.kr 계정 문제 해결 스크립트
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. 현재 master@korea.kr 계정 상태 확인
SELECT 
  'auth.users 테이블' as table_name,
  id,
  email,
  raw_user_meta_data->>'role' as auth_role,
  raw_user_meta_data->>'name' as name,
  created_at
FROM auth.users 
WHERE email = 'master@korea.kr'

UNION ALL

SELECT 
  'drivers 테이블' as table_name,
  user_id::text as id,
  email,
  role as auth_role,
  name,
  created_at
FROM drivers 
WHERE email = 'master@korea.kr';

-- 2. master@korea.kr이 drivers 테이블에 없다면 추가
INSERT INTO drivers (user_id, name, email, department, main_vehicle_number, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', 'Master Admin') as name,
  au.email,
  'System' as department,
  '' as main_vehicle_number,
  'master_admin' as role
FROM auth.users au
WHERE au.email = 'master@korea.kr'
AND NOT EXISTS (
  SELECT 1 FROM drivers d WHERE d.user_id = au.id
);

-- 3. 기존에 있다면 role을 master_admin으로 업데이트
UPDATE drivers 
SET role = 'master_admin'
WHERE email = 'master@korea.kr' AND role != 'master_admin';

-- 4. auth.users의 metadata도 업데이트
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"master_admin"'::jsonb
)
WHERE email = 'master@korea.kr';

-- 5. 최종 확인
SELECT 
  'Final Check - auth.users' as table_name,
  id,
  email,
  raw_user_meta_data->>'role' as auth_role,
  raw_user_meta_data->>'name' as name
FROM auth.users 
WHERE email = 'master@korea.kr'

UNION ALL

SELECT 
  'Final Check - drivers' as table_name,
  user_id::text as id,
  email,
  role as auth_role,
  name
FROM drivers 
WHERE email = 'master@korea.kr';