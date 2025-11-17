-- 수정된 사용자 삭제 함수 (admin_requests 테이블 참조 제거)
-- Supabase SQL Editor에서 실행하세요

-- 1. 기존 함수 삭제
DROP FUNCTION IF EXISTS delete_user_completely(UUID);
DROP FUNCTION IF EXISTS soft_delete_user(UUID);

-- 2. 완전한 사용자 삭제 함수 생성 (수정 버전)
CREATE OR REPLACE FUNCTION delete_user_completely(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_user_info JSON;
BEGIN
  -- 삭제할 사용자 정보를 먼저 저장 (로그용)
  SELECT json_build_object(
    'user_id', d.user_id,
    'email', d.email,
    'name', d.name,
    'role', d.role
  ) INTO deleted_user_info
  FROM drivers d
  WHERE d.user_id = target_user_id;

  -- 1. drivers 테이블에서 삭제
  DELETE FROM drivers WHERE user_id = target_user_id;

  -- 2. auth.users 테이블에서 사용자 삭제
  DELETE FROM auth.users WHERE id = target_user_id;

  -- 로그 출력
  RAISE LOG 'Completely deleted user: %', deleted_user_info;

  -- 삭제된 사용자 정보 반환
  RETURN deleted_user_info;

EXCEPTION WHEN OTHERS THEN
  -- 오류 발생 시 롤백되고 오류 메시지 반환
  RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
END;
$$;

-- 3. 함수에 대한 실행 권한 부여
GRANT EXECUTE ON FUNCTION delete_user_completely(UUID) TO authenticated;

-- 4. 소프트 삭제 함수 생성 (수정 버전)
CREATE OR REPLACE FUNCTION soft_delete_user(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_user_info JSON;
BEGIN
  -- 삭제할 사용자 정보를 먼저 저장
  SELECT json_build_object(
    'user_id', d.user_id,
    'email', d.email,
    'name', d.name,
    'role', d.role
  ) INTO deleted_user_info
  FROM drivers d
  WHERE d.user_id = target_user_id;

  -- drivers 테이블에서만 삭제 (auth.users는 유지)
  DELETE FROM drivers WHERE user_id = target_user_id;

  -- auth.users의 role을 'deleted'로 변경 (완전 삭제 대신)
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"deleted"'::jsonb
  )
  WHERE id = target_user_id;

  RAISE LOG 'Soft deleted user: %', deleted_user_info;

  RETURN deleted_user_info;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to soft delete user: %', SQLERRM;
END;
$$;

-- 5. soft delete 함수에도 권한 부여
GRANT EXECUTE ON FUNCTION soft_delete_user(UUID) TO authenticated;

-- 6. 함수 확인
SELECT
  proname as function_name,
  proargtypes::regtype[] as argument_types
FROM pg_proc
WHERE proname IN ('delete_user_completely', 'soft_delete_user');
