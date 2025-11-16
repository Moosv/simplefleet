import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 서버에서 관리자 권한으로 부서 목록 조회
    const { data, error } = await supabase
      .from('drivers')
      .select('department')
      .not('department', 'is', null)
      .not('department', 'eq', '');

    if (error) {
      console.error('Error loading departments:', error);
      return NextResponse.json(
        { error: "부서 목록을 불러오는데 실패했습니다." },
        { status: 500 }
      );
    }

    // 중복 제거하여 부서 목록 생성
    const uniqueDepartments = [...new Set(data.map(item => item.department))].sort();
    
    return NextResponse.json({
      success: true,
      departments: uniqueDepartments
    });

  } catch (error) {
    console.error('Departments API error:', error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}