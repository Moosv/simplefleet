"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    // korea.kr 도메인 검증
    if (!email.endsWith('@korea.kr')) {
      setError("korea.kr 도메인 이메일만 사용할 수 있습니다.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      setLoading(false);
      return;
    }

    // 부서명 검증 (기타 선택 시 커스텀 입력 필요)
    const finalDepartment = department === "기타" ? customDepartment : department;

    if (!finalDepartment.trim()) {
      setError("부서명을 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role: isAdmin ? 'pending_admin' : 'user',
            name: name.trim(),
            email_confirm: false, // 이메일 확인 비활성화
          }
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          setError("이미 가입된 이메일입니다. 로그인 페이지에서 로그인해 주세요.");
        } else {
          setError(error.message);
        }
      } else {
        // 회원가입 성공 시 바로 로그인 시도
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setMessage("회원가입이 완료되었습니다. 로그인 페이지에서 다시 시도해주세요.");
          setTimeout(() => {
            router.push('/auth/login');
          }, 2000);
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // drivers 테이블에 사용자 정보 추가 (모든 사용자)
            const { error: driverError } = await supabase
              .from('drivers')
              .insert([{
                user_id: user.id,
                name: name.trim(),
                email: email,
                department: finalDepartment.trim(), // 선택하거나 입력한 부서명
                main_vehicle_number: '', // 관리자가 나중에 설정
                role: isAdmin ? 'pending_admin' : 'user'
              }]);

            if (driverError) {
              console.error('❌ Error adding user to drivers table:', driverError);
              setError(`사용자 정보 저장 실패: ${driverError.message}`);
              return;
            }

            // 관리자 신청인 경우 admin_requests 테이블에 요청 추가
            if (isAdmin) {
              try {
                const { error: requestError } = await supabase
                  .from('admin_requests')
                  .insert([{
                    user_id: user.id,
                    name: name.trim(),
                    email: email,
                    department: finalDepartment.trim(),
                    status: 'pending'
                  }]);

                if (requestError) {
                  console.error('❌ Error adding admin request:', requestError);
                } else {
                  await supabase
                    .from('drivers')
                    .update({ role: 'pending_admin' })
                    .eq('user_id', user.id);
                }
              } catch (err) {
                console.error('❌ Admin request error:', err);
              }
            }
          }

          const roleText = isAdmin ? "관리자 승인 대기" : "사용자";
          setMessage(`${roleText} 회원가입 및 로그인이 완료되었습니다.`);
          setTimeout(() => {
            router.push('/');
            router.refresh();
          }, 1500);
        }
      }
    } catch {
      setError("회원가입 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SimpleFleet</h1>
          <p className="text-gray-600">관용차 운행 기록 시스템</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>회원가입</CardTitle>
            <CardDescription>정부기관 관용차 시스템 계정을 신청하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              {message && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600">{message}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">이메일 (korea.kr 도메인만)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@korea.kr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  정부기관 korea.kr 도메인 이메일만 사용 가능합니다.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">부서명</Label>
                <Select value={department} onValueChange={setDepartment} required>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="소속 부서를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="산림특용자원연구과">산림특용자원연구과</SelectItem>
                    <SelectItem value="기타">기타 (직접 입력)</SelectItem>
                  </SelectContent>
                </Select>
                {department === "기타" && (
                  <div className="mt-2">
                    <Input
                      type="text"
                      placeholder="부서명을 직접 입력하세요"
                      value={customDepartment}
                      onChange={(e) => setCustomDepartment(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Admin Role Checkbox */}
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                    className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
                  />
                  <div className="flex-1">
                    <label htmlFor="isAdmin" className="text-sm font-medium cursor-pointer">
                      관리자 권한으로 가입
                    </label>
                    {isAdmin && (
                      <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-xs text-amber-700 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          관리자 계정은 마스터 관리자의 승인이 필요합니다
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading 
                  ? "가입 중..." 
                  : isAdmin 
                    ? "관리자 계정 신청" 
                    : "회원가입"
                }
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                이미 계정이 있으신가요?{" "}
                <Link href="/auth/login" className="text-primary hover:underline">
                  로그인
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}