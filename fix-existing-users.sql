-- 기존 사용자를 drivers 테이블에 추가하는 스크립트
-- 이 스크립트는 Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. 현재 auth.users에 있지만 drivers 테이블에 없는 사용자들 확인
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'name' as name,
  au.raw_user_meta_data->>'role' as role,
  au.created_at
FROM auth.users au
LEFT JOIN drivers d ON au.id = d.user_id
WHERE d.user_id IS NULL;

-- 2. 모든 auth.users를 drivers 테이블에 추가 (중복 제거)
INSERT INTO drivers (user_id, name, email, department, main_vehicle_number, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', 'Unknown') as name,
  au.email,
  '' as department,
  '' as main_vehicle_number,
  COALESCE(au.raw_user_meta_data->>'role', 'user') as role
FROM auth.users au
LEFT JOIN drivers d ON au.id = d.user_id
WHERE d.user_id IS NULL;

-- 3. 확인: drivers 테이블의 모든 사용자 조회
SELECT 
  id,
  name,
  email,
  department,
  main_vehicle_number,
  role,
  created_at
FROM drivers
ORDER BY created_at DESC;