"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  BarChart3,
  Settings,
  Menu,
  X,
  Plus
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const getNavigationItems = (user: User): NavigationItem[] => {
  const isAdmin = user.email === 'master@korea.kr' ||
                  user.user_metadata?.role === 'admin' ||
                  user.user_metadata?.role === 'master_admin' ||
                  user.email?.includes('admin') ||
                  user.email?.includes('master');
  
  if (isAdmin) {
    return [
      {
        href: "/records/new",
        label: "운행 기록 작성",
        icon: <Plus className="w-4 h-4" />,
      },
      {
        href: "/admin",
        label: "관리자 설정",
        icon: <Settings className="w-4 h-4" />,
      },
      {
        href: "/reports",
        label: "차량별 통계",
        icon: <BarChart3 className="w-4 h-4" />,
      },
    ];
  } else {
    return [
      {
        href: "/records/new",
        label: "운행 기록 작성",
        icon: <Plus className="w-4 h-4" />,
      },
      {
        href: "/reports",
        label: "내 차량 통계",
        icon: <BarChart3 className="w-4 h-4" />,
      },
    ];
  }
};

interface NavigationProps {
  user: User;
}

export function Navigation({ user }: NavigationProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  
  const navigationItems = getNavigationItems(user);
  const isAdmin = user.email === 'master@korea.kr' ||
                  user.user_metadata?.role === 'admin' ||
                  user.user_metadata?.role === 'master_admin' ||
                  user.email?.includes('admin') ||
                  user.email?.includes('master');

  const handleLogout = async () => {
    // 간편 로그인 데이터 제거
    localStorage.removeItem('simplefleet_user');
    // Supabase 로그아웃
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <>
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <Link href={isAdmin ? "/admin" : "/records/new"} className="flex items-center space-x-2">
            <Car className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">SimpleFleet</span>
          </Link>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
        
        {isMobileMenuOpen && (
          <div className="border-b bg-white">
            <nav className="px-4 py-2 space-y-1">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="flex items-center space-x-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:bg-white">
        <div className="flex items-center px-6 py-4 border-b">
          <Link href={isAdmin ? "/admin" : "/records/new"} className="flex items-center space-x-2">
            <Car className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">SimpleFleet</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center space-x-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <Badge variant="secondary" className="text-xs">
                  {item.badge}
                </Badge>
              )}
            </Link>
          ))}
        </nav>
        
        <div className="border-t px-4 py-4">
          <div className="flex items-center space-x-3 px-3 py-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
              <p className="text-xs text-gray-500 truncate">{isAdmin ? "관리자" : "사용자"}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleLogout}>
            로그아웃
          </Button>
        </div>
      </div>
    </>
  );
}