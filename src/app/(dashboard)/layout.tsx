"use client";

import { Navigation } from "@/components/navigation";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔍 Layout: Checking authentication...');
      
      // 먼저 Supabase 인증 확인 (관리자 우선)
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      console.log('🔍 Layout: Supabase user:', supabaseUser?.email);
      
      if (supabaseUser) {
        console.log('✅ Layout: Supabase user detected');
        console.log('🔍 Layout: User metadata:', supabaseUser.user_metadata);
        console.log('🔍 Layout: Raw user metadata:', supabaseUser.raw_user_meta_data);
        
        // 관리자 로그인이면 간편 로그인 데이터 제거
        const isAdmin = supabaseUser.email === 'master@korea.kr' || 
                       supabaseUser.user_metadata?.role === 'admin' || 
                       supabaseUser.user_metadata?.role === 'master_admin' ||
                       supabaseUser.raw_user_meta_data?.role === 'admin' ||
                       supabaseUser.raw_user_meta_data?.role === 'master_admin';
        
        console.log('🔍 Layout: isAdmin check result:', isAdmin);
        
        if (isAdmin) {
          console.log('🧹 Layout: Admin login detected, clearing simple user data');
          localStorage.removeItem('simplefleet_user');
        }
        setUser(supabaseUser);
        setIsLoading(false);
        return;
      }

      // 간편 로그인 확인 (Supabase 인증이 없을 때만)
      const simpleUser = localStorage.getItem('simplefleet_user');
      console.log('🔍 Layout: Simple user data:', simpleUser);
      
      if (simpleUser) {
        const userData = JSON.parse(simpleUser);
        if (userData.type === 'user') {
          console.log('✅ Layout: Simple user detected, allowing access');
          // 간편 로그인 사용자를 위한 mock user 생성
          const mockUser = {
            id: userData.user_id || 'simple-user-id',
            email: userData.email || `${userData.name}@${userData.department}.kr`,
            user_metadata: { role: 'user', name: userData.name },
            app_metadata: {},
            aud: 'authenticated',
            created_at: userData.loginTime || new Date().toISOString()
          };
          setUser(mockUser);
          setIsLoading(false);
          return;
        }
      }

      console.log('❌ Layout: No auth found, redirecting to login');
      router.push('/auth/login');
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // 리다이렉트 중
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />
      
      {/* Main Content */}
      <div className="lg:pl-64">
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}