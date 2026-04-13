import ExcelJS from 'exceljs'
import type { DrivingRecord } from '@/types'

type RecordWithJoins = DrivingRecord & {
  departments?: { name: string } | null
  vehicles?: { name: string; license_plate: string } | null
}

/** 차량명 → 관리자 매핑 */
export const VEHICLE_MANAGER_MAP: Record<string, string> = {
  '숲푸드트럭': '권순호',
  '스마트달구지': '김문섭',
  '꿀벌붕붕카': '김현준',
  '꿀벌 붕붕카': '김현준',
}

const ORG_NAME = '국립산림과학원 산림생명자원연구부'
const ROWS_PER_PAGE = 10

// ─── 스타일 상수 ────────────────────────────────────────────────────────────

const THIN: ExcelJS.BorderStyle = 'thin'
const ALL_BORDERS: Partial<ExcelJS.Borders> = {
  top: { style: THIN }, left: { style: THIN },
  bottom: { style: THIN }, right: { style: THIN },
}
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' },
}
const CENTER_MIDDLE: Partial<ExcelJS.Alignment> = {
  horizontal: 'center', vertical: 'middle', wrapText: true,
}
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, size: 9 }
const DATA_FONT: Partial<ExcelJS.Font> = { size: 9 }

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function formatDate(r: RecordWithJoins): string {
  if (r.end_date && r.end_date !== r.usage_date) {
    return `${r.usage_date}\n~ ${r.end_date}`
  }
  // MM/DD 형식으로 표시
  const d = r.usage_date.slice(5).replace('-', '/')
  return d
}

function formatTripPeriod(r: RecordWithJoins): string {
  if (r.departure_time && r.arrival_time) {
    return `${r.departure_time} ~ ${r.arrival_time}`
  }
  if (r.duration_hours != null) return `${r.duration_hours}시간`
  return ''
}

function applyHeader(cell: ExcelJS.Cell, value: string, bgGray = true) {
  cell.value = value
  cell.font = HEADER_FONT
  cell.alignment = CENTER_MIDDLE
  cell.border = ALL_BORDERS
  if (bgGray) cell.fill = HEADER_FILL
}

/** 한 페이지 분량 헤더 블록 (3행) 작성 */
function writePageHeader(
  ws: ExcelJS.Worksheet,
  startRow: number,
  vehiclePlate: string,
  managerName: string,
) {
  // ── 행 1: 소속 / 차량번호 / 관리자 ──────────────────────────────────────
  ws.getRow(startRow).height = 22

  applyHeader(ws.getCell(startRow, 1), '소속')
  ws.mergeCells(startRow, 2, startRow, 4)
  ws.getCell(startRow, 2).value = ORG_NAME
  ws.getCell(startRow, 2).font = { size: 9 }
  ws.getCell(startRow, 2).alignment = CENTER_MIDDLE
  ws.getCell(startRow, 2).border = ALL_BORDERS

  applyHeader(ws.getCell(startRow, 5), '차량번호')
  ws.mergeCells(startRow, 6, startRow, 9)
  ws.getCell(startRow, 6).value = vehiclePlate
  ws.getCell(startRow, 6).font = { size: 9 }
  ws.getCell(startRow, 6).alignment = CENTER_MIDDLE
  ws.getCell(startRow, 6).border = ALL_BORDERS

  applyHeader(ws.getCell(startRow, 10), '관리자')
  ws.getCell(startRow, 11).value = managerName
  ws.getCell(startRow, 11).font = { size: 9 }
  ws.getCell(startRow, 11).alignment = CENTER_MIDDLE
  ws.getCell(startRow, 11).border = ALL_BORDERS

  // ── 행 2: 컬럼 헤더 (일자/사용자/용무/… 수직 병합 예정) ─────────────────
  ws.getRow(startRow + 1).height = 18

  // 일자: 행2-3 병합
  ws.mergeCells(startRow + 1, 1, startRow + 2, 1)
  applyHeader(ws.getCell(startRow + 1, 1), '일자')

  // 사용자: 열2-3 병합 (행2만)
  ws.mergeCells(startRow + 1, 2, startRow + 1, 3)
  applyHeader(ws.getCell(startRow + 1, 2), '사용자')

  // 용무~확인: 행2-3 병합
  const headers: [number, string][] = [
    [4, '용무'], [5, '경유지'], [6, '목적지'], [7, '운행기간'],
    [8, '운행거리\n(km)'], [9, '운행거리\n누계(km)'],
    [10, '유류수령\n(L)'], [11, '확인'],
  ]
  for (const [col, label] of headers) {
    ws.mergeCells(startRow + 1, col, startRow + 2, col)
    applyHeader(ws.getCell(startRow + 1, col), label)
  }

  // ── 행 3: 소속 / 운전자 서브헤더 ────────────────────────────────────────
  ws.getRow(startRow + 2).height = 16

  applyHeader(ws.getCell(startRow + 2, 2), '소속')
  applyHeader(ws.getCell(startRow + 2, 3), '운전자')
  // 병합된 나머지 셀 테두리 보정 (mergeCells 이후 자동 처리됨)
}

