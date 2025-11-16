"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  MapPin,
  Car,
  FileSpreadsheet,
  Clock,
  Route,
  Edit,
  Trash2
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VehicleData {
  vehicleNumber: string;
  department?: string;
  driverName?: string;
  monthlyDistance?: number[];
  totalDistance: number;
  totalTrips: number;
  totalFuel: number;
}

interface UserData {
  vehicleNumber: string;
}

interface SimpleUser {
  type: string;
  name?: string;
  vehicleNumber?: string;
  email?: string;
  role?: string;
}

interface EditFormData {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  vehicleNumber?: string;
  department?: string;
  driverName?: string;
  purpose?: string;
  destination?: string;
  waypoint?: string;
  cumulativeDistance?: string;
  fuelAmount?: string;
}

interface DrivingRecord {
  id: string;
  start_date: string;
  start_time?: string;
  end_date: string;
  end_time?: string;
  vehicle_number: string;
  department?: string;
  driver_name: string;
  purpose: string;
  destination: string;
  waypoint?: string;
  cumulative_distance?: number;
  fuel_amount?: number;
}

interface RegisteredVehicle {
  vehicleNumber: string;
  department?: string;
}

export default function ReportsPage() {
  const [selectedVehicle, setSelectedVehicle] = useState("all");
  const [selectedYear, setSelectedYear] = useState("2024");
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [registeredVehicles, setRegisteredVehicles] = useState<RegisteredVehicle[]>([]);
  const [drivingRecords, setDrivingRecords] = useState<DrivingRecord[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<SimpleUser | null>(null);
  const [userVehicle, setUserVehicle] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DrivingRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<DrivingRecord | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const supabase = createClient();
  
  const selectedVehicleData = selectedVehicle === "all" 
    ? null 
    : vehicleData.find(v => v.vehicleNumber === selectedVehicle);

  // 현재 사용자 정보 로드
  const loadCurrentUser = async () => {
    try {
      // 간편 로그인 사용자 확인
      const simpleUser = localStorage.getItem('simplefleet_user');
      if (simpleUser) {
        const userData = JSON.parse(simpleUser);
        if (userData.type === 'user') {
          setCurrentUser({
            type: 'simple_user',
            name: userData.name,
            vehicleNumber: userData.vehicleNumber
          });
          setUserVehicle(userData.vehicleNumber);
          return;
        }
      }

      // Supabase 인증 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 관리자 권한 확인 (raw_user_meta_data도 체크)
        const adminCheck = user.email === 'master@korea.kr' ||
                          user.user_metadata?.role === 'admin' || 
                          user.user_metadata?.role === 'master_admin' ||
                          user.raw_user_meta_data?.role === 'admin' ||
                          user.raw_user_meta_data?.role === 'master_admin' ||
                          user.email?.includes('admin');
        
        setIsAdmin(adminCheck);
        
        if (adminCheck) {
          setCurrentUser({
            type: 'admin',
            email: user.email,
            role: user.user_metadata?.role || user.raw_user_meta_data?.role
          });
        } else {
          // 일반 사용자인 경우 drivers 테이블에서 차량 정보 조회
          const { data: driverData } = await supabase
            .from('drivers')
            .select('main_vehicle_number')
            .eq('user_id', user.id)
            .single();
          
          setCurrentUser({
            type: 'regular_user',
            email: user.email,
            vehicleNumber: driverData?.main_vehicle_number
          });
          setUserVehicle(driverData?.main_vehicle_number);
        }
      }
    } catch (err) {
      console.error('Error loading current user:', err);
    }
  };

  // 등록된 차량 목록 로드
  const loadRegisteredVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('main_vehicle_number, department, name')
        .not('main_vehicle_number', 'is', null)
        .not('main_vehicle_number', 'eq', '')
        .order('main_vehicle_number');

      if (error) {
        console.error('Error loading vehicles:', error);
        setError('차량 목록을 불러오는데 실패했습니다.');
        return;
      }

      // 중복 제거 및 차량별 그룹핑
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let uniqueVehicles = data.reduce((acc: VehicleData[], curr: any) => {
        const vehicle = curr.main_vehicle_number;
        if (!acc.find(v => v.vehicleNumber === vehicle)) {
          acc.push({
            vehicleNumber: vehicle,
            department: curr.department || '미설정',
            driverName: curr.name,
            totalDistance: 0,
            totalTrips: 0,
            totalFuel: 0
          });
        }
        return acc;
      }, []);

      // 일반 사용자의 경우 본인 차량만 필터링
      if (currentUser && (currentUser.type === 'simple_user' || currentUser.type === 'regular_user')) {
        if (userVehicle && userVehicle !== '미설정') {
          uniqueVehicles = uniqueVehicles.filter((v: VehicleData) => v.vehicleNumber === userVehicle);

          // 일반 사용자의 경우 자동으로 본인 차량 선택 (한 번만)
          if (uniqueVehicles.length > 0 && selectedVehicle === 'all') {
            setSelectedVehicle(uniqueVehicles[0].vehicleNumber);
          }
        } else {
          // 차량이 미설정인 경우 빈 배열
          uniqueVehicles = [];
        }
      }

      setRegisteredVehicles(uniqueVehicles);
    } catch (err) {
      console.error('Error:', err);
      setError('차량 목록을 불러오는데 실패했습니다.');
    }
  };

  // 등록된 연도 목록 로드
  const loadAvailableYears = async () => {
    try {
      const { data, error } = await supabase
        .from('driving_records')
        .select('start_date')
        .order('start_date', { ascending: false });

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading years:', error);
        // 테이블이 없는 경우 기본 연도 설정
        setAvailableYears(['2024']);
        return;
      }

      if (data && data.length > 0) {
        // 운행 기록에서 연도 추출 및 중복 제거
        const years = ([...new Set(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map((record: any) => new Date(record.start_date).getFullYear().toString())
        )] as string[]).sort((a, b) => parseInt(b) - parseInt(a)); // 최신 연도부터 정렬

        setAvailableYears(years);
        
        // 선택된 연도가 없거나 사용할 수 없는 연도면 최신 연도로 설정
        if (!selectedYear || !years.includes(selectedYear)) {
          setSelectedYear(years[0] || '2024');
        }
      } else {
        // 운행 기록이 없는 경우 현재 연도 설정
        const currentYear = new Date().getFullYear().toString();
        setAvailableYears([currentYear]);
        setSelectedYear(currentYear);
      }
    } catch (err) {
      console.error('Error:', err);
      // 에러 발생 시 기본 연도 설정
      setAvailableYears(['2024']);
      setSelectedYear('2024');
    }
  };

  // 운행 기록 로드
  const loadDrivingRecords = async () => {
    try {
      let query = supabase
        .from('driving_records')
        .select('*')
        .gte('start_date', `${selectedYear}-01-01`)
        .lt('start_date', `${parseInt(selectedYear) + 1}-01-01`);

      // 일반 사용자의 경우 본인 차량 기록만 조회
      if (currentUser && (currentUser.type === 'simple_user' || currentUser.type === 'regular_user')) {
        if (userVehicle && userVehicle !== '미설정') {
          query = query.eq('vehicle_number', userVehicle);
        } else {
          // 차량이 미설정인 경우 빈 결과 반환
          setDrivingRecords([]);
          return;
        }
      }

      const { data, error } = await query.order('start_date', { ascending: true });

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading driving records:', error);
        setError('운행 기록을 불러오는데 실패했습니다.');
        return;
      }

      setDrivingRecords(data || []);
    } catch (err) {
      console.error('Error:', err);
      // 테이블이 없는 경우 빈 배열로 설정
      setDrivingRecords([]);
    }
  };

  // 시간 차이 계산 함수
  const calculateTimeDifference = (startDate: string, startTime?: string, endDate?: string, endTime?: string) => {
    if (!startDate || !endDate) return '-';
    
    const start = new Date(`${startDate}T${startTime || '00:00'}:00`);
    const end = new Date(`${endDate}T${endTime || '23:59'}:59`);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
    
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return '-';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours >= 24) {
      const days = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;
      return `${days}일 ${remainingHours}시간${diffMinutes > 0 ? ` ${diffMinutes}분` : ''}`;
    } else {
      return `${diffHours}시간${diffMinutes > 0 ? ` ${diffMinutes}분` : ''}`;
    }
  };

  // 주행거리 계산 함수 (간단한 추정)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calculateTripDistance = (record: any, allRecords: any[]) => {
    // 같은 차량의 이전 기록과 비교하여 주행거리 추정
    const sameVehicleRecords = allRecords
      .filter(r => r.vehicle_number === record.vehicle_number)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    
    const currentIndex = sameVehicleRecords.findIndex(r => r.id === record.id);
    
    if (currentIndex > 0 && record.cumulative_distance && sameVehicleRecords[currentIndex - 1].cumulative_distance) {
      const distance = record.cumulative_distance - sameVehicleRecords[currentIndex - 1].cumulative_distance;
      return distance > 0 ? distance.toFixed(1) : '-';
    }
    
    // 첫 번째 기록이거나 계산할 수 없는 경우 임의의 거리 (실제로는 더 정교한 계산 필요)
    return record.cumulative_distance ? '추정 불가' : '-';
  };

  // 차량별 통계 계산
  // 수정 기능
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setEditFormData({
      startDate: record.start_date,
      startTime: record.start_time || '',
      endDate: record.end_date,
      endTime: record.end_time || '',
      vehicleNumber: record.vehicle_number,
      department: record.department,
      driverName: record.driver_name,
      purpose: record.purpose,
      destination: record.destination,
      waypoint: record.waypoint || '',
      cumulativeDistance: record.cumulative_distance?.toString() || '',
      fuelAmount: record.fuel_amount?.toString() || '',
    });
    setIsEditDialogOpen(true);
  };

  // 수정 저장
  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    try {
      const { error } = await supabase
        .from('driving_records')
        .update({
          start_date: editFormData.startDate,
          start_time: editFormData.startTime || null,
          end_date: editFormData.endDate,
          end_time: editFormData.endTime || null,
          vehicle_number: editFormData.vehicleNumber,
          department: editFormData.department,
          driver_name: editFormData.driverName,
          purpose: editFormData.purpose,
          destination: editFormData.destination,
          waypoint: editFormData.waypoint || null,
          cumulative_distance: editFormData.cumulativeDistance ? parseFloat(editFormData.cumulativeDistance) : null,
          fuel_amount: editFormData.fuelAmount ? parseFloat(editFormData.fuelAmount) : null,
        })
        .eq('id', editingRecord.id);

      if (error) {
        alert(`수정 실패: ${error.message}`);
        return;
      }

      alert('✅ 운행 기록이 성공적으로 수정되었습니다!');
      setIsEditDialogOpen(false);
      setEditingRecord(null);
      
      // 데이터 새로고침
      loadDrivingRecords();
    } catch (err) {
      console.error('Edit error:', err);
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  // 삭제 기능
  const handleDeleteRecord = (record: DrivingRecord) => {
    setRecordToDelete(record);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      const { error } = await supabase
        .from('driving_records')
        .delete()
        .eq('id', recordToDelete.id);

      if (error) {
        alert(`삭제 실패: ${error.message}`);
        return;
      }

      alert('✅ 운행 기록이 성공적으로 삭제되었습니다!');
      setIsDeleteDialogOpen(false);
      setRecordToDelete(null);
      
      // 데이터 새로고침
      loadDrivingRecords();
    } catch (err) {
      console.error('Delete error:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const calculateVehicleStats = () => {
    const stats = registeredVehicles.map(vehicle => {
      const vehicleRecords = drivingRecords.filter(record => 
        record.vehicle_number === vehicle.vehicleNumber
      );

      // 월별 거리 계산 (1월-12월)
      const monthlyDistance = Array.from({ length: 12 }, (_, month) => {
        return vehicleRecords
          .filter(record => {
            const recordMonth = new Date(record.start_date).getMonth();
            return recordMonth === month;
          })
          .reduce((sum, record) => {
            // 최대 거리에서 최소 거리를 빼서 운행 거리 계산 (간단한 추정)
            return sum + (record.cumulative_distance || 0);
          }, 0);
      });

      // 총 거리 (누적 주행거리의 최대값 - 최소값으로 추정)
      const distances = vehicleRecords
        .map(r => r.cumulative_distance)
        .filter((d): d is number => d !== undefined && d > 0)
        .sort((a, b) => a - b);
      
      const totalDistance = distances.length > 1 
        ? Math.round(distances[distances.length - 1] - distances[0])
        : distances[0] || 0;

      return {
        vehicleNumber: vehicle.vehicleNumber,
        department: vehicle.department,
        monthlyDistance,
        totalDistance,
        totalTrips: vehicleRecords.length,
        totalFuel: vehicleRecords.reduce((sum, r) => sum + (r.fuel_amount || 0), 0)
      };
    });

    setVehicleData(stats);
    setIsLoading(false);
  };

  useEffect(() => {
    loadCurrentUser();
    loadAvailableYears();
  }, [loadCurrentUser, loadAvailableYears]);

  useEffect(() => {
    if (currentUser !== null) {
      loadRegisteredVehicles();
    }
  }, [currentUser, userVehicle, loadRegisteredVehicles]);

  useEffect(() => {
    if (registeredVehicles.length >= 0 && selectedYear && currentUser !== null) {
      loadDrivingRecords();
    }
  }, [registeredVehicles, selectedYear, currentUser, userVehicle, loadDrivingRecords]);

  useEffect(() => {
    if (registeredVehicles.length > 0) {
      calculateVehicleStats();
    }
  }, [registeredVehicles, drivingRecords, calculateVehicleStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">통계 데이터를 불러오고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">차량별 통계 리포트</h1>
          <p className="text-gray-600">차량번호별 운행 현황을 분석하세요</p>
        </div>
      </div>

      {/* Vehicle Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            {currentUser?.type === 'admin' ? '차량 선택' : '내 차량 통계'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">차량번호</label>
              {currentUser?.type === 'admin' ? (
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 차량</SelectItem>
                    {registeredVehicles.map(vehicle => (
                      <SelectItem key={vehicle.vehicleNumber} value={vehicle.vehicleNumber}>
                        {vehicle.vehicleNumber} ({vehicle.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center p-3 border border-gray-200 rounded-md bg-gray-50">
                  <Car className="w-4 h-4 mr-2 text-gray-600" />
                  <span className="font-medium">
                    {userVehicle && userVehicle !== '미설정' ? userVehicle : '차량 미배정'}
                  </span>
                  {registeredVehicles.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      내 차량
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">연도</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}년</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {selectedVehicleData ? `${selectedVehicleData.vehicleNumber} 총 거리` : "전체 총 거리"}
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedVehicleData 
                ? `${selectedVehicleData.totalDistance}km` 
                : `${vehicleData.reduce((sum, v) => sum + v.totalDistance, 0)}km`
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedVehicleData ? selectedVehicleData.department : "전체 차량"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 운행 횟수</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedVehicleData 
                ? `${selectedVehicleData.totalTrips}회` 
                : `${vehicleData.reduce((sum, v) => sum + v.totalTrips, 0)}회`
              }
            </div>
            <p className="text-xs text-muted-foreground">
              연간 누적
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Vehicle Analysis */}
      {selectedVehicle === "all" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              차량별 운행 현황
            </CardTitle>
            <CardDescription>등록된 차량의 운행 현황을 비교하세요</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <div className="space-y-4">
              {vehicleData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  등록된 차량이 없습니다.
                </div>
              ) : (
                vehicleData.map((vehicle) => {
                  const maxDistance = Math.max(...vehicleData.map(v => v.totalDistance), 1);
                  const percentage = (vehicle.totalDistance / maxDistance) * 100;
                  return (
                    <div key={vehicle.vehicleNumber} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">{vehicle.vehicleNumber}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {vehicle.totalTrips}회 운행
                          </span>
                          <span className="text-xs text-gray-400">
                            ({vehicle.department})
                          </span>
                        </div>
                        <div className="text-sm font-medium">
                          {vehicle.totalDistance}km
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {selectedVehicleData ? `${selectedVehicleData.vehicleNumber} 상세 운행 기록` : "전체 상세 운행 기록"}
          </CardTitle>
          <CardDescription>
            {selectedVehicleData 
              ? `${selectedVehicleData.department} 소속 ${selectedVehicleData.vehicleNumber} 차량의 상세 운행 내역` 
              : "등록된 모든 차량의 상세 운행 내역"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="min-w-[60px] font-bold text-center">순서</TableHead>
                  <TableHead className="min-w-[100px] font-bold">차량번호</TableHead>
                  <TableHead className="min-w-[120px] font-bold">소속 부서</TableHead>
                  <TableHead className="min-w-[100px] font-bold">운전자 이름</TableHead>
                  <TableHead className="min-w-[150px] font-bold">사용 목적</TableHead>
                  <TableHead className="min-w-[150px] font-bold">사용 시작일시</TableHead>
                  <TableHead className="min-w-[150px] font-bold">사용 종료일시</TableHead>
                  <TableHead className="min-w-[100px] font-bold">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      전체 사용시간
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[120px] font-bold">최종 목적지</TableHead>
                  <TableHead className="min-w-[100px] font-bold">경유지</TableHead>
                  <TableHead className="min-w-[80px] font-bold">
                    <div className="flex items-center gap-1">
                      <Route className="w-4 h-4" />
                      주행거리(km)
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[120px] font-bold">누적 주행거리(km)</TableHead>
                  <TableHead className="min-w-[80px] font-bold">주유량(L)</TableHead>
                  {isAdmin && <TableHead className="min-w-[100px] font-bold text-center">작업</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 실제 데이터 표시 */}
                {drivingRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 14 : 13} className="text-center py-8 text-gray-500">
                      {selectedVehicleData 
                        ? `${selectedVehicleData.vehicleNumber} 차량의 운행 기록이 없습니다.`
                        : '선택된 연도에 운행 기록이 없습니다.'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  drivingRecords
                    .filter(record => 
                      selectedVehicleData 
                        ? record.vehicle_number === selectedVehicleData.vehicleNumber
                        : true
                    )
                    .map((record, index) => (
                      <TableRow key={record.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-center text-gray-600">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium text-center">
                          {record.vehicle_number}
                        </TableCell>
                        <TableCell>{record.department || '미설정'}</TableCell>
                        <TableCell>{record.driver_name}</TableCell>
                        <TableCell>{record.purpose}</TableCell>
                        <TableCell>
                          {record.start_date} {record.start_time || ''}
                        </TableCell>
                        <TableCell>
                          {record.end_date} {record.end_time || ''}
                        </TableCell>
                        <TableCell className="text-center font-medium text-blue-600">
                          {calculateTimeDifference(
                            record.start_date,
                            record.start_time,
                            record.end_date,
                            record.end_time
                          )}
                        </TableCell>
                        <TableCell>{record.destination}</TableCell>
                        <TableCell className="text-gray-500">
                          {record.waypoint || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {calculateTripDistance(record, drivingRecords)}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.cumulative_distance ? record.cumulative_distance.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.fuel_amount ? record.fuel_amount.toFixed(1) : '-'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-center">
                            <div className="flex justify-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRecord(record)}
                                className="h-8 w-8 p-0"
                                title="수정"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteRecord(record)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Table Summary */}
          {drivingRecords.length > 0 && (
            <div className="mt-4 pt-4 border-t bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-gray-700">총 운행 건수</div>
                  <div className="text-lg font-bold text-blue-600">
                    {selectedVehicleData 
                      ? drivingRecords.filter(r => r.vehicle_number === selectedVehicleData.vehicleNumber).length
                      : drivingRecords.length
                    }건
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-700">총 주유량</div>
                  <div className="text-lg font-bold text-green-600">
                    {(
                      selectedVehicleData 
                        ? drivingRecords
                            .filter(r => r.vehicle_number === selectedVehicleData.vehicleNumber)
                            .reduce((sum, r) => sum + (r.fuel_amount || 0), 0)
                        : drivingRecords.reduce((sum, r) => sum + (r.fuel_amount || 0), 0)
                    ).toFixed(1)}L
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-700">최대 누적거리</div>
                  <div className="text-lg font-bold text-orange-600">
                    {Math.max(
                      ...(selectedVehicleData 
                        ? drivingRecords
                            .filter(r => r.vehicle_number === selectedVehicleData.vehicleNumber)
                            .map(r => r.cumulative_distance || 0)
                        : drivingRecords.map(r => r.cumulative_distance || 0)
                      ),
                      0
                    ).toLocaleString()}km
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-700">최근 운행일</div>
                  <div className="text-lg font-bold text-purple-600">
                    {selectedVehicleData 
                      ? Math.max(
                          ...drivingRecords
                            .filter(r => r.vehicle_number === selectedVehicleData.vehicleNumber)
                            .map(r => new Date(r.start_date).getTime())
                        ) > 0 
                        ? new Date(Math.max(
                            ...drivingRecords
                              .filter(r => r.vehicle_number === selectedVehicleData.vehicleNumber)
                              .map(r => new Date(r.start_date).getTime())
                          )).toLocaleDateString('ko-KR')
                        : '-'
                      : drivingRecords.length > 0
                        ? new Date(Math.max(...drivingRecords.map(r => new Date(r.start_date).getTime()))).toLocaleDateString('ko-KR')
                        : '-'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>운행 기록 수정</DialogTitle>
            <DialogDescription>
              운행 기록 정보를 수정하세요.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-startDate">사용 시작일 *</Label>
              <Input
                id="edit-startDate"
                type="date"
                value={editFormData.startDate || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, startDate: e.target.value}))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-startTime">시작 시간 *</Label>
              <Input
                id="edit-startTime"
                type="time"
                value={editFormData.startTime || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, startTime: e.target.value}))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-endDate">사용 종료일 *</Label>
              <Input
                id="edit-endDate"
                type="date"
                value={editFormData.endDate || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, endDate: e.target.value}))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-endTime">종료 시간 *</Label>
              <Input
                id="edit-endTime"
                type="time"
                value={editFormData.endTime || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, endTime: e.target.value}))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-vehicleNumber">차량번호 *</Label>
              <Input
                id="edit-vehicleNumber"
                value={editFormData.vehicleNumber || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, vehicleNumber: e.target.value}))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-driverName">운전자 이름 *</Label>
              <Input
                id="edit-driverName"
                value={editFormData.driverName || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, driverName: e.target.value}))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-purpose">차량 사용 목적 *</Label>
              <Input
                id="edit-purpose"
                value={editFormData.purpose || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, purpose: e.target.value}))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-destination">최종 목적지 *</Label>
              <Input
                id="edit-destination"
                value={editFormData.destination || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, destination: e.target.value}))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-waypoint">경유지</Label>
              <Input
                id="edit-waypoint"
                value={editFormData.waypoint || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, waypoint: e.target.value}))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-department">소속 부서</Label>
              <Input
                id="edit-department"
                value={editFormData.department || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, department: e.target.value}))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-cumulativeDistance">누적 주행거리 (km) *</Label>
              <Input
                id="edit-cumulativeDistance"
                type="number"
                step="0.1"
                value={editFormData.cumulativeDistance || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, cumulativeDistance: e.target.value}))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-fuelAmount">주유량 (L)</Label>
              <Input
                id="edit-fuelAmount"
                type="number"
                step="0.1"
                value={editFormData.fuelAmount || ''}
                onChange={(e) => setEditFormData(prev => ({...prev, fuelAmount: e.target.value}))}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSaveEdit}>
              운행 기록 수정
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>운행 기록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 운행 기록을 삭제하시겠습니까?
              <br />
              <br />
              <strong>차량번호:</strong> {recordToDelete?.vehicle_number}
              <br />
              <strong>운전자:</strong> {recordToDelete?.driver_name}
              <br />
              <strong>사용일:</strong> {recordToDelete?.start_date}
              <br />
              <br />
              삭제된 데이터는 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}