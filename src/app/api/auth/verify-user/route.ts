import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { name, department } = await request.json();
    
    if (!name || !department) {
      return NextResponse.json(
        { error: "이름과 부서가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // 서버에서 관리자 권한으로 drivers 테이블 조회
    const { data: driverData, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('name', name.trim())
      .eq('department', department)
      .single();

    if (error || !driverData) {
      return NextResponse.json(
        { error: "입력한 이름과 소속 부서 정보가 등록된 정보와 일치하지 않습니다." },
        { status: 404 }
      );
    }

    // 민감한 정보 제외하고 필요한 정보만 반환
    return NextResponse.json({
      success: true,
      user: {
        id: driverData.id,
        user_id: driverData.user_id,
        name: driverData.name,
        department: driverData.department,
        vehicleNumber: driverData.main_vehicle_number || "미설정"
      }
    });

  } catch (error) {
    console.error('Verify user error:', error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}