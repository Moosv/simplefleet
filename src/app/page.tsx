import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 로그인되지 않은 경우 로그인 페이지로
  if (!user) {
    redirect("/auth/login");
  }

  // 사용자 역할 확인 (metadata 우선, 이메일 백업)
  const isAdmin = user.user_metadata?.role === 'admin' || 
                  user.email?.includes('admin') || 
                  user.email?.includes('master');
  
  if (isAdmin) {
    redirect("/records/new"); // 관리자도 기본적으로 운행기록 페이지로
  } else {
    redirect("/records/new");
  }
}
