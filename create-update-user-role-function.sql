-- auth.users 테이블의 role 메타데이터를 업데이트하는 RPC 함수 생성
-- Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. 사용자 권한 업데이트 함수 생성
CREATE OR REPLACE FUNCTION update_user_role(user_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- auth.users 테이블의 raw_user_meta_data에서 role 업데이트
  UPDATE auth.users 
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(new_role)
  )
  WHERE id = user_id;
  
  -- 로그 출력 (선택사항)
  RAISE LOG 'Updated user role: % to %', user_id, new_role;
END;
$$;

-- 2. 함수에 대한 실행 권한 부여
GRANT EXECUTE ON FUNCTION update_user_role(UUID, TEXT) TO authenticated;

-- 3. 함수 테스트 (선택사항)
-- SELECT update_user_role('사용자_UUID', 'admin');

-- 4. 확인: 함수가 생성되었는지 확인
SELECT 
  proname as function_name,
  proargtypes::regtype[] as argument_types,
  prosrc as function_body
FROM pg_proc 
WHERE proname = 'update_user_role';