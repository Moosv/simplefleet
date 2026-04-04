"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  FileSpreadsheet,
  Clock,
  Route,
  Edit,
  Trash2,
  Users,
  Fuel,
  MapPin,
  TrendingUp,
  Building2,
  Target,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── 타입 정의 ─────────────────────────────────────────────

interface VehicleData {
  vehicleNumber: string;
  department?: string;
  driverName?: string;
  totalDistance: number;
  totalTrips: number;
  totalFuel: number;
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

// ─── 차트 컴포넌트 ──────────────────────────────────────────

interface BarItem {
  label: string;
  value: number;
  subValue?: number;
  subLabel?: string;
}

function SimpleBarChart({
  data,
  color = "bg-blue-500",
  subColor = "bg-orange-400",
  subLabel,
  unit = "회",
  maxHeight = 160,
}: {
  data: BarItem[];
  color?: string;
  subColor?: string;
  subLabel?: string;
  unit?: string;
  maxHeight?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        데이터 없음
      </div>
    );
  }
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const maxSub = subLabel ? Math.max(...data.map((d) => d.subValue ?? 0), 1) : 1;

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-2 min-w-max pb-2" style={{ minHeight: maxHeight + 60 }}>
        {data.map((item, i) => (
          <div key={i} className="flex flex-col items-center" style={{ minWidth: 56 }}>
            <span className="text-xs font-semibold text-gray-700 mb-1">
              {item.value}{unit}
            </span>
            <div className="flex items-end gap-0.5" style={{ height: maxHeight }}>
              <div
                className={`w-6 ${color} rounded-t-sm`}
                style={{ height: `${(item.value / maxValue) * maxHeight}px` }}
              />
              {subLabel && item.subValue !== undefined && (
                <div
                  className={`w-6 ${subColor} rounded-t-sm`}
                  style={{ height: `${(item.subValue / maxSub) * maxHeight}px` }}
                  title={`${subLabel}: ${item.subValue.toFixed(1)}`}
                />
              )}
            </div>
            <span
              className="text-xs text-gray-500 mt-1 text-center leading-tight"
              style={{ maxWidth: 64, wordBreak: "break-all" }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
      {subLabel && (
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm ${color}`} /> {unit === "회" ? "건수" : "거리"}
          </span>
          <span className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm ${subColor}`} /> {subLabel}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export default function ReportsPage() {
  const [selectedVehicle, setSelectedVehicle] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");

  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [registeredVehicles, setRegisteredVehicles] = useState<RegisteredVehicle[]>([]);
  const [drivingRecords, setDrivingRecords] = useState<DrivingRecord[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<SimpleUser | null>(null);
  const [userVehicle, setUserVehicle] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [editingRecord, setEditingRecord] = useState<DrivingRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<DrivingRecord | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});

  const supabase = createClient();

  // ─── 사용자 로드 ───────────────────────────────────────────

  const loadCurrentUser = useCallback(async () => {
    try {
      const simpleUser = localStorage.getItem("simplefleet_user");
      if (simpleUser) {
        const userData = JSON.parse(simpleUser);
        if (userData.type === "user") {
          setCurrentUser({ type: "simple_user", name: userData.name, vehicleNumber: userData.vehicleNumber });
          setUserVehicle(userData.vehicleNumber);
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const adminCheck =
          user.email === "master@korea.kr" ||
          user.user_metadata?.role === "admin" ||
          user.user_metadata?.role === "master_admin" ||
          user.raw_user_meta_data?.role === "admin" ||
          user.raw_user_meta_data?.role === "master_admin" ||
          user.email?.includes("admin");

        setIsAdmin(adminCheck);

        if (adminCheck) {
          setCurrentUser({ type: "admin", email: user.email, role: user.user_metadata?.role || user.raw_user_meta_data?.role });
        } else {
          const { data: driverData } = await supabase
            .from("drivers")
            .select("main_vehicle_number")
            .eq("user_id", user.id)
            .single();
          setCurrentUser({ type: "regular_user", email: user.email, vehicleNumber: driverData?.main_vehicle_number });
          setUserVehicle(driverData?.main_vehicle_number);
        }
      }
    } catch (err) {
      console.error("Error loading current user:", err);
    }
  }, [supabase]);

  // ─── 차량 목록 로드 ────────────────────────────────────────

  const loadRegisteredVehicles = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from("drivers")
        .select("main_vehicle_number, department, name")
        .not("main_vehicle_number", "is", null)
        .not("main_vehicle_number", "eq", "")
        .order("main_vehicle_number");

      if (err) { setError("차량 목록을 불러오는데 실패했습니다."); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let uniqueVehicles = data.reduce((acc: VehicleData[], curr: any) => {
        if (!acc.find((v) => v.vehicleNumber === curr.main_vehicle_number)) {
          acc.push({
            vehicleNumber: curr.main_vehicle_number,
            department: curr.department || "미설정",
            driverName: curr.name,
            totalDistance: 0,
            totalTrips: 0,
            totalFuel: 0,
          });
        }
        return acc;
      }, []);

      if (currentUser && (currentUser.type === "simple_user" || currentUser.type === "regular_user")) {
        if (userVehicle && userVehicle !== "미설정") {
          uniqueVehicles = uniqueVehicles.filter((v: VehicleData) => v.vehicleNumber === userVehicle);
          if (uniqueVehicles.length > 0 && selectedVehicle === "all") {
            setSelectedVehicle(uniqueVehicles[0].vehicleNumber);
          }
        } else {
          uniqueVehicles = [];
        }
      }

      setRegisteredVehicles(uniqueVehicles);
    } catch (err) {
      console.error("Error:", err);
      setError("차량 목록을 불러오는데 실패했습니다.");
    }
  }, [currentUser, userVehicle, selectedVehicle, supabase]);

  // ─── 사용 가능한 연도 로드 ─────────────────────────────────

  const loadAvailableYears = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from("driving_records")
        .select("start_date")
        .order("start_date", { ascending: false });

      if (err && err.code !== "PGRST116") { setAvailableYears([]); return; }

      if (data && data.length > 0) {
        const years = ([...new Set(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map((r: any) => new Date(r.start_date).getFullYear().toString())
        )] as string[]).sort((a, b) => parseInt(b) - parseInt(a));
        setAvailableYears(years);
      } else {
        setAvailableYears([]);
      }
    } catch {
      setAvailableYears([]);
    }
  }, [supabase]);

  // ─── 운행 기록 로드 ────────────────────────────────────────

  const loadDrivingRecords = useCallback(async () => {
    try {
      let query = supabase.from("driving_records").select("*");

      // 연도 필터
      if (selectedYear !== "all") {
        if (selectedMonth !== "all") {
          // 특정 연도 + 특정 월
          const monthPadded = selectedMonth.padStart(2, "0");
          const nextMonthYear = parseInt(selectedMonth) === 12 ? parseInt(selectedYear) + 1 : parseInt(selectedYear);
          const nextMonth = parseInt(selectedMonth) === 12 ? "01" : String(parseInt(selectedMonth) + 1).padStart(2, "0");
          query = query
            .gte("start_date", `${selectedYear}-${monthPadded}-01`)
            .lt("start_date", `${nextMonthYear}-${nextMonth}-01`);
        } else {
          // 특정 연도 전체
          query = query
            .gte("start_date", `${selectedYear}-01-01`)
            .lt("start_date", `${parseInt(selectedYear) + 1}-01-01`);
        }
      }
      // selectedYear === "all" → 날짜 필터 없음 (전체 기간)

      // 일반 사용자는 본인 차량만
      if (currentUser && (currentUser.type === "simple_user" || currentUser.type === "regular_user")) {
        if (userVehicle && userVehicle !== "미설정") {
          query = query.eq("vehicle_number", userVehicle);
        } else {
          setDrivingRecords([]);
          return;
        }
      }

      const { data, error: err } = await query.order("start_date", { ascending: true });
      if (err && err.code !== "PGRST116") { setError("운행 기록을 불러오는데 실패했습니다."); return; }
      setDrivingRecords(data || []);
    } catch {
      setDrivingRecords([]);
    }
  }, [selectedYear, selectedMonth, currentUser, userVehicle, supabase]);

  // ─── 시간 차이 계산 ────────────────────────────────────────

  const calculateTimeDifference = (
    startDate: string,
    startTime?: string,
    endDate?: string,
    endTime?: string
  ) => {
    if (!startDate || !endDate) return "-";
    const start = new Date(`${startDate}T${startTime || "00:00"}:00`);
    const end = new Date(`${endDate}T${endTime || "23:59"}:59`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-";
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return "-";
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours >= 24) {
      const days = Math.floor(diffHours / 24);
      const rem = diffHours % 24;
      return `${days}일 ${rem}시간${diffMinutes > 0 ? ` ${diffMinutes}분` : ""}`;
    }
    return `${diffHours}시간${diffMinutes > 0 ? ` ${diffMinutes}분` : ""}`;
  };

  // ─── 주행거리 계산 ─────────────────────────────────────────

  const calculateTripDistance = (record: DrivingRecord, allRecords: DrivingRecord[]) => {
    const sameVehicle = allRecords
      .filter((r) => r.vehicle_number === record.vehicle_number)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    const idx = sameVehicle.findIndex((r) => r.id === record.id);
    if (idx > 0 && record.cumulative_distance && sameVehicle[idx - 1].cumulative_distance) {
      const dist = record.cumulative_distance - (sameVehicle[idx - 1].cumulative_distance ?? 0);
      return dist > 0 ? dist.toFixed(1) : "-";
    }
    return record.cumulative_distance ? "추정 불가" : "-";
  };

  // ─── 차량별 통계 계산 ──────────────────────────────────────

  const calculateVehicleStats = useCallback(() => {
    const stats = registeredVehicles.map((vehicle) => {
      const vehicleRecords = drivingRecords.filter((r) => r.vehicle_number === vehicle.vehicleNumber);
      const distances = vehicleRecords
        .map((r) => r.cumulative_distance)
        .filter((d): d is number => d !== undefined && d > 0)
        .sort((a, b) => a - b);
      const totalDistance = distances.length > 1 ? Math.round(distances[distances.length - 1] - distances[0]) : distances[0] || 0;
      return {
        vehicleNumber: vehicle.vehicleNumber,
        department: vehicle.department,
        totalDistance,
        totalTrips: vehicleRecords.length,
        totalFuel: vehicleRecords.reduce((s, r) => s + (r.fuel_amount || 0), 0),
      };
    });
    setVehicleData(stats);
    setIsLoading(false);
  }, [registeredVehicles, drivingRecords]);

  // ─── 수정 / 삭제 핸들러 ────────────────────────────────────

  const handleEditRecord = (record: DrivingRecord) => {
    setEditingRecord(record);
    setEditFormData({
      startDate: record.start_date,
      startTime: record.start_time || "",
      endDate: record.end_date,
      endTime: record.end_time || "",
      vehicleNumber: record.vehicle_number,
      department: record.department,
      driverName: record.driver_name,
      purpose: record.purpose,
      destination: record.destination,
      waypoint: record.waypoint || "",
      cumulativeDistance: record.cumulative_distance?.toString() || "",
      fuelAmount: record.fuel_amount?.toString() || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    try {
      const { error: err } = await supabase
        .from("driving_records")
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
        .eq("id", editingRecord.id);
      if (err) { alert(`수정 실패: ${err.message}`); return; }
      alert("✅ 운행 기록이 성공적으로 수정되었습니다!");
      setIsEditDialogOpen(false);
      setEditingRecord(null);
      loadDrivingRecords();
    } catch { alert("수정 중 오류가 발생했습니다."); }
  };

  const handleDeleteRecord = (record: DrivingRecord) => {
    setRecordToDelete(record);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      const { error: err } = await supabase.from("driving_records").delete().eq("id", recordToDelete.id);
      if (err) { alert(`삭제 실패: ${err.message}`); return; }
      alert("✅ 운행 기록이 성공적으로 삭제되었습니다!");
      setIsDeleteDialogOpen(false);
      setRecordToDelete(null);
      loadDrivingRecords();
    } catch { alert("삭제 중 오류가 발생했습니다."); }
  };

  // ─── Effects ───────────────────────────────────────────────

  useEffect(() => {
    loadCurrentUser();
    loadAvailableYears();
  }, [loadCurrentUser, loadAvailableYears]);

  useEffect(() => {
    if (currentUser !== null) loadRegisteredVehicles();
  }, [currentUser, userVehicle, loadRegisteredVehicles]);

  useEffect(() => {
    if (currentUser !== null) loadDrivingRecords();
  }, [selectedYear, selectedMonth, currentUser, userVehicle, loadDrivingRecords]);

  useEffect(() => {
    if (registeredVehicles.length > 0) calculateVehicleStats();
    else if (currentUser !== null) setIsLoading(false);
  }, [registeredVehicles, drivingRecords, calculateVehicleStats, currentUser]);

  // 연도가 "all"로 바뀌면 월도 "all"로 초기화
  useEffect(() => {
    if (selectedYear === "all") setSelectedMonth("all");
  }, [selectedYear]);

  // ─── 집계 통계 (렌더 시 계산) ──────────────────────────────

  const selectedVehicleData = selectedVehicle === "all" ? null : vehicleData.find((v) => v.vehicleNumber === selectedVehicle);

  const filteredRecords = selectedVehicle === "all"
    ? drivingRecords
    : drivingRecords.filter((r) => r.vehicle_number === selectedVehicle);

  const totalTrips = filteredRecords.length;
  const totalFuel = filteredRecords.reduce((s, r) => s + (r.fuel_amount || 0), 0);
  const totalDistance = selectedVehicleData
    ? selectedVehicleData.totalDistance
    : vehicleData.reduce((s, v) => s + v.totalDistance, 0);
  const avgEfficiency = totalFuel > 0 ? (totalDistance / totalFuel).toFixed(1) : "-";

  // 부서(실)별 통계
  const deptStats: BarItem[] = Object.entries(
    filteredRecords.reduce((acc, r) => {
      const dept = r.department || "미설정";
      if (!acc[dept]) acc[dept] = { trips: 0, fuel: 0 };
      acc[dept].trips++;
      acc[dept].fuel += r.fuel_amount || 0;
      return acc;
    }, {} as Record<string, { trips: number; fuel: number }>)
  )
    .map(([dept, s]) => ({ label: dept, value: s.trips, subValue: s.fuel, subLabel: "주유(L)" }))
    .sort((a, b) => b.value - a.value);

  // 용무별 통계
  const purposeStats: BarItem[] = Object.entries(
    filteredRecords.reduce((acc, r) => {
      const purpose = r.purpose || "기타";
      acc[purpose] = (acc[purpose] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )
    .map(([purpose, count]) => ({ label: purpose, value: count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // 운전자별 통계
  const driverStats: BarItem[] = Object.entries(
    filteredRecords.reduce((acc, r) => {
      const driver = r.driver_name || "미설정";
      if (!acc[driver]) acc[driver] = { trips: 0, fuel: 0 };
      acc[driver].trips++;
      acc[driver].fuel += r.fuel_amount || 0;
      return acc;
    }, {} as Record<string, { trips: number; fuel: number }>)
  )
    .map(([driver, s]) => ({ label: driver, value: s.trips, subValue: s.fuel, subLabel: "주유(L)" }))
    .sort((a, b) => b.value - a.value);

  // ─── 조회 기간 레이블 ───────────────────────────────────────

  const periodLabel = selectedYear === "all"
    ? "전체 기간"
    : selectedMonth === "all"
      ? `${selectedYear}년`
      : `${selectedYear}년 ${selectedMonth}월`;

  // ─── 로딩 ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">통계 데이터를 불러오고 있습니다...</p>
        </div>
      </div>
    );
  }

  // ─── 렌더 ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">통계 리포트</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? "전체 차량 운행 현황을 분석하세요" : "내 차량 운행 현황을 확인하세요"}
            {" · "}
            <span className="font-medium text-primary">{periodLabel}</span>
          </p>
        </div>
      </div>

      {/* ── 조회 기간 / 차량 선택 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> 조회 조건
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* 연도 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">연도</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 기간</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}년</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 월 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">월</label>
              <Select
                value={selectedMonth}
                onValueChange={setSelectedMonth}
                disabled={selectedYear === "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="전체 기간" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 ({selectedYear === "all" ? "전체" : selectedYear}년)</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 차량 (관리자 전용) */}
            {isAdmin && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">차량</label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 차량</SelectItem>
                    {registeredVehicles.map((v) => (
                      <SelectItem key={v.vehicleNumber} value={v.vehicleNumber}>
                        {v.vehicleNumber} ({v.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 일반 사용자 차량 표시 */}
            {!isAdmin && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">내 차량</label>
                <div className="flex items-center p-2.5 border border-gray-200 rounded-md bg-gray-50">
                  <Car className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="font-medium text-sm">
                    {userVehicle && userVehicle !== "미설정" ? userVehicle : "차량 미배정"}
                  </span>
                  {registeredVehicles.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">내 차량</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 요약 카드 4개 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">총 운행 횟수</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalTrips}회</div>
            <p className="text-xs text-muted-foreground">{periodLabel} 누적</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">총 주행거리</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalDistance.toLocaleString()}km</div>
            <p className="text-xs text-muted-foreground">누적 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">총 주유량</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{totalFuel.toFixed(1)}L</div>
            <p className="text-xs text-muted-foreground">{periodLabel} 합계</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">평균 연비</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {avgEfficiency === "-" ? "-" : `${avgEfficiency}km/L`}
            </div>
            <p className="text-xs text-muted-foreground">주행거리 / 주유량</p>
          </CardContent>
        </Card>
      </div>

      {/* ── 관리자 전용: 종합 차트 섹션 ── */}
      {isAdmin && filteredRecords.length > 0 && (
        <>
          {/* 실별 운행 현황 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="w-4 h-4" /> 실별 운행 현황
                </CardTitle>
                <CardDescription>부서(연구실)별 운행 건수 및 주유량</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleBarChart
                  data={deptStats}
                  color="bg-pink-500"
                  subColor="bg-purple-400"
                  subLabel="주유(L)"
                  unit="회"
                />
                {/* 상세 테이블 */}
                <div className="mt-4 space-y-2">
                  {deptStats.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-pink-500" />
                        <span className="text-gray-700 font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-gray-500">
                        <span>{item.value}건</span>
                        <span className="text-xs text-purple-500">{(item.subValue ?? 0).toFixed(1)}L</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 용무별 운행 횟수 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="w-4 h-4" /> 용무별 운행 횟수
                </CardTitle>
                <CardDescription>사용 목적별 운행 건수</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleBarChart
                  data={purposeStats}
                  color="bg-blue-500"
                  unit="회"
                />
                <div className="mt-4 space-y-2">
                  {purposeStats.map((item, i) => {
                    const pct = Math.round((item.value / (purposeStats[0]?.value || 1)) * 100);
                    return (
                      <div key={i} className="space-y-0.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700 truncate max-w-[200px]">{item.label}</span>
                          <span className="text-gray-500 ml-2">{item.value}건</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 운전자별 운행 현황 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4" /> 운전자별 운행 현황
              </CardTitle>
              <CardDescription>운전자별 운행 건수 및 주유량 비교</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                data={driverStats}
                color="bg-teal-500"
                subColor="bg-orange-400"
                subLabel="주유(L)"
                unit="회"
              />
              {/* 운전자 상세 */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left py-2 font-medium">운전자</th>
                      <th className="text-right py-2 font-medium">운행 횟수</th>
                      <th className="text-right py-2 font-medium">주유량(L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverStats.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 font-medium">{item.label}</td>
                        <td className="py-2 text-right text-blue-600 font-semibold">{item.value}회</td>
                        <td className="py-2 text-right text-orange-500">{(item.subValue ?? 0).toFixed(1)}L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── 차량별 운행 비교 (전체 선택 시) ── */}
      {selectedVehicle === "all" && vehicleData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" /> 차량별 운행 현황
            </CardTitle>
            <CardDescription>등록된 차량의 운행 현황 비교</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <div className="space-y-4">
              {vehicleData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">등록된 차량이 없습니다.</div>
              ) : (
                vehicleData.map((vehicle) => {
                  const maxDistance = Math.max(...vehicleData.map((v) => v.totalDistance), 1);
                  const pct = (vehicle.totalDistance / maxDistance) * 100;
                  return (
                    <div key={vehicle.vehicleNumber} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">{vehicle.vehicleNumber}</Badge>
                          <span className="text-sm text-muted-foreground">{vehicle.totalTrips}회 운행</span>
                          <span className="text-xs text-gray-400">({vehicle.department})</span>
                        </div>
                        <div className="text-sm font-medium">{vehicle.totalDistance.toLocaleString()}km</div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 상세 운행 기록 테이블 ── */}
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
            {" · "}
            {periodLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="min-w-[50px] font-bold text-center">순서</TableHead>
                  <TableHead className="min-w-[100px] font-bold">차량번호</TableHead>
                  <TableHead className="min-w-[120px] font-bold">소속 부서</TableHead>
                  <TableHead className="min-w-[100px] font-bold">운전자</TableHead>
                  <TableHead className="min-w-[150px] font-bold">사용 목적</TableHead>
                  <TableHead className="min-w-[150px] font-bold">사용 시작일시</TableHead>
                  <TableHead className="min-w-[150px] font-bold">사용 종료일시</TableHead>
                  <TableHead className="min-w-[100px] font-bold">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> 사용시간</div>
                  </TableHead>
                  <TableHead className="min-w-[120px] font-bold">최종 목적지</TableHead>
                  <TableHead className="min-w-[90px] font-bold">경유지</TableHead>
                  <TableHead className="min-w-[80px] font-bold">
                    <div className="flex items-center gap-1"><Route className="w-3 h-3" /> 주행(km)</div>
                  </TableHead>
                  <TableHead className="min-w-[110px] font-bold">누적(km)</TableHead>
                  <TableHead className="min-w-[80px] font-bold">주유(L)</TableHead>
                  {isAdmin && <TableHead className="min-w-[80px] font-bold text-center">작업</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 14 : 13} className="text-center py-8 text-gray-500">
                      {selectedVehicleData
                        ? `${selectedVehicleData.vehicleNumber} 차량의 운행 기록이 없습니다.`
                        : `${periodLabel}에 운행 기록이 없습니다.`
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record, index) => (
                    <TableRow key={record.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-center text-gray-500">{index + 1}</TableCell>
                      <TableCell className="font-medium text-center">{record.vehicle_number}</TableCell>
                      <TableCell>{record.department || "미설정"}</TableCell>
                      <TableCell>{record.driver_name}</TableCell>
                      <TableCell>{record.purpose}</TableCell>
                      <TableCell>{record.start_date} {record.start_time || ""}</TableCell>
                      <TableCell>{record.end_date} {record.end_time || ""}</TableCell>
                      <TableCell className="text-center font-medium text-blue-600">
                        {calculateTimeDifference(record.start_date, record.start_time, record.end_date, record.end_time)}
                      </TableCell>
                      <TableCell>{record.destination}</TableCell>
                      <TableCell className="text-gray-400">{record.waypoint || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {calculateTripDistance(record, drivingRecords)}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.cumulative_distance ? record.cumulative_distance.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.fuel_amount ? record.fuel_amount.toFixed(1) : "-"}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-center">
                          <div className="flex justify-center space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditRecord(record)} className="h-7 w-7 p-0" title="수정">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteRecord(record)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" title="삭제">
                              <Trash2 className="h-3.5 w-3.5" />
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

          {/* 테이블 요약 */}
          {filteredRecords.length > 0 && (
            <div className="mt-4 pt-4 border-t bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-gray-600">총 운행 건수</div>
                  <div className="text-lg font-bold text-blue-600">{filteredRecords.length}건</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-600">총 주유량</div>
                  <div className="text-lg font-bold text-green-600">{totalFuel.toFixed(1)}L</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-600">최대 누적거리</div>
                  <div className="text-lg font-bold text-orange-500">
                    {Math.max(...filteredRecords.map((r) => r.cumulative_distance || 0), 0).toLocaleString()}km
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-600">최근 운행일</div>
                  <div className="text-lg font-bold text-purple-600">
                    {filteredRecords.length > 0
                      ? new Date(Math.max(...filteredRecords.map((r) => new Date(r.start_date).getTime()))).toLocaleDateString("ko-KR")
                      : "-"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 수정 다이얼로그 ── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>운행 기록 수정</DialogTitle>
            <DialogDescription>운행 기록 정보를 수정하세요.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>사용 시작일 *</Label>
              <Input type="date" value={editFormData.startDate || ""} onChange={(e) => setEditFormData((p) => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>시작 시간 *</Label>
              <Input type="time" value={editFormData.startTime || ""} onChange={(e) => setEditFormData((p) => ({ ...p, startTime: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>사용 종료일 *</Label>
              <Input type="date" value={editFormData.endDate || ""} onChange={(e) => setEditFormData((p) => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>종료 시간 *</Label>
              <Input type="time" value={editFormData.endTime || ""} onChange={(e) => setEditFormData((p) => ({ ...p, endTime: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>차량번호 *</Label>
              <Input value={editFormData.vehicleNumber || ""} onChange={(e) => setEditFormData((p) => ({ ...p, vehicleNumber: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>운전자 이름 *</Label>
              <Input value={editFormData.driverName || ""} onChange={(e) => setEditFormData((p) => ({ ...p, driverName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>사용 목적 *</Label>
              <Input value={editFormData.purpose || ""} onChange={(e) => setEditFormData((p) => ({ ...p, purpose: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>최종 목적지 *</Label>
              <Input value={editFormData.destination || ""} onChange={(e) => setEditFormData((p) => ({ ...p, destination: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>경유지</Label>
              <Input value={editFormData.waypoint || ""} onChange={(e) => setEditFormData((p) => ({ ...p, waypoint: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>소속 부서</Label>
              <Input value={editFormData.department || ""} onChange={(e) => setEditFormData((p) => ({ ...p, department: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>누적 주행거리 (km) *</Label>
              <Input type="number" step="0.1" value={editFormData.cumulativeDistance || ""} onChange={(e) => setEditFormData((p) => ({ ...p, cumulativeDistance: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>주유량 (L)</Label>
              <Input type="number" step="0.1" value={editFormData.fuelAmount || ""} onChange={(e) => setEditFormData((p) => ({ ...p, fuelAmount: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>취소</Button>
            <Button onClick={handleSaveEdit}>운행 기록 수정</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 삭제 확인 다이얼로그 ── */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>운행 기록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 운행 기록을 삭제하시겠습니까?
              <br /><br />
              <strong>차량번호:</strong> {recordToDelete?.vehicle_number}<br />
              <strong>운전자:</strong> {recordToDelete?.driver_name}<br />
              <strong>사용일:</strong> {recordToDelete?.start_date}<br /><br />
              삭제된 데이터는 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
