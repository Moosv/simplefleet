-- 마스터 관리자 계정 설정 스크립트
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. master@korea.kr 계정이 있는지 확인
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'name' as name,
  created_at
FROM auth.users 
WHERE email = 'master@korea.kr';

-- 2. master@korea.kr 계정의 role을 master_admin으로 설정
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"master_admin"'::jsonb
)
WHERE email = 'master@korea.kr';

-- 3. drivers 테이블에서도 role 업데이트
UPDATE drivers 
SET role = 'master_admin'
WHERE email = 'master@korea.kr';

-- 4. 확인: 업데이트된 master 계정 정보 조회
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'role' as auth_role,
  au.raw_user_meta_data->>'name' as name,
  d.role as drivers_role,
  d.name as driver_name
FROM auth.users au
LEFT JOIN drivers d ON au.id = d.user_id
WHERE au.email = 'master@korea.kr';

-- 5. 모든 관리자 계정 현황 조회 (확인용)
SELECT 
  au.email,
  au.raw_user_meta_data->>'role' as auth_role,
  d.role as drivers_role,
  d.name
FROM auth.users au
LEFT JOIN drivers d ON au.id = d.user_id
WHERE au.raw_user_meta_data->>'role' IN ('admin', 'master_admin', 'pending_admin')
ORDER BY au.created_at;