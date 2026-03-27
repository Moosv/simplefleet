import { supabase } from '@/lib/supabase'

/**
 * 해당 차량의 지정 날짜 이전 누적 주행거리를 조회하여 당일 주행거리를 계산
 * @param vehicleId      차량 UUID
 * @param currentOdometer 현재 입력한 누적 주행거리
 * @param excludeRecordId 수정 시 본인 레코드 제외용
 * @param usageDate       기록 날짜 (YYYY-MM-DD) — 이 날짜 이하의 기록과 비교
 */
export async function calcDistanceTraveled(
  vehicleId: string,
  currentOdometer: number,
  excludeRecordId?: string,
  usageDate?: string,
): Promise<{ distance: number | null; prevOdometer: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_prev_odometer_by_date', {
    p_vehicle_id: vehicleId,
    p_usage_date: usageDate ?? null,
    p_exclude_id: excludeRecordId ?? null,
  })

  if (error) return { distance: null, prevOdometer: null, error: '이전 주행 기록 조회 실패' }

  const prevOdometer: number | null = data ?? null

  if (prevOdometer === null) {
    return { distance: null, prevOdometer: null, error: null }
  }

  const distance = currentOdometer - prevOdometer

  if (distance < 0) {
    return {
      distance: null,
      prevOdometer,
      error: `이전 누적거리(${prevOdometer.toLocaleString()}km)보다 작습니다. 다시 확인해주세요.`,
    }
  }

  return { distance, prevOdometer, error: null }
}

/** 날짜를 YYYY-MM-DD 형식으로 포맷 */
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}
