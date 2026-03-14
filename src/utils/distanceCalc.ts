import { supabase } from '@/lib/supabase'

/**
 * 해당 차량의 가장 최근 누적 주행거리를 조회하여 당일 주행거리를 계산
 * @param vehicleId 차량 UUID
 * @param currentOdometer 현재 입력한 누적 주행거리
 * @param excludeRecordId 수정 시 본인 레코드 제외용
 * @returns 계산된 당일 주행거리 또는 null
 */
export async function calcDistanceTraveled(
  vehicleId: string,
  currentOdometer: number,
  excludeRecordId?: string,
): Promise<{ distance: number | null; prevOdometer: number | null; error: string | null }> {
  let query = supabase
    .from('driving_records')
    .select('cumulative_distance')
    .eq('vehicle_id', vehicleId)
    .order('usage_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (excludeRecordId) {
    query = query.neq('id', excludeRecordId)
  }

  const { data, error } = await query

  if (error) {
    return { distance: null, prevOdometer: null, error: '이전 주행 기록 조회 실패' }
  }

  if (!data || data.length === 0) {
    // 첫 번째 기록이므로 distance_traveled = null
    return { distance: null, prevOdometer: null, error: null }
  }

  const prevOdometer = data[0].cumulative_distance
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
