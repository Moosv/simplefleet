-- drivers 테이블의 role 제약 조건 수정
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. 현재 제약 조건 확인
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'drivers'::regclass AND conname LIKE '%role%';

-- 2. 기존 role 제약 조건 삭제
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_role_check;

-- 3. 새로운 role 제약 조건 추가 (모든 role 값 허용)
ALTER TABLE drivers ADD CONSTRAINT drivers_role_check 
CHECK (role IN ('user', 'admin', 'master_admin', 'pending_admin'));

-- 4. 확인: 새로운 제약 조건 조회
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'drivers'::regclass AND conname LIKE '%role%';

-- 5. 기존 데이터 확인 (role 값들)
SELECT DISTINCT role FROM drivers;