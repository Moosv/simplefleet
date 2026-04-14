import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, BorderStyle,
  ShadingType, VerticalMergeType, TableLayoutType,
} from 'docx'
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

// ─── 단위 변환 ────────────────────────────────────────────────────────────
// 1mm = 56.6929 twips (DXA), 1pt = 20 twips
const MM = (v: number) => Math.round(v * 56.6929)

// A4 세로 (210mm × 297mm), 좌우 여백 12mm, 상하 여백 15mm
// 가용 폭: 210 - 12 - 12 = 186mm = 10545 twips
const PAGE_W    = MM(210)
const PAGE_H    = MM(297)
const MARGIN_LR = MM(12)
const MARGIN_TB = MM(15)

// ─── 열 너비 (mm, 합계 = 186mm) ──────────────────────────────────────────
// A:일자  B:소속  C:운전자  D:용무  E:경유지  F:목적지
// G:운행기간  H:운행거리  I:누계거리  J:유류수령  K:확인
const COL_MM = [17, 27, 14, 27, 14, 14, 22, 14, 17, 12, 8]
// 합계: 17+27+14+27+14+14+22+14+17+12+8 = 186 ✓
const COL_W = COL_MM.map(MM)
const TABLE_W = COL_W.reduce((a, b) => a + b, 0)

// ─── 스타일 ───────────────────────────────────────────────────────────────
const THIN = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN }
const GRAY = ShadingType.CLEAR
const FS = 18  // 9pt (half-points)
const ROW_H_DATA = MM(8.5)  // 데이터 행 높이
const ROW_H_HEAD = MM(6.5)  // 헤더 행 높이

function para(text: string, bold = false, size = FS) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, bold, size, font: '맑은 고딕' })],
  })
}

function makeCell(
  text: string,
  colStart: number,
  opts: {
    colspan?: number
    rowspan?: 'start' | 'continue'
    gray?: boolean
    bold?: boolean
  } = {}
): TableCell {
  const span = opts.colspan ?? 1
  const width = COL_W.slice(colStart, colStart + span).reduce((a, b) => a + b, 0)

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: span,
    verticalMerge:
      opts.rowspan === 'start' ? VerticalMergeType.RESTART :
      opts.rowspan === 'continue' ? VerticalMergeType.CONTINUE :
      undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.gray ? { type: GRAY, color: 'auto', fill: 'D4D4D4' } : undefined,
    borders: BORDERS,
    margins: { top: 30, bottom: 30, left: 50, right: 50 },
    children: [
      opts.rowspan === 'continue'
        ? new Paragraph({ children: [] })
        : para(text, opts.bold ?? opts.gray),
    ],
  })
}

// ─── 데이터 포맷 ──────────────────────────────────────────────────────────
function formatDate(r: RecordWithJoins): string {
  if (r.end_date && r.end_date !== r.usage_date)
    return `${r.usage_date}~${r.end_date}`
  return r.usage_date.slice(5).replace('-', '/')
}

function formatPeriod(r: RecordWithJoins): string {
  if (r.departure_time && r.arrival_time) return `${r.departure_time}~${r.arrival_time}`
  if (r.duration_hours != null) return `${r.duration_hours}시간`
  return ''
}

