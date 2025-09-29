"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Download, 
  Calendar,
  MapPin,
  User,
  Car,
  Fuel,
  Plus
} from "lucide-react";
import Link from "next/link";

const mockRecords = [
  {
    id: 1,
    date: "2024-09-04",
    driver: "홍길동",
    department: "총무팀",
    purpose: "출장",
    destination: "시청",
    waypoint: "우체국",
    duration: 2.5,
    distance: 45.2,
    cumulativeDistance: 12450.8,
    fuel: 30.2,
    status: "완료",
  },
  {
    id: 2,
    date: "2024-09-03",
    driver: "김영희",
    department: "기획팀",
    purpose: "회의",
    destination: "구청",
    waypoint: "",
    duration: 1.8,
    distance: 32.8,
    cumulativeDistance: 12405.6,
    fuel: 0,
    status: "완료",
  },
  {
    id: 3,
    date: "2024-09-03",
    driver: "이철수",
    department: "개발팀",
    purpose: "업무연락",
    destination: "법원",
    waypoint: "시장",
    duration: 3.2,
    distance: 28.5,
    cumulativeDistance: 12372.8,
    fuel: 25.8,
    status: "완료",
  },
  {
    id: 4,
    date: "2024-09-02",
    driver: "박민수",
    department: "영업팀",
    purpose: "출장",
    destination: "공장",
    waypoint: "",
    duration: 4.5,
    distance: 68.3,
    cumulativeDistance: 12344.3,
    fuel: 40.5,
    status: "완료",
  },
  {
    id: 5,
    date: "2024-09-01",
    driver: "정수현",
    department: "총무팀",
    purpose: "기타",
    destination: "병원",
    waypoint: "약국",
    duration: 1.2,
    distance: 15.6,
    cumulativeDistance: 12276.0,
    fuel: 0,
    status: "완료",
  },
];

export default function RecordsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredRecords = mockRecords.filter((record) => {
    const matchesSearch = 
      record.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.waypoint.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = !selectedDepartment || record.department === selectedDepartment;
    const matchesPurpose = !selectedPurpose || record.purpose === selectedPurpose;
    
    const matchesDateRange = 
      (!dateFrom || record.date >= dateFrom) &&
      (!dateTo || record.date <= dateTo);

    return matchesSearch && matchesDepartment && matchesPurpose && matchesDateRange;
  });

  const handleExport = () => {
    // TODO: Excel 내보내기 로직 구현
    console.log("Exporting to Excel...");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">운행 기록 조회</h1>
          <p className="text-gray-600">등록된 모든 운행 기록을 조회하고 관리하세요</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Excel 다운로드
          </Button>
          <Link href="/records/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              새 기록 추가
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            검색 및 필터
          </CardTitle>
          <CardDescription>조건을 선택하여 원하는 기록을 찾으세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">검색</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="운전자, 목적지 검색"
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>부서</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="전체 부서" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체 부서</SelectItem>
                  <SelectItem value="총무팀">총무팀</SelectItem>
                  <SelectItem value="기획팀">기획팀</SelectItem>
                  <SelectItem value="개발팀">개발팀</SelectItem>
                  <SelectItem value="영업팀">영업팀</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>사용 목적</Label>
              <Select value={selectedPurpose} onValueChange={setSelectedPurpose}>
                <SelectTrigger>
                  <SelectValue placeholder="전체 목적" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체 목적</SelectItem>
                  <SelectItem value="출장">출장</SelectItem>
                  <SelectItem value="회의">회의</SelectItem>
                  <SelectItem value="업무연락">업무연락</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dateFrom">시작일</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dateTo">종료일</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSelectedDepartment("");
                setSelectedPurpose("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              필터 초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 기록 수</p>
                <p className="text-2xl font-bold">{filteredRecords.length}건</p>
              </div>
              <Car className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 거리</p>
                <p className="text-2xl font-bold">
                  {filteredRecords.reduce((sum, record) => sum + record.distance, 0).toFixed(1)}km
                </p>
              </div>
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 주유량</p>
                <p className="text-2xl font-bold">
                  {filteredRecords.reduce((sum, record) => sum + record.fuel, 0).toFixed(1)}L
                </p>
              </div>
              <Fuel className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">운전자 수</p>
                <p className="text-2xl font-bold">
                  {new Set(filteredRecords.map(record => record.driver)).size}명
                </p>
              </div>
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>운행 기록 목록</CardTitle>
          <CardDescription>
            {filteredRecords.length}건의 기록이 검색되었습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead>운전자</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>목적</TableHead>
                  <TableHead>목적지</TableHead>
                  <TableHead>경유지</TableHead>
                  <TableHead>시간</TableHead>
                  <TableHead>거리</TableHead>
                  <TableHead>누적거리</TableHead>
                  <TableHead>주유량</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{record.date}</span>
                      </div>
                    </TableCell>
                    <TableCell>{record.driver}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{record.department}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.purpose}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{record.destination}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.waypoint || "-"}
                    </TableCell>
                    <TableCell>{record.duration}시간</TableCell>
                    <TableCell className="font-medium">{record.distance}km</TableCell>
                    <TableCell>{record.cumulativeDistance.toLocaleString()}km</TableCell>
                    <TableCell>
                      {record.fuel > 0 ? (
                        <div className="flex items-center space-x-1">
                          <Fuel className="w-4 h-4 text-blue-500" />
                          <span>{record.fuel}L</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{record.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8">
              <Car className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">조건에 맞는 운행 기록이 없습니다.</p>
              <Link href="/records/new" className="mt-2 inline-block">
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  첫 번째 기록 추가하기
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}