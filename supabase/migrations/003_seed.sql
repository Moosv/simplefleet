-- Seed Data

-- 기본 용무 데이터
INSERT INTO purposes (name) VALUES
  ('출장'),
  ('관내 공무'),
  ('자재 운반'),
  ('회의 참석'),
  ('현장 방문'),
  ('교육 참석'),
  ('기타')
ON CONFLICT (name) DO NOTHING;

-- 시스템운영자 계정 생성 방법:
-- 1. Supabase Dashboard > Authentication > Users > "Add user" 클릭
-- 2. 이메일: admin@simplefleet.kr, 비밀번호 설정
-- 3. 생성된 UUID를 아래에 입력 후 실행
--
-- INSERT INTO admin_profiles (id, full_name, role, status)
-- VALUES ('{USER_UUID_HERE}', '시스템운영자', 'system_operator', 'active');
--
-- 또는 아래 함수를 사용하면 로그인 시 자동으로 프로필 생성됩니다.

-- 신규 Auth 유저 가입 시 자동으로 admin_profiles에 pending 레코드 생성하는 트리거
-- (이미 존재하면 건너뜀)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- admin_profiles에 없을 때만 생성 (회원가입 폼에서 직접 INSERT할 것이므로 여기선 생략)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
