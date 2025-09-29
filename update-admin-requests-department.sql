-- admin_requests 테이블에 department 필드 추가
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. department 컬럼이 이미 있는지 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'admin_requests' AND column_name = 'department';

-- 2. department 컬럼 추가 (이미 있다면 에러가 발생하지만 무시해도 됩니다)
ALTER TABLE admin_requests 
ADD COLUMN IF NOT EXISTS department VARCHAR(50) NOT NULL DEFAULT '';

-- 3. 확인: 업데이트된 테이블 구조 조회
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'admin_requests' 
ORDER BY ordinal_position;

-- 4. 기존 데이터에 빈 department 값이 있다면 기본값으로 업데이트
UPDATE admin_requests 
SET department = '미지정' 
WHERE department = '' OR department IS NULL;