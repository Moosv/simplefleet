"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCircle, Shield, Car } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  // 관리자 로그인 상태
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  
  // 일반 사용자 로그인 상태
  const [userName, setUserName] = useState("");
  const [userDepartment, setUserDepartment] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const router = useRouter();
  const supabase = createClient();

  // 부서 목록 로드
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        // 임시로 클라이언트에서 직접 조회 (RLS 우회를 위해)
        const { data, error } = await supabase
          .from('drivers')
          .select('department')
          .not('department', 'is', null)
          .not('department', 'eq', '');

        console.log('Departments query result:', { data, error });

        // 모든 사용자 정보도 로그로 출력 (디버깅용)
        const { data: allUsers } = await supabase
          .from('drivers')
          .select('name, department, main_vehicle_number');
        console.log('All users in database for debugging:', allUsers);

        if (!error && data) {
          // 중복 제거하여 부서 목록 생성
          const uniqueDepartments = [...new Set(data.map(item => item.department))].sort();
          console.log('Unique departments:', uniqueDepartments);
          setDepartments(uniqueDepartments);
        } else {
          console.error('Error loading departments:', error);
          // RLS로 인해 실패할 경우 하드코딩된 부서 목록 사용
          setDepartments(['산림특용자원연구과']);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
        // 에러 발생시 하드코딩된 부서 목록 사용
        setDepartments(['산림특용자원연구과']);
      }
    };

    loadDepartments();
  }, [supabase]);

  // 일반 사용자 로그인 처리
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 이벤트 전파 중단
    
    // 즉시 form 비활성화
    const form = e.target as HTMLFormElement;
    if (form) {
      form.style.pointerEvents = 'none';
    }
    
    setLoading(true);
    setError("");

    if (!userName.trim()) {
      setError("이름을 입력해주세요.");
      setLoading(false);
      return;
    }

    if (!userDepartment) {
      setError("소속 부서를 선택해주세요.");
      setLoading(false);
      return;
    }

    try {
      console.log('Attempting login with:', userName.trim(), userDepartment);
      
      // 클라이언트에서 직접 사용자 검증 (역할 상관없이 이름+부서로 검증)
      const { data: driverData, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('name', userName.trim())
        .eq('department', userDepartment)
        .single();

      console.log('Driver query result:', { driverData, error });

      if (error || !driverData) {
        console.log('Login failed: no matching driver found');
        if (error?.code === 'PGRST116') {
          setError("입력한 이름과 소속 부서 정보가 등록된 정보와 일치하지 않습니다. 관리자에게 문의하세요.");
        } else if (error?.message?.includes('RLS')) {
          setError("데이터베이스 접근 권한 문제입니다. 관리자에게 문의하세요.");
        } else {
          setError("입력한 이름과 소속 부서 정보가 등록된 정보와 일치하지 않습니다. 관리자에게 문의하세요.");
        }
        setLoading(false);
        return;
      }

      console.log('Login successful, saving to localStorage');
      console.log('User data from database:', driverData);
      
      // 검증 성공 - 사용자 정보를 로컬 스토리지에 저장 (항상 일반 사용자 모드로)
      const userData = {
        id: driverData.id,
        user_id: driverData.user_id,
        name: userName.trim(),
        email: driverData.email, // 데이터베이스에서 가져온 실제 이메일
        department: userDepartment,
        vehicleNumber: driverData.main_vehicle_number || "미설정",
        actualRole: driverData.role, // 실제 역할은 보관하되
        type: 'user', // 로그인 타입은 항상 'user'로 설정
        loginTime: new Date().toISOString()
      };
      
      localStorage.setItem('simplefleet_user', JSON.stringify(userData));
      console.log('Stored user data:', userData);
      
      // localStorage가 제대로 저장되었는지 재확인
      const storedData = localStorage.getItem('simplefleet_user');
      console.log('Verification - stored data in localStorage:', storedData);
      
      console.log('Redirecting to /records/new');
      
      // 로그인 성공 처리
      console.log('🚀 LOGIN SUCCESS - REDIRECTING NOW');
      setError("");
      setLoading(false);
      
      // 강력한 리다이렉트 (여러 방법 동시 시도)
      console.log('🚀 Method 1: window.location.replace');
      window.location.replace("/records/new");
      
      setTimeout(() => {
        console.log('🚀 Method 2: window.location.href (backup)');
        window.location.href = "/records/new";
      }, 200);
      
      setTimeout(() => {
        console.log('🚀 Method 3: router.push (backup)');
        router.push("/records/new");
      }, 500);
      
      return;
      
    } catch (err) {
      console.error('Login error:', err);
      setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 관리자 로그인 처리
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // korea.kr 도메인 검증
    if (!adminEmail.endsWith('@korea.kr')) {
      setError("korea.kr 도메인 이메일만 사용할 수 있습니다.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setError("계정이 아직 활성화되지 않았습니다. 관리자에게 문의하세요.");
        } else {
          setError(error.message);
        }
      } else {
        // 관리자는 바로 관리자 설정 페이지로 이동
        router.push("/admin");
        router.refresh();
      }
    } catch (err) {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Car className="mx-auto h-12 w-12 text-primary mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SimpleFleet</h1>
          <p className="text-gray-600">관용차 운행 기록 시스템</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>로그인</CardTitle>
            <CardDescription>사용자 유형을 선택하여 로그인하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="user" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="user" className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4" />
                  일반 사용자
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  관리자
                </TabsTrigger>
              </TabsList>
              
              {/* 일반 사용자 로그인 */}
              <TabsContent value="user" className="space-y-4">
                <div className="text-center py-2">
                  <UserCircle className="mx-auto h-16 w-16 text-blue-500 mb-3" />
                  <h3 className="font-semibold text-lg">간편 로그인</h3>
                  <p className="text-sm text-gray-600">이름만 입력하여 빠르게 시작하세요</p>
                </div>
                
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                
                <form onSubmit={handleUserLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="userName">이름</Label>
                    <Input
                      id="userName"
                      type="text"
                      placeholder="이름을 입력하세요 (예: 홍길동)"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="text-center text-lg"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="userDepartment">소속 부서</Label>
                    <Select value={userDepartment} onValueChange={setUserDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="소속 부서를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.length === 0 ? (
                          <SelectItem value="loading" disabled>
                            부서 목록을 불러오는 중...
                          </SelectItem>
                        ) : (
                          departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-700" 
                    disabled={loading || !userName.trim() || !userDepartment}
                  >
                    {loading ? "검증 중..." : "운행 기록 작성하기"}
                  </Button>
                </form>
              </TabsContent>
              
              {/* 관리자 로그인 */}
              <TabsContent value="admin" className="space-y-4">
                <div className="text-center py-2">
                  <Shield className="mx-auto h-16 w-16 text-green-600 mb-3" />
                  <h3 className="font-semibold text-lg">관리자 로그인</h3>
                  <p className="text-sm text-gray-600">이메일과 비밀번호로 안전하게 로그인</p>
                </div>
                
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">관리자 이메일</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      placeholder="admin@korea.kr"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">비밀번호</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      placeholder="비밀번호를 입력하세요"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    disabled={loading || !adminEmail || !adminPassword}
                  >
                    {loading ? "로그인 중..." : "관리자 로그인"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                계정이 없으신가요?{" "}
                <Link href="/auth/signup" className="text-primary hover:underline">
                  회원가입
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}