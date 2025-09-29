import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Car, 
  MapPin, 
  Clock, 
  Fuel, 
  TrendingUp,
  Plus,
  Calendar,
  BarChart3
} from "lucide-react";
import Link from "next/link";

const mockRecentRecords = [
  {
    id: 1,
    date: "2024-09-04",
    driver: "홍길동",
    destination: "시청",
    distance: "45.2km",
    status: "완료",
  },
  {
    id: 2,
    date: "2024-09-03",
    driver: "김영희",
    destination: "구청",
    distance: "32.8km", 
    status: "완료",
  },
  {
    id: 3,
    date: "2024-09-03",
    driver: "이철수",
    destination: "법원",
    distance: "28.5km",
    status: "완료",
  },
];

const monthlyStats = {
  totalDistance: "1,245.8km",
  totalTrips: 42,
  totalFuel: "125.4L",
  averageEfficiency: "9.9km/L",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-600">관용차 운행 현황을 한눈에 확인하세요</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/records/new">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              새 운행 기록
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline" className="w-full sm:w-auto">
              <BarChart3 className="w-4 h-4 mr-2" />
              통계 보기
            </Button>
          </Link>
        </div>
      </div>

      {/* Monthly Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 운행 거리</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.totalDistance}</div>
            <p className="text-xs text-muted-foreground">
              이번 달 누적
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 운행 횟수</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.totalTrips}회</div>
            <p className="text-xs text-muted-foreground">
              이번 달 누적
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 주유량</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.totalFuel}</div>
            <p className="text-xs text-muted-foreground">
              이번 달 누적
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 연비</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.averageEfficiency}</div>
            <p className="text-xs text-muted-foreground">
              이번 달 평균
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            빠른 작업
          </CardTitle>
          <CardDescription>자주 사용하는 기능들에 빠르게 접근하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/records/new" className="block">
              <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="flex items-center p-4">
                  <Plus className="w-8 h-8 text-primary mr-3" />
                  <div>
                    <h3 className="font-medium">운행 기록 추가</h3>
                    <p className="text-sm text-gray-600">새로운 운행 기록</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/records" className="block">
              <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="flex items-center p-4">
                  <Calendar className="w-8 h-8 text-primary mr-3" />
                  <div>
                    <h3 className="font-medium">기록 조회</h3>
                    <p className="text-sm text-gray-600">운행 이력 확인</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/reports" className="block">
              <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="flex items-center p-4">
                  <BarChart3 className="w-8 h-8 text-primary mr-3" />
                  <div>
                    <h3 className="font-medium">통계 리포트</h3>
                    <p className="text-sm text-gray-600">상세 분석</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin" className="block">
              <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="flex items-center p-4">
                  <Car className="w-8 h-8 text-primary mr-3" />
                  <div>
                    <h3 className="font-medium">관리 설정</h3>
                    <p className="text-sm text-gray-600">마스터 관리</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Records */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>최근 운행 기록</CardTitle>
            <CardDescription>최근 등록된 운행 기록들을 확인하세요</CardDescription>
          </div>
          <Link href="/records">
            <Button variant="outline" size="sm">
              전체 보기
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockRecentRecords.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{record.driver}</p>
                    <p className="text-sm text-gray-600">{record.destination}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-600">{record.date}</span>
                  <span className="font-medium">{record.distance}</span>
                  <Badge variant="secondary">{record.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}