// ─── 테이블 1페이지 빌드 ─────────────────────────────────────────────────
function buildTable(
  pageRecords: (RecordWithJoins | undefined)[],
  vehiclePlate: string,
  managerName: string,
): Table {
  // 행1: 소속 / 차량번호 / 관리자
  const row1 = new TableRow({
    height: { value: ROW_H_HEAD, rule: 'atLeast' },
    children: [
      makeCell('소속', 0, { gray: true }),
      makeCell(ORG_NAME, 1, { colspan: 3 }),
      makeCell('차량번호', 4, { gray: true }),
      makeCell(vehiclePlate, 5, { colspan: 4 }),
      makeCell('관리자', 9, { gray: true }),
      makeCell(managerName, 10),
    ],
  })

  // 행2: 컬럼 헤더 (일자·용무 등 행2-3 병합)
  const row2 = new TableRow({
    height: { value: ROW_H_HEAD, rule: 'atLeast' },
    children: [
      makeCell('일자',          0, { rowspan: 'start', gray: true }),
      makeCell('사용자',        1, { colspan: 2,       gray: true }),
      makeCell('용무',          3, { rowspan: 'start', gray: true }),
      makeCell('경유지',        4, { rowspan: 'start', gray: true }),
      makeCell('목적지',        5, { rowspan: 'start', gray: true }),
      makeCell('운행기간',      6, { rowspan: 'start', gray: true }),
      makeCell('운행거리(km)',  7, { rowspan: 'start', gray: true }),
      makeCell('운행거리누계(km)', 8, { rowspan: 'start', gray: true }),
      makeCell('유류수령(L)',   9, { rowspan: 'start', gray: true }),
      makeCell('확인',         10, { rowspan: 'start', gray: true }),
    ],
  })

  // 행3: 소속 / 운전자 서브헤더
  const row3 = new TableRow({
    height: { value: ROW_H_HEAD, rule: 'atLeast' },
    children: [
      makeCell('', 0, { rowspan: 'continue' }),
      makeCell('소속',    1, { gray: true }),
      makeCell('운전자',  2, { gray: true }),
      makeCell('', 3, { rowspan: 'continue' }),
      makeCell('', 4, { rowspan: 'continue' }),
      makeCell('', 5, { rowspan: 'continue' }),
      makeCell('', 6, { rowspan: 'continue' }),
      makeCell('', 7, { rowspan: 'continue' }),
      makeCell('', 8, { rowspan: 'continue' }),
      makeCell('', 9, { rowspan: 'continue' }),
      makeCell('', 10, { rowspan: 'continue' }),
    ],
  })

  // 데이터 10행
  const dataRows = pageRecords.map(r =>
    new TableRow({
      height: { value: ROW_H_DATA, rule: 'atLeast' },
      children: [
        makeCell(r ? formatDate(r) : '', 0),
        makeCell(r ? (r.departments?.name ?? '') : '', 1),
        makeCell(r ? r.driver_name : '', 2),
        makeCell(r ? r.purpose : '', 3),
        makeCell(r ? (r.waypoint ?? '') : '', 4),
        makeCell(r ? r.destination : '', 5),
        makeCell(r ? formatPeriod(r) : '', 6),
        makeCell(r && r.distance_traveled != null ? String(r.distance_traveled) : '', 7),
        makeCell(r ? String(r.cumulative_distance) : '', 8),
        makeCell(r && r.fuel_amount != null ? String(r.fuel_amount) : '', 9),
        makeCell('', 10),
      ],
    })
  )

  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: COL_W,
    rows: [row1, row2, row3, ...dataRows],
  })
}

// ─── 공개 함수 ────────────────────────────────────────────────────────────
export async function exportDrivingRecords(
  records: RecordWithJoins[],
  opts: {
    vehicleName?: string
    vehiclePlate?: string
    managerName?: string
    filename?: string
  },
) {
  const vehiclePlate = opts.vehiclePlate ?? ''
  const managerName  = opts.managerName  ?? ''

  const sorted = [...records].sort((a, b) => a.usage_date.localeCompare(b.usage_date))

  const pages: (RecordWithJoins | undefined)[][] = []
  if (sorted.length === 0) {
    pages.push(Array(ROWS_PER_PAGE).fill(undefined))
  } else {
    for (let i = 0; i < sorted.length; i += ROWS_PER_PAGE) {
      const chunk: (RecordWithJoins | undefined)[] = sorted.slice(i, i + ROWS_PER_PAGE)
      while (chunk.length < ROWS_PER_PAGE) chunk.push(undefined)
      pages.push(chunk)
    }
  }

  const children: (Table | Paragraph)[] = []
  pages.forEach((pageRecords, i) => {
    children.push(buildTable(pageRecords, vehiclePlate, managerName))
    if (i < pages.length - 1) {
      children.push(new Paragraph({
        children: [],
        pageBreakBefore: true,
        spacing: { before: 0, after: 0 },
      }))
    }
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size:   { width: PAGE_W, height: PAGE_H },
          margin: {
            top:    MARGIN_TB,
            bottom: MARGIN_TB,
            left:   MARGIN_LR,
            right:  MARGIN_LR,
          },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  const base = opts.filename?.replace(/\.xlsx$/, '') ?? `차량운행일지_${new Date().toISOString().split('T')[0]}`
  a.download = `${base}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
