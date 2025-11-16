-- =====================================================
-- SimpleFleet 초기 데이터 설정
-- =====================================================
-- 주의: setup.sql을 먼저 실행한 후 이 파일을 실행하세요!
-- =====================================================

-- =====================================================
-- 마스터 관리자 계정 생성
-- =====================================================
--
-- 실행 전 준비사항:
-- 1. Supabase Dashboard > Authentication > Users로 이동
-- 2. "Add User" 버튼 클릭
-- 3. 다음 정보로 사용자 생성:
--    - Email: master@korea.kr
--    - Password: [안전한 비밀번호 설정]
--    - Auto Confirm User: 체크 ✓
--
-- 위 단계를 완료한 후 아래 SQL을 실행하세요!
-- =====================================================

-- 마스터 관리자를 drivers 테이블에 추가
INSERT INTO drivers (user_id, name, email, role, department)
SELECT
  id,
  'Master Admin',
  email,
  'master_admin',
  'System'
FROM auth.users
WHERE email = 'master@korea.kr'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 완료!
-- =====================================================
-- 마스터 관리자 계정이 생성되었습니다.
-- 이제 master@korea.kr 계정으로 로그인할 수 있습니다.
-- =====================================================

-- 검증 쿼리 (결과 확인)
SELECT
  name,
  email,
  role,
  department,
  created_at
FROM drivers
ORDER BY created_at DESC;