/** 데이터 행 1줄 작성 */
function writeDataRow(ws: ExcelJS.Worksheet, rowIdx: number, r: RecordWithJoins | undefined) {
  ws.getRow(rowIdx).height = 28

  const values = r ? [
    formatDate(r),
    r.departments?.name ?? '',
    r.driver_name,
    r.purpose,
    r.waypoint ?? '',
    r.destination,
    formatTripPeriod(r),
    r.distance_traveled != null ? r.distance_traveled : '',
    r.cumulative_distance,
    r.fuel_amount != null ? r.fuel_amount : '',
    '',
  ] : Array(11).fill('')

  values.forEach((val, i) => {
    const cell = ws.getCell(rowIdx, i + 1)
    cell.value = val as ExcelJS.CellValue
    cell.font = DATA_FONT
    cell.alignment = CENTER_MIDDLE
    cell.border = ALL_BORDERS
  })
}

// ─── 공개 함수 ────────────────────────────────────────────────────────────────

export async function exportDrivingRecords(
  records: RecordWithJoins[],
  opts: {
    vehicleName?: string
    vehiclePlate?: string
    managerName?: string
    filename?: string
  },
) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('운행기록')

  // 열 너비 (A4 세로 기준)
  ws.columns = [
    { width: 7 },   // A 일자
    { width: 15 },  // B 소속
    { width: 8 },   // C 운전자
    { width: 14 },  // D 용무
    { width: 9 },   // E 경유지
    { width: 10 },  // F 목적지
    { width: 13 },  // G 운행기간
    { width: 8 },   // H 운행거리
    { width: 10 },  // I 운행거리누계
    { width: 8 },   // J 유류수령
    { width: 5 },   // K 확인
  ]

  const vehiclePlate = opts.vehiclePlate ?? ''
  const managerName = opts.managerName ?? ''

  const sorted = [...records].sort((a, b) => a.usage_date.localeCompare(b.usage_date))

  // 빈 데이터도 최소 1페이지 출력
  const pages: (RecordWithJoins | undefined)[][] = []
  if (sorted.length === 0) {
    pages.push(Array(ROWS_PER_PAGE).fill(undefined))
  } else {
    for (let i = 0; i < sorted.length; i += ROWS_PER_PAGE) {
      const chunk = sorted.slice(i, i + ROWS_PER_PAGE)
      // 페이지를 ROWS_PER_PAGE 줄로 패딩
      while (chunk.length < ROWS_PER_PAGE) chunk.push(undefined)
      pages.push(chunk)
    }
  }

  let currentRow = 1

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageRecords = pages[pageIdx]

    // 헤더 3행
    writePageHeader(ws, currentRow, vehiclePlate, managerName)
    currentRow += 3

    // 데이터 10행
    for (const r of pageRecords) {
      writeDataRow(ws, currentRow, r)
      currentRow++
    }

    // 페이지 나누기 (마지막 페이지 제외)
    if (pageIdx < pages.length - 1) {
      ws.getRow(currentRow - 1).pageBreak = true
    }
  }

  // A4 인쇄 설정
  ws.pageSetup.paperSize = 9           // A4
  ws.pageSetup.orientation = 'portrait'
  ws.pageSetup.fitToPage = true
  ws.pageSetup.fitToWidth = 1
  ws.pageSetup.fitToHeight = 0         // 높이는 자동 (페이지 나누기 기준)
  ws.pageSetup.horizontalCentered = true

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opts.filename ?? `운행기록_${new Date().toISOString().split('T')[0]}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
