"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Edit,
  Trash2,
  Building2,
  User,
  Shield
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// 타입 정의
interface Driver {
  id: string;
  user_id?: string;
  name: string;
  email?: string;
  department?: string;
  role: 'user' | 'admin' | 'master_admin' | 'pending_admin';
  main_vehicle_number?: string;
  created_at: string;
}

interface Department {
  id: number;
  name: string;
  count: number;
}

interface UserStats {
  masterAdmin: number;
  admin: number;
  user: number;
  pendingAdmin: number;
}


export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("drivers");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newVehicleNumber, setNewVehicleNumber] = useState("");
  const [registeredUsers, setRegisteredUsers] = useState<Driver[]>([]);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editingField, setEditingField] = useState(""); // 'department', 'vehicle', 'role'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [userStats, setUserStats] = useState<UserStats>({ masterAdmin: 0, admin: 0, user: 0, pendingAdmin: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const supabase = createClient();

  // 현재 사용자가 마스터 관리자인지 확인하는 함수
  const isMasterAdmin = (user: SupabaseUser | null) => {
    return user?.email === 'master@korea.kr' ||
           user?.user_metadata?.role === 'master_admin';
  };


  // 관리자 접근 권한 체크 함수
  const checkAdminAccess = async () => {
    setAccessChecking(true);
    try {
      // localStorage 초기화 (관리자 페이지에서는 항상 정리) - 브라우저에서만 실행
      if (typeof window !== 'undefined') {
        localStorage.removeItem('simplefleet_user');
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setHasAccess(false);
        setAccessChecking(false);
        return;
      }

      setCurrentUser(user);

      // drivers 테이블에서 사용자의 실제 권한 확인
      const { data: driverData, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // drivers 테이블에 사용자가 없어도 auth 메타데이터로 권한 확인 가능
      let driverRole = null;
      if (error && 'code' in error && error.code === 'PGRST116') {
        driverRole = null; // drivers 테이블에 없음
      } else if (error) {
        setError(`사용자 정보 조회 중 오류 발생: ${error.message}`);
        setHasAccess(false);
        setAccessChecking(false);
        return;
      } else {
        driverRole = driverData?.role;
      }

      // drivers 테이블과 auth.users 메타데이터 모두 확인
      const authRole = user.user_metadata?.role;
      
      // master@korea.kr은 항상 마스터 관리자 권한
      const isMasterEmail = user.email === 'master@korea.kr';
      
      // 마스터 이메일이면 무조건 접근 허용
      if (isMasterEmail) {
        setHasAccess(true);
        setAccessChecking(false);
        return;
      }

      // 두 테이블 중 하나라도 admin 이상이면 접근 허용
      const hasDriverPermission = ['admin', 'master_admin'].includes(driverRole);
      const hasAuthPermission = ['admin', 'master_admin'].includes(authRole);
      const hasPermission = hasDriverPermission || hasAuthPermission;
      
      setHasAccess(hasPermission);
      
      // 승인 대기 상태인 경우 메시지 설정
      if (driverRole === 'pending_admin') {
        setError("관리자 권한 승인이 대기 중입니다. 마스터 관리자의 승인을 기다려주세요.");
      } else if (!hasPermission) {
        setError(`현재 권한 - 드라이버: ${driverRole || '없음'}, 인증: ${authRole || '없음'}. 관리자 권한이 필요합니다.`);
      }
      
    } catch (_) {
      setHasAccess(false);
    } finally {
      setAccessChecking(false);
    }
  };

  // 폼 초기화 함수
  const resetForm = () => {
    setNewItemName("");
    setNewItemDescription("");
    setNewVehicleNumber("");
    setError("");
  };

  // 등록된 사용자 목록 로드 및 통계 계산
  const loadRegisteredUsers = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        setError("로그인이 필요합니다.");
        return;
      }

      // 현재 drivers 테이블에서 모든 사용자 정보 조회
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        setError(`사용자 목록 로드 실패: ${error.message}`);
        return;
      }
      
      setRegisteredUsers(data || []);
      
      // 사용자 통계 계산
      const masterAdminUsers = data?.filter((user: Driver) => user.role === 'master_admin') || [];
      const adminUsers = data?.filter((user: Driver) => user.role === 'admin') || [];
      const regularUsers = data?.filter((user: Driver) => user.role === 'user') || [];
      const pendingAdminUsers = data?.filter((user: Driver) => user.role === 'pending_admin') || [];
      
      const stats = {
        masterAdmin: masterAdminUsers.length,
        admin: adminUsers.length,
        user: regularUsers.length,
        pendingAdmin: pendingAdminUsers.length
      };
      
      setUserStats(stats);
      
      // 부서별 통계 계산
      const deptStats: { [key: string]: number } = {};
      data?.forEach((user: Driver) => {
        if (user.department) {
          const dept = user.department.trim();
          deptStats[dept] = (deptStats[dept] || 0) + 1;
        }
      });
      
      const departmentList = Object.entries(deptStats).map(([name, count], index) => ({
        id: index + 1,
        name,
        count
      }));
      setDepartments(departmentList);
      
    } catch (_) {
      setError("사용자 목록을 불러오는 중 오류가 발생했습니다.");
    }
  };

  // 운전자 목록 로드 (기존)
  const loadDrivers = async () => {
    await loadRegisteredUsers();
  };

  // 현재 사용자 정보 로드
  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (_) {
      // Silent error handling - user will be redirected if not logged in
    }
  };
  // 부서명 수정 함수
  const handleUpdateDepartment = async (oldName: string, newName: string) => {
    if (!newName.trim()) {
      setError("부서명을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // 마스터 계정 특별 처리 및 관리자 권한 체크
      const isMasterEmail = currentUser?.email === 'master@korea.kr';
      const hasAdminRole = ['admin', 'master_admin'].includes(currentUser?.user_metadata?.role);
      const isAdminEmail = currentUser?.email?.includes('admin');
      
      if (!currentUser || !(isMasterEmail || hasAdminRole || isAdminEmail)) {
        setError("권한이 없습니다.");
        return;
      }

      // 기존 부서명을 새 부서명으로 업데이트
      const { error: updateError } = await supabase
        .from('drivers')
        .update({ department: newName.trim() })
        .eq('department', oldName);

      if (updateError) {
        setError(`부서명 수정에 실패했습니다: ${updateError.message}`);
        return;
      }

      // 데이터 새로고침
      await loadRegisteredUsers();
      setError("");
    } catch (_) {
      setError("부서명 수정 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 부서 삭제 함수 (마스터 관리자만 가능)
  const handleDeleteDepartment = async (departmentName: string) => {
    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // 마스터 이메일이거나 마스터 관리자 권한만 부서 삭제 가능
      const isMasterUser = currentUser?.email === 'master@korea.kr' || currentUser?.user_metadata?.role === 'master_admin';
      
      if (!currentUser || !isMasterUser) {
        setError("부서 삭제는 마스터 관리자만 가능합니다.");
        return;
      }

      // 해당 부서에 속한 모든 사용자의 부서를 비움으로 설정
      const { error: updateError } = await supabase
        .from('drivers')
        .update({ department: null })
        .eq('department', departmentName);

      if (updateError) {
        setError(`부서 삭제에 실패했습니다: ${updateError.message}`);
        return;
      }

      // 데이터 새로고침
      await loadRegisteredUsers();
      setError("");
    } catch (_) {
      setError("부서 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 사용자 삭제 함수
  const handleDeleteUser = async (user: Driver) => {
    setIsLoading(true);
    setError("");

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        setError("로그인이 필요합니다.");
        return;
      }

      // 현재 사용자 권한 확인
      const isMasterAdmin = currentUser.email === 'master@korea.kr' ||
                           currentUser.user_metadata?.role === 'master_admin';
      const isAdmin = currentUser.user_metadata?.role === 'admin' ||
                     currentUser.email?.includes('admin');

      // 권한 체크: 최소한 관리자여야 함
      if (!isMasterAdmin && !isAdmin) {
        setError("권한이 없습니다. 관리자만 사용자를 삭제할 수 있습니다.");
        return;
      }

      // 삭제 대상 권한 체크
      const targetIsMasterAdmin = user.role === 'master_admin';
      const targetIsAdmin = user.role === 'admin';

      // 권한별 삭제 가능 여부 체크
      if (targetIsMasterAdmin) {
        // 마스터 관리자는 마스터 관리자만 삭제 가능
        if (!isMasterAdmin) {
          setError("마스터 관리자는 다른 마스터 관리자만 삭제할 수 있습니다.");
          return;
        }
      } else if (targetIsAdmin) {
        // 일반 관리자는 마스터 관리자만 삭제 가능
        if (!isMasterAdmin) {
          setError("일반 관리자는 다른 관리자를 삭제할 수 없습니다.");
          return;
        }
      }
      // 일반 사용자는 관리자 이상이면 모두 삭제 가능

      // 완전한 사용자 삭제 (auth.users와 drivers 테이블 모두에서 삭제)
      const { error: deleteError } = await supabase.rpc('delete_user_completely', {
        target_user_id: user.user_id
      });

      if (deleteError) {
        console.error('Delete error:', deleteError);
        setError(`사용자 삭제에 실패했습니다: ${deleteError.message}`);
        return;
      }

      // 성공 메시지 및 목록 새로고침
      setError("");
      alert(`${user.name} 사용자가 삭제되었습니다.`);

      // 목록 새로고침
      await loadRegisteredUsers();

    } catch (error) {
      console.error('Delete user error:', error);
      setError("사용자 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (!hasAccess || accessChecking) return;

    loadCurrentUser();
    
    // drivers나 permissions 탭일 때 데이터 로드
    if (activeTab === 'drivers' || activeTab === 'permissions') {
      loadDrivers();
      
      // Supabase 실시간 구독 설정
      const subscription = supabase
        .channel('drivers_channel')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'drivers' },
          () => {
            loadDrivers(); // 실시간으로 목록 새로고침
          }
        )
        .subscribe();

      // 컴포넌트 언마운트 시 구독 해제
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [activeTab, hasAccess, accessChecking]);

  const handleUpdateUser = async () => {
    if (!editingDriver || !editingField) return;
    
    setIsLoading(true);
    setError("");
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // 마스터 계정 특별 처리 및 관리자 권한 체크
      const isMasterEmail = currentUser?.email === 'master@korea.kr';
      const hasAdminRole = ['admin', 'master_admin'].includes(currentUser?.user_metadata?.role);
      const isAdminEmail = currentUser?.email?.includes('admin');
      
      if (!currentUser || !(isMasterEmail || hasAdminRole || isAdminEmail)) {
        setError("권한이 없습니다.");
        return;
      }

      const updateData: Partial<Driver> = {};

      // 필드별 검증 및 데이터 준비
      if (editingField === 'name') {
        if (!newItemName.trim()) {
          setError("사용자 이름을 입력해주세요.");
          return;
        }
        updateData.name = newItemName.trim();
      } else if (editingField === 'department') {
        if (!newItemDescription.trim()) {
          setError("소속 부서를 입력해주세요.");
          return;
        }
        updateData.department = newItemDescription.trim();
      } else if (editingField === 'vehicle') {
        if (!newVehicleNumber.trim()) {
          setError("차량번호를 입력해주세요.");
          return;
        }
        updateData.main_vehicle_number = newVehicleNumber.trim();
      } else if (editingField === 'role') {
        // 마스터 이메일이거나 관리자 권한이 있어야 권한 변경 가능
        if (!(isMasterEmail || hasAdminRole || isAdminEmail)) {
          setError("권한 변경은 관리자만 가능합니다.");
          return;
        }
        // 마스터 관리자는 마스터 관리자만 편집 가능
        const isMasterUser = isMasterEmail || currentUser.user_metadata?.role === 'master_admin';
        if (editingDriver.role === 'master_admin' && !isMasterUser) {
          setError("마스터 관리자는 다른 마스터 관리자만 편집할 수 있습니다.");
          return;
        }
        // 마스터 관리자 권한은 마스터 관리자만 부여 가능
        if (newItemName === 'master_admin' && !isMasterUser) {
          setError("마스터 관리자 권한은 마스터 관리자만 부여할 수 있습니다.");
          return;
        }
        // pending_admin인 경우 자동으로 admin으로 승급
        let targetRole = newItemName;
        if (editingDriver.role === 'pending_admin' && !newItemName) {
          targetRole = 'admin';
        } else if (!newItemName) {
          setError("권한을 선택해주세요.");
          return;
        }
        updateData.role = targetRole as "user" | "admin" | "master_admin" | "pending_admin";
      }

      const { data: updateResult, error: updateError } = await supabase
        .from('drivers')
        .update(updateData)
        .eq('id', editingDriver.id)
        .select();

      if (updateError) {
        setError(`정보 수정에 실패했습니다: ${updateError.message}`);
        return;
      }

      // role을 업데이트한 경우 auth.users 테이블의 메타데이터도 동시에 업데이트
      if (editingField === 'role' && updateResult && updateResult[0]) {
        // Supabase Admin API는 클라이언트에서 직접 접근할 수 없으므로, 
        // RPC 함수를 통해 auth.users 업데이트
        const { error: authUpdateError } = await supabase.rpc('update_user_role', {
          user_id: editingDriver.user_id,
          new_role: newItemName
        });

        if (authUpdateError) {
          // drivers 테이블은 업데이트되었으므로 warning만 표시
          setError(`권한이 부분적으로 업데이트되었습니다. 페이지를 새로고침 후 다시 시도해주세요.`);
        }
      }
      
      // 목록 새로고침
      await loadRegisteredUsers();
      
      // 폼 초기화 및 다이얼로그 닫기
      resetForm();
      setIsEditDialogOpen(false);
      setEditingDriver(null);
      setEditingField("");
    } catch (_) {
      setError("예상치 못한 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // pending_admin을 admin으로 승급하는 함수
  const handlePromoteUser = async (user: Driver) => {
    setIsLoading(true);
    setError("");
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // 마스터 계정 특별 처리 및 관리자 권한 체크
      const isMasterEmail = currentUser?.email === 'master@korea.kr';
      const hasAdminRole = ['admin', 'master_admin'].includes(currentUser?.user_metadata?.role);
      const isAdminEmail = currentUser?.email?.includes('admin');
      
      if (!currentUser || !(isMasterEmail || hasAdminRole || isAdminEmail)) {
        setError("권한이 없습니다.");
        return;
      }

      // pending_admin을 admin으로 승급
      const { error: updateError } = await supabase
        .from('drivers')
        .update({ role: 'admin' })
        .eq('id', user.id)
        .select();

      if (updateError) {
        setError(`승급에 실패했습니다: ${updateError.message}`);
        return;
      }

      // 목록 새로고침
      await loadRegisteredUsers();
      
      // 성공 메시지 표시
      const successMsg = `${user.name}님을 관리자로 승급했습니다.`;
      setError(`✅ ${successMsg}`);
      
      // 3초 후 성공 메시지 제거
      setTimeout(() => {
        setError("");
      }, 3000);
      
    } catch (_) {
      setError("예상치 못한 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };



  const tabs = [
    { id: "drivers", name: "운전자 관리", icon: User },
    { id: "permissions", name: "권한 관리", icon: Shield },
    { id: "departments", name: "부서 관리", icon: Building2 },
  ];

  // 접근 권한 체크 중
  if (accessChecking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">관리자 권한을 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // 접근 권한이 없는 경우
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-red-600">접근 권한이 없습니다</CardTitle>
            <CardDescription>
              {error || "관리자 권한이 필요합니다. 관리자에게 문의하세요."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              대시보드로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">관리자 설정</h1>
          <p className="text-gray-600">시스템의 마스터 데이터를 관리하세요</p>
        </div>
        
        <Badge variant="secondary" className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          관리자 권한 필요
        </Badge>
      </div>

      {/* Tab Navigation */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </CardContent>
      </Card>

      {/* Departments Tab */}
      {activeTab === "departments" && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  부서 관리
                </CardTitle>
                <CardDescription>조직의 부서 정보를 관리합니다</CardDescription>
              </div>
              <Badge variant="outline" className="text-sm">
                총 {departments.length}개 부서
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>부서명</TableHead>
                  <TableHead>소속 인원</TableHead>
                  <TableHead className="w-24">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newName = prompt('새로운 부서명을 입력하세요:', dept.name);
                          if (newName && newName !== dept.name) {
                            handleUpdateDepartment(dept.name, newName);
                          }
                        }}
                        className="font-medium text-left justify-start p-0 h-auto hover:bg-gray-100"
                      >
                        {dept.name}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{dept.count}명</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newName = prompt('새로운 부서명을 입력하세요:', dept.name);
                            if (newName && newName !== dept.name) {
                              handleUpdateDepartment(dept.name, newName);
                            }
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {/* 마스터 관리자만 삭제 가능 */}
                        {(currentUser?.email === 'master@korea.kr' || currentUser?.user_metadata?.role === 'master_admin') ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>부서 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  정말로 &quot;{dept.name}&quot; 부서를 삭제하시겠습니까? 
                                  해당 부서에 속한 사용자들의 부서 정보가 비워집니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteDepartment(dept.name)}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={isLoading}
                                >
                                  {isLoading ? "삭제 중..." : "삭제"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <div className="flex items-center justify-center h-8 w-8 text-gray-400">
                            <span className="text-xs">비활성</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Drivers Tab */}
      {activeTab === "drivers" && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  등록된 사용자 관리
                </CardTitle>
                <CardDescription>회원가입한 사용자들의 부서와 차량 정보를 설정합니다</CardDescription>
              </div>
              <Badge variant="outline" className="text-sm">
                총 {registeredUsers.length}명
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>소속 부서</TableHead>
                  <TableHead>주 차량번호</TableHead>
                  <TableHead>권한</TableHead>
                  <TableHead className="w-24">삭제</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registeredUsers.map((user: Driver) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {/* 마스터 관리자만 이름 수정 가능 */}
                      {isMasterAdmin(currentUser) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingDriver(user);
                            setEditingField('name');
                            setNewItemName(user.name || '');
                            setIsEditDialogOpen(true);
                          }}
                          className="text-left justify-start p-0 h-auto font-medium"
                        >
                          <div className="flex items-center space-x-1">
                            <span className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded">{user.name}</span>
                            <span className="text-xs text-green-600">✓</span>
                          </div>
                        </Button>
                      ) : (
                        /* 일반 관리자는 이름을 볼 수만 있고 수정할 수 없음 */
                        <div className="flex items-center space-x-2">
                          <span>{user.name}</span>
                          <span className="text-xs text-gray-400 ml-1">🔒</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{user.email}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingDriver(user);
                          setEditingField('department');
                          setNewItemDescription(user.department || '');
                          setIsEditDialogOpen(true);
                        }}
                        className="text-left justify-start p-0 h-auto"
                      >
                        {user.department ? (
                          <div className="flex items-center space-x-1">
                            <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200">{user.department}</Badge>
                            {/* 모든 관리자는 부서 수정 가능함을 표시 */}
                            <span className="text-xs text-green-600">✓</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <span className="text-blue-600 text-sm hover:underline">미설정 (수정)</span>
                            <span className="text-xs text-green-600">✓</span>
                          </div>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingDriver(user);
                          setEditingField('vehicle');
                          setNewVehicleNumber(user.main_vehicle_number || '');
                          setIsEditDialogOpen(true);
                        }}
                        className="text-left justify-start p-0 h-auto"
                      >
                        {user.main_vehicle_number ? (
                          <div className="flex items-center space-x-1">
                            <span className="font-mono text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded">{user.main_vehicle_number}</span>
                            {/* 모든 관리자는 차량번호 수정 가능함을 표시 */}
                            <span className="text-xs text-green-600">✓</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <span className="text-blue-600 text-sm hover:underline">미설정 (수정)</span>
                            <span className="text-xs text-green-600">✓</span>
                          </div>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {/* 일반 관리자는 권한 수정 불가, 마스터 관리자만 가능 */}
                      {isMasterAdmin(currentUser) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // pending_admin인 경우 바로 승급 처리
                            if (user.role === 'pending_admin') {
                              handlePromoteUser(user);
                              return;
                            }
                            
                            // 마스터 관리자는 마스터 관리자만 편집 가능
                            if (user.role === 'master_admin' && !isMasterAdmin(currentUser)) {
                              setError("마스터 관리자는 다른 마스터 관리자만 편집할 수 있습니다.");
                              return;
                            }
                            setEditingDriver(user);
                            setEditingField('role');
                            setNewItemName(user.role);
                            setIsEditDialogOpen(true);
                          }}
                          disabled={user.role === 'master_admin' && !isMasterAdmin(currentUser)}
                          className="text-left justify-start p-0 h-auto disabled:opacity-100"
                        >
                          <Badge 
                            variant={
                              user.role === 'master_admin' ? 'default' :
                              user.role === 'admin' ? 'secondary' :
                              user.role === 'pending_admin' ? 'outline' : 'outline'
                            }
                            className={
                              user.role === 'master_admin' && !isMasterAdmin(currentUser)
                                ? 'cursor-not-allowed opacity-75'
                                : user.role === 'pending_admin' 
                                  ? 'text-green-700 border-green-300 cursor-pointer hover:bg-green-50 font-semibold' 
                                  : 'cursor-pointer hover:bg-gray-100'
                            }
                          >
                            {user.role === 'master_admin' ? '마스터 관리자' :
                             user.role === 'admin' ? '관리자' :
                             user.role === 'pending_admin' ? '승급하기 ⬆️' : '사용자'}
                          </Badge>
                        </Button>
                      ) : (
                        /* 일반 관리자는 권한을 볼 수만 있고 수정할 수 없음 */
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={
                              user.role === 'master_admin' ? 'default' :
                              user.role === 'admin' ? 'secondary' :
                              user.role === 'pending_admin' ? 'outline' : 'outline'
                            }
                            className="opacity-75"
                          >
                            {user.role === 'master_admin' ? '마스터 관리자' :
                             user.role === 'admin' ? '관리자' :
                             user.role === 'pending_admin' ? '승인 대기' : '사용자'}
                          </Badge>
                          <span className="text-xs text-gray-400 ml-1">🔒</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // 현재 사용자 권한 확인
                        const isMasterAdmin = !!(currentUser?.email === 'master@korea.kr' ||
                                             currentUser?.user_metadata?.role === 'master_admin');
                        const isAdmin = !!(currentUser?.user_metadata?.role === 'admin' ||
                                       currentUser?.email?.includes('admin'));

                        // 삭제 대상 권한 확인
                        const targetIsMasterAdmin = user.role === 'master_admin';
                        const targetIsAdmin = user.role === 'admin';

                        // 삭제 가능 여부 판단
                        let canDelete: boolean = false;
                        let disabledReason = '';

                        if (targetIsMasterAdmin) {
                          // 마스터 관리자는 마스터 관리자만 삭제 가능
                          canDelete = isMasterAdmin;
                          disabledReason = '마스터만';
                        } else if (targetIsAdmin) {
                          // 일반 관리자는 마스터 관리자만 삭제 가능
                          canDelete = isMasterAdmin;
                          disabledReason = '마스터만';
                        } else {
                          // 일반 사용자는 관리자 이상 모두 삭제 가능
                          canDelete = isMasterAdmin || isAdmin;
                          disabledReason = '권한없음';
                        }

                        return canDelete ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>사용자 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  정말로 &quot;{user.name}&quot; 사용자를 삭제하시겠습니까?
                                  관련된 모든 운행 기록도 함께 삭제됩니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user)}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={isLoading}
                                >
                                  {isLoading ? "삭제 중..." : "삭제"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <div className="flex items-center justify-center h-8 w-8 text-gray-400">
                            <span className="text-xs">{disabledReason}</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <AlertDialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingDriver(null);
          setEditingField("");
          resetForm();
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editingField === 'name' ? '사용자 이름 수정' :
               editingField === 'department' ? '소속 부서 수정' :
               editingField === 'vehicle' ? '차량번호 수정' :
               editingField === 'role' ? (isMasterAdmin(currentUser) ? '권한 수정' : '권한 수정 불가') : '정보 수정'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editingField === 'role' && !isMasterAdmin(currentUser) ? (
                `권한 수정은 마스터 관리자만 가능합니다. 현재 ${editingDriver?.name}님의 권한: ${editingDriver?.role === 'master_admin' ? '마스터 관리자' : editingDriver?.role === 'admin' ? '관리자' : editingDriver?.role === 'pending_admin' ? '승인 대기' : '사용자'}`
              ) : (
                `${editingDriver?.name}님의 ${
                  editingField === 'name' ? '이름을' :
                  editingField === 'department' ? '소속 부서를' :
                  editingField === 'vehicle' ? '차량번호를' :
                  editingField === 'role' ? '권한을' : '정보를'
                } 수정합니다.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            {editingField === 'name' && (
              <div className="space-y-2">
                <Label htmlFor="editName">사용자 이름</Label>
                <Input
                  id="editName"
                  placeholder="예: 홍길동"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </div>
            )}
            
            {editingField === 'department' && (
              <div className="space-y-2">
                <Label htmlFor="editDepartment">소속 부서</Label>
                <Input
                  id="editDepartment"
                  placeholder="예: 산림특용자원연구과"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                />
              </div>
            )}
            
            {editingField === 'vehicle' && (
              <div className="space-y-2">
                <Label htmlFor="editVehicle">주 차량번호</Label>
                <Input
                  id="editVehicle"
                  placeholder="예: 12가1234"
                  value={newVehicleNumber}
                  onChange={(e) => setNewVehicleNumber(e.target.value)}
                />
              </div>
            )}

            {/* 권한 수정은 마스터 관리자만 가능 */}
            {editingField === 'role' && isMasterAdmin(currentUser) && (
              <div className="space-y-2">
                <Label htmlFor="editRole">권한</Label>
                <select 
                  id="editRole"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="user">사용자</option>
                  <option value="admin">관리자</option>
                  <option value="pending_admin">승인 대기</option>
                  {/* 마스터 관리자만 마스터 관리자 권한 부여 가능 */}
                  <option value="master_admin">마스터 관리자</option>
                </select>
              </div>
            )}
            
            {/* 일반 관리자가 권한 수정을 시도할 때 안내 메시지 */}
            {editingField === 'role' && !isMasterAdmin(currentUser) && (
              <div className="space-y-2">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <span className="text-yellow-600">🔒</span>
                    <p className="text-sm text-yellow-700 font-medium">권한 수정은 마스터 관리자만 가능합니다</p>
                  </div>
                  <p className="text-xs text-yellow-600 mt-1">부서와 차량번호만 수정하실 수 있습니다.</p>
                </div>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            {/* 일반 관리자가 권한 수정을 시도하는 경우 수정 버튼을 비활성화 */}
            {editingField === 'role' && !isMasterAdmin(currentUser) ? (
              <AlertDialogAction disabled className="bg-gray-300 cursor-not-allowed">
                권한 없음
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={handleUpdateUser} disabled={isLoading}>
                {isLoading ? (
                  editingField === 'role' && editingDriver?.role === 'pending_admin' ? "승급 중..." : "수정 중..."
                ) : (
                  editingField === 'role' && editingDriver?.role === 'pending_admin' ? "관리자로 승급" : "수정"
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Permissions Tab */}
      {activeTab === "permissions" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              권한 관리
            </CardTitle>
            <CardDescription>시스템 권한 및 접근 제어를 관리합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">시스템 운영자</CardTitle>
                    <CardDescription>모든 기능에 대한 전체 접근 권한</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1">
                      <li>• 모든 운행 기록 조회/수정/삭제</li>
                      <li>• 마스터 데이터 관리</li>
                      <li>• 사용자 권한 관리</li>
                      <li>• 시스템 설정 변경</li>
                    </ul>
                    <div className="mt-4">
                      <Badge>{userStats.masterAdmin}명</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">관리자</CardTitle>
                    <CardDescription>운영 관리 권한</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1">
                      <li>• 모든 운행 기록 조회</li>
                      <li>• 통계 리포트 생성</li>
                      <li>• 부서별 데이터 관리</li>
                      <li>• 사용자 관리 (제한적)</li>
                    </ul>
                    <div className="mt-4">
                      <Badge variant="secondary">{userStats.admin}명</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">일반 사용자</CardTitle>
                    <CardDescription>기본 사용 권한</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1">
                      <li>• 개인 운행 기록 등록</li>
                      <li>• 개인 기록 조회</li>
                      <li>• 개인 통계 확인</li>
                      <li>• 프로필 정보 수정</li>
                    </ul>
                    <div className="mt-4">
                      <Badge variant="outline">{userStats.user + userStats.pendingAdmin}명</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
