import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, BorderStyle,
  ShadingType, VerticalMergeType, convertMillimetersToTwip, PageOrientation,
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

// ─── 열 너비 (mm) ─────────────────────────────────────────────────────────
// A:일자 B:소속 C:운전자 D:용무 E:경유지 F:목적지 G:운행기간 H:운행거리 I:누계 J:유류수령 K:확인
const COL_MM = [16, 24, 15, 24, 15, 15, 22, 14, 17, 13, 6]
function mm(v: number) { return convertMillimetersToTwip(v) }

// ─── 스타일 헬퍼 ──────────────────────────────────────────────────────────
const THIN = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN }
const GRAY = { type: ShadingType.CLEAR, color: 'auto', fill: 'D8D8D8' }
const FS = 16 // 8pt (half-points)

function txt(text: string, bold = false) {
  return new TextRun({ text, bold, size: FS, font: '맑은 고딕' })
}

function cell(
  text: string,
  colIdx: number,
  opts: {
    colspan?: number
    rowspan?: 'start' | 'continue'
    gray?: boolean
    bold?: boolean
    rowH?: number
  } = {}
): TableCell {
  const width = (() => {
    let w = 0
    const span = opts.colspan ?? 1
    for (let i = 0; i < span; i++) w += mm(COL_MM[colIdx + i] ?? 0)
    return w
  })()

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: opts.colspan ?? 1,
    verticalMerge: opts.rowspan === 'start'
      ? VerticalMergeType.RESTART
      : opts.rowspan === 'continue'
        ? VerticalMergeType.CONTINUE
        : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.gray ? GRAY : undefined,
    borders: BORDERS,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [txt(opts.rowspan === 'continue' ? '' : text, opts.bold)],
        spacing: { before: 0, after: 0 },
      }),
    ],
  })
}

// ─── 데이터 포맷 ──────────────────────────────────────────────────────────

function formatDate(r: RecordWithJoins): string {
  if (r.end_date && r.end_date !== r.usage_date) {
    return `${r.usage_date} ~ ${r.end_date}`
  }
  return r.usage_date.slice(5).replace('-', '/')
}

function formatTripPeriod(r: RecordWithJoins): string {
  if (r.departure_time && r.arrival_time) return `${r.departure_time} ~ ${r.arrival_time}`
  if (r.duration_hours != null) return `${r.duration_hours}시간`
  return ''
}

// ─── 테이블 생성 (페이지 1개 = 헤더 3줄 + 데이터 10줄) ───────────────────

function buildTable(
  pageRecords: (RecordWithJoins | undefined)[],
  vehiclePlate: string,
  managerName: string,
): Table {
  const totalWidth = COL_MM.reduce((a, b) => a + b, 0)

  // ── 행 1: 소속 / 차량번호 / 관리자 ──────────────────────────────────────
  const row1 = new TableRow({
    height: { value: mm(8), rule: 'atLeast' },
    children: [
      cell('소속', 0, { gray: true, bold: true }),
      cell(ORG_NAME, 1, { colspan: 3 }),
      cell('차량번호', 4, { gray: true, bold: true }),
      cell(vehiclePlate, 5, { colspan: 4 }),
      cell('관리자', 9, { gray: true, bold: true }),
      cell(managerName, 10),
    ],
  })

  // ── 행 2: 컬럼 헤더 (일자·용무 등은 행2-3 병합) ─────────────────────────
  const row2 = new TableRow({
    height: { value: mm(6), rule: 'atLeast' },
    children: [
      cell('일자', 0, { rowspan: 'start', gray: true, bold: true }),
      cell('사용자', 1, { colspan: 2, gray: true, bold: true }),
      cell('용무', 3, { rowspan: 'start', gray: true, bold: true }),
      cell('경유지', 4, { rowspan: 'start', gray: true, bold: true }),
      cell('목적지', 5, { rowspan: 'start', gray: true, bold: true }),
      cell('운행기간', 6, { rowspan: 'start', gray: true, bold: true }),
      cell('운행거리(km)', 7, { rowspan: 'start', gray: true, bold: true }),
      cell('운행거리누계(km)', 8, { rowspan: 'start', gray: true, bold: true }),
      cell('유류수령(L)', 9, { rowspan: 'start', gray: true, bold: true }),
      cell('확인', 10, { rowspan: 'start', gray: true, bold: true }),
    ],
  })

  // ── 행 3: 사용자 서브헤더 (소속/운전자) ─────────────────────────────────
  const row3 = new TableRow({
    height: { value: mm(6), rule: 'atLeast' },
    children: [
      cell('', 0, { rowspan: 'continue' }),
      cell('소속', 1, { gray: true, bold: true }),
      cell('운전자', 2, { gray: true, bold: true }),
      cell('', 3, { rowspan: 'continue' }),
      cell('', 4, { rowspan: 'continue' }),
      cell('', 5, { rowspan: 'continue' }),
      cell('', 6, { rowspan: 'continue' }),
      cell('', 7, { rowspan: 'continue' }),
      cell('', 8, { rowspan: 'continue' }),
      cell('', 9, { rowspan: 'continue' }),
      cell('', 10, { rowspan: 'continue' }),
    ],
  })

  // ── 데이터 행 10줄 ───────────────────────────────────────────────────────
  const dataRows = pageRecords.map(r =>
    new TableRow({
      height: { value: mm(9), rule: 'atLeast' },
      children: [
        cell(r ? formatDate(r) : '', 0),
        cell(r ? (r.departments?.name ?? '') : '', 1),
        cell(r ? r.driver_name : '', 2),
        cell(r ? r.purpose : '', 3),
        cell(r ? (r.waypoint ?? '') : '', 4),
        cell(r ? r.destination : '', 5),
        cell(r ? formatTripPeriod(r) : '', 6),
        cell(r ? (r.distance_traveled != null ? String(r.distance_traveled) : '') : '', 7),
        cell(r ? String(r.cumulative_distance) : '', 8),
        cell(r ? (r.fuel_amount != null ? String(r.fuel_amount) : '') : '', 9),
        cell('', 10),
      ],
    })
  )

  return new Table({
    width: { size: mm(totalWidth), type: WidthType.DXA },
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
  const managerName = opts.managerName ?? ''

  const sorted = [...records].sort((a, b) => a.usage_date.localeCompare(b.usage_date))

  // 페이지 단위로 분할 (빈 데이터도 1페이지 출력)
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

  // 페이지 간 구분: 테이블 → 페이지 나누기 단락 → 테이블 …
  const children: (Table | Paragraph)[] = []
  pages.forEach((pageRecords, i) => {
    children.push(buildTable(pageRecords, vehiclePlate, managerName))
    if (i < pages.length - 1) {
      children.push(
        new Paragraph({
          children: [],
          pageBreakBefore: true,
          spacing: { before: 0, after: 0 },
        })
      )
    }
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(210),
            height: convertMillimetersToTwip(297),
            orientation: PageOrientation.PORTRAIT,
          },
          margin: {
            top: convertMillimetersToTwip(15),
            bottom: convertMillimetersToTwip(15),
            left: convertMillimetersToTwip(10),
            right: convertMillimetersToTwip(10),
          },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const base = opts.filename?.replace(/\.xlsx$/, '') ?? `운행기록_${new Date().toISOString().split('T')[0]}`
  a.download = `${base}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
