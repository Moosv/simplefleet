"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, Fuel, Save, Car, Calendar } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

// 사용자별 차량 정보 (임시 데이터)
const getUserVehicleInfo = (email: string) => {
  // 실제로는 데이터베이스에서 조회해야 함
  const vehicleMapping: { [key: string]: { vehicleNumber: string; department: string; name: string; availableVehicles: string[] } } = {
    "admin@korea.kr": { vehicleNumber: "12가1234", department: "산림특용자원연구과", name: "김관리", availableVehicles: ["12가1234", "34나5678", "56다9012"] },
    "user@korea.kr": { vehicleNumber: "34나5678", department: "산림특용자원연구과", name: "이사용", availableVehicles: ["34나5678", "78라0123"] },
  };
  
  return vehicleMapping[email] || { vehicleNumber: "56다9012", department: "산림특용자원연구과", name: "박개발", availableVehicles: ["56다9012", "90마4567"] };
};

export default function NewRecordPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    vehicleNumber: "",
    department: "",
    driverName: "",
    purpose: "",
    customPurpose: "",
    waypoint: "",
    destination: "",
    cumulativeDistance: "",
    fuelAmount: "",
  });

  const [userInfo, setUserInfo] = useState({ vehicleNumber: "", department: "", name: "", availableVehicles: [] as string[] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        console.log('🔍 Records page: Starting user info load');
        
        // 먼저 일반 사용자 로그인 확인
        const simpleUser = localStorage.getItem('simplefleet_user');
        console.log('🔍 Records page: Simple user data from localStorage:', simpleUser);
        
        if (simpleUser) {
          const userData = JSON.parse(simpleUser);
          console.log('🔍 Records page: Parsed user data:', userData);
          
          if (userData.type === 'user') {
            console.log('✅ Records page: Simple user login detected, loading user info');
            
            // 일반 사용자의 경우 저장된 정보 사용
            const userInfo = {
              vehicleNumber: userData.vehicleNumber || "미설정",
              department: userData.department || "산림특용자원연구과",
              name: userData.name,
              availableVehicles: userData.vehicleNumber && userData.vehicleNumber !== "미설정" ? [userData.vehicleNumber] : []
            };
            
            console.log('✅ Records page: User info set:', userInfo);
            
            setUserInfo(userInfo);
            setFormData(prev => ({
              ...prev,
              vehicleNumber: userInfo.vehicleNumber,
              department: userInfo.department,
              driverName: userInfo.name,
            }));
            
            console.log('✅ Records page: Simple user setup complete, returning early');
            return;
          }
        }

        // 관리자 로그인의 경우 Supabase 사용자 확인
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // drivers 테이블에서 실제 사용자 정보 가져오기
          const { data: driverData, error } = await supabase
            .from('drivers')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (driverData && !error) {
            // 실제 사용자 정보로 업데이트
            const userInfo = {
              vehicleNumber: driverData.main_vehicle_number || "미설정",
              department: driverData.department || "미설정",
              name: driverData.name || "미설정",
              availableVehicles: driverData.main_vehicle_number ? [driverData.main_vehicle_number] : []
            };
            
            setUserInfo(userInfo);
            setFormData(prev => ({
              ...prev,
              vehicleNumber: userInfo.vehicleNumber,
              department: userInfo.department,
              driverName: userInfo.name,
            }));
          } else {
            // 사용자 정보가 없으면 임시 데이터 사용
            const info = getUserVehicleInfo(user.email || '');
            setUserInfo(info);
            setFormData(prev => ({
              ...prev,
              vehicleNumber: info.vehicleNumber,
              department: info.department,
              driverName: info.name,
            }));
          }
        } else {
          // 일반 사용자 로그인도 없는 경우에만 로그인 페이지로 리다이렉트
          console.log('❌ Records page: No Supabase auth and no simple user login - redirecting to login');
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('❌ Records page: Error loading user info:', err);
        // 에러 발생시 로그인 페이지로 리다이렉트
        console.log('❌ Records page: Redirecting to login due to error');
        router.push('/auth/login');
      }
    };
    
    loadUserInfo();
  }, [router]);

  // 날짜/시간 검증 함수
  const validateDateTime = (startDate: string, startTime: string, endDate: string, endTime: string) => {
    if (!startDate || !endDate) return true; // 비어있으면 검증하지 않음

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 종료일이 시작일보다 이전인 경우
    if (end < start) {
      alert('⚠️ 사용 종료일이 시작일보다 이전일 수 없습니다.\n날짜를 다시 확인해주세요.');
      return false;
    }

    // 같은 날짜인 경우 시간 검증
    if (startDate === endDate && startTime && endTime) {
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      
      if (endHour < startHour) {
        alert('⚠️ 같은 날짜에서 종료 시간이 시작 시간보다 이전일 수 없습니다.\n시간을 다시 확인해주세요.');
        return false;
      }
    }

    return true;
  };

  const handleInputChange = (field: string, value: string) => {
    const newFormData = {
      ...formData,
      [field]: value
    };

    // 날짜나 시간 변경 시 검증
    if (field === 'startDate' || field === 'endDate' || field === 'startTime' || field === 'endTime') {
      const isValid = validateDateTime(
        newFormData.startDate,
        newFormData.startTime,
        newFormData.endDate,
        newFormData.endTime
      );
      
      if (!isValid) {
        // 검증 실패 시 이전 값으로 되돌림
        return;
      }
    }

    setFormData(newFormData);
  };

  // 폼 초기화 함수
  const resetForm = () => {
    setFormData({
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      vehicleNumber: userInfo.vehicleNumber,
      department: userInfo.department,
      driverName: userInfo.name,
      purpose: "",
      customPurpose: "",
      waypoint: "",
      destination: "",
      cumulativeDistance: "",
      fuelAmount: "",
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      // 필수 필드 검증 강화
      const missingFields = [];
      
      if (!formData.purpose.trim()) {
        missingFields.push("차량 사용 목적");
      }
      if (!formData.startDate) {
        missingFields.push("사용 시작일");
      }
      if (!formData.startTime) {
        missingFields.push("시작 시간");
      }
      if (!formData.endDate) {
        missingFields.push("사용 종료일");
      }
      if (!formData.endTime) {
        missingFields.push("종료 시간");
      }
      if (!formData.destination.trim()) {
        missingFields.push("최종 목적지");
      }
      if (!formData.cumulativeDistance.trim()) {
        missingFields.push("누적 주행거리");
      }
      
      if (missingFields.length > 0) {
        const missingMessage = `다음 필수 항목을 입력해주세요:\n\n${missingFields.map(field => `• ${field}`).join('\n')}`;
        alert(missingMessage);
        setError("필수 항목을 모두 입력해주세요.");
        return;
      }

      // 차량번호 검증 (기존 로직 유지)
      if (!formData.vehicleNumber) {
        alert("차량번호를 입력해주세요.");
        setError("차량번호를 입력해주세요.");
        return;
      }

      // 날짜/시간 검증
      if (!validateDateTime(formData.startDate, formData.startTime, formData.endDate, formData.endTime)) {
        setError("날짜 및 시간을 올바르게 설정해주세요.");
        return;
      }

      // 일반 사용자 vs 관리자 확인
      const simpleUser = localStorage.getItem('simplefleet_user');
      let userId = null;
      
      if (simpleUser) {
        // 일반 사용자의 경우 저장된 user_id 사용
        const userData = JSON.parse(simpleUser);
        userId = userData.user_id || userData.id || `simple_${userData.name}_${Date.now()}`;
      } else {
        // 관리자의 경우 Supabase 사용자 ID 사용
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          setError("사용자 인증에 실패했습니다. 다시 로그인해주세요.");
          return;
        }
        userId = user.id;
      }

      // 운행 기록 데이터 준비
      const drivingRecordData = {
        user_id: userId,
        start_date: formData.startDate,
        start_time: formData.startTime || null,
        end_date: formData.endDate,
        end_time: formData.endTime || null,
        vehicle_number: formData.vehicleNumber,
        department: formData.department,
        driver_name: formData.driverName,
        purpose: formData.purpose,
        destination: formData.destination,
        waypoint: formData.waypoint || null,
        cumulative_distance: formData.cumulativeDistance ? parseFloat(formData.cumulativeDistance) : null,
        fuel_amount: formData.fuelAmount ? parseFloat(formData.fuelAmount) : null,
      };

      // Supabase에 데이터 저장
      const { data, error: insertError } = await supabase
        .from('driving_records')
        .insert([drivingRecordData])
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        setError(`운행 기록 저장에 실패했습니다: ${insertError.message}`);
        return;
      }

      // 팝업창으로 성공 알림
      alert("✅ 운행 기록이 성공적으로 저장되었습니다!");
      
      setSuccess("운행 기록이 성공적으로 저장되었습니다!");
      
      // 폼 리셋 (사용자 정보는 유지)
      setFormData(prev => ({
        ...prev,
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        purpose: "",
        customPurpose: "",
        waypoint: "",
        destination: "",
        cumulativeDistance: "",
        fuelAmount: "",
      }));
      
      // 2초 후 내 차량 통계 페이지로 이동
      setTimeout(() => {
        router.push("/reports");
      }, 2000);

    } catch (err) {
      console.error('Unexpected error:', err);
      setError("예상치 못한 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">새 운행 기록</h1>
          <p className="text-gray-600">차량 운행 정보를 입력하세요</p>
        </div>
        
        <Button variant="outline" onClick={resetForm} type="button">
          취소
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 에러 및 성공 메시지 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}
        {/* 기본 정보 */}
        <Card>
          <CardContent className="space-y-4 pt-6">

            {/* 사용자 정보 먼저 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driverName">운전자 이름</Label>
                <Input
                  id="driverName"
                  type="text"
                  value={formData.driverName}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="department">소속 부서</Label>
                <Input
                  id="department"
                  type="text"
                  value={formData.department}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleNumber">차량번호</Label>
                {userInfo.availableVehicles.length > 0 ? (
                  <Select 
                    value={formData.vehicleNumber} 
                    onValueChange={(value) => handleInputChange("vehicleNumber", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="차량번호를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {userInfo.availableVehicles.map((vehicle) => (
                        <SelectItem key={vehicle} value={vehicle}>
                          {vehicle} {vehicle === userInfo.vehicleNumber ? "(주 차량)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="vehicleNumber"
                    type="text"
                    placeholder="차량번호를 입력하세요 (예: 12가1234)"
                    value={formData.vehicleNumber}
                    onChange={(e) => handleInputChange("vehicleNumber", e.target.value)}
                    required
                  />
                )}
                {userInfo.availableVehicles.length > 0 && (
                  <p className="text-xs text-gray-500">
                    주 차량번호: {userInfo.vehicleNumber}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="purpose">차량 사용 목적 *</Label>
                <Input
                  id="purpose"
                  type="text"
                  placeholder="사용 목적을 입력하세요 (예: 출장, 회의, 업무연락 등)"
                  value={formData.purpose}
                  onChange={(e) => handleInputChange("purpose", e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 구분선 */}
            <div className="border-t pt-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">사용 시작일 *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange("startDate", e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="startTime">시작 시간 *</Label>
                  <Select 
                    value={formData.startTime}
                    onValueChange={(value) => handleInputChange("startTime", value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="시간을 선택하세요 (필수)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 14 }, (_, i) => {
                        const hour = i + 7; // 7시부터 시작
                        return (
                          <SelectItem key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                            {hour.toString().padStart(2, '0')}:00
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="endDate">사용 종료일 *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange("endDate", e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endTime">종료 시간 *</Label>
                  <Select 
                    value={formData.endTime}
                    onValueChange={(value) => handleInputChange("endTime", value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="시간을 선택하세요 (필수)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 14 }, (_, i) => {
                        const hour = i + 7; // 7시부터 시작
                        return (
                          <SelectItem key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                            {hour.toString().padStart(2, '0')}:00
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">최종 목적지 *</Label>
              <Input
                id="destination"
                type="text"
                placeholder="최종 목적지를 입력하세요"
                value={formData.destination}
                onChange={(e) => handleInputChange("destination", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waypoint">경유지 (선택사항)</Label>
              <Input
                id="waypoint"
                type="text"
                placeholder="경유지가 있다면 입력하세요"
                value={formData.waypoint}
                onChange={(e) => handleInputChange("waypoint", e.target.value)}
              />
            </div>

            {/* 주행 거리 및 주유 정보 */}
            <div className="border-t pt-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cumulativeDistance">누적 주행거리 (km) *</Label>
                  <Input
                    id="cumulativeDistance"
                    type="number"
                    step="0.1"
                    placeholder="예: 15420.5"
                    value={formData.cumulativeDistance}
                    onChange={(e) => handleInputChange("cumulativeDistance", e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    계기판에 표시된 총 누적 주행거리를 입력하세요
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fuelAmount">주유량 (L) - 선택사항</Label>
                  <Input
                    id="fuelAmount"
                    type="number"
                    step="0.1"
                    placeholder="예: 45.2"
                    value={formData.fuelAmount}
                    onChange={(e) => handleInputChange("fuelAmount", e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    주유한 경우에만 입력하세요
                  </p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>


        {/* 저장 버튼 */}
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={resetForm}>
            취소
          </Button>
          <Button type="submit" disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? "저장 중..." : "운행 기록 저장"}
          </Button>
        </div>
      </form>
    </div>
  );
}