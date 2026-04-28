import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, BorderStyle,
  VerticalMergeType, TableLayoutType,
} from 'docx'
import type { DrivingRecord } from '@/types'

// 차량별 담당자 우선순위 (높은 순서대로, 운전자와 겹치면 다음 사람으로)
const VEHICLE_APPROVERS: Record<string, { ownerDept: string; priority: string[] }> = {
  '숲푸드트럭':   { ownerDept: '산림특용자원연구과', priority: ['권순호', '김철우', '황병현'] },
  '스마트달구지': { ownerDept: '산림특용자원연구과', priority: ['한진규', '어현지', '김문섭'] },
  '꿀벌붕붕카':  { ownerDept: '산림특용자원연구과', priority: ['김현준', '나성준'] },
  '꿀벌 붕붕카': { ownerDept: '산림특용자원연구과', priority: ['김현준', '나성준'] },
}

function resolveApprover(vehicleName: string | undefined, driverName: string) {
  const cfg = vehicleName ? VEHICLE_APPROVERS[vehicleName] : undefined
  const ownerDept = cfg?.ownerDept ?? '산림특용자원연구과'
  const approver  = cfg?.priority.find(n => n !== driverName) ?? cfg?.priority[0] ?? ''
  return { ownerDept, approver }
}

type RecordWithJoins = DrivingRecord & {
  departments?: { name: string } | null
  vehicles?: { name: string; license_plate: string } | null
}

const MM = (v: number) => Math.round(v * 56.6929)

// A4 가로: 물리적 치수를 직접 지정 (297mm × 210mm)
// 가용 폭: 297 - 15 - 15 = 267mm / 가용 높이: 210 - 20 - 20 = 170mm
const PAGE_W    = MM(297)   // 가로(landscape) 실제 폭
const PAGE_H    = MM(210)   // 가로(landscape) 실제 높이
const MARGIN_LR = MM(15)
const MARGIN_TB = MM(20)

// 두 양식 레이아웃: [130mm] [7mm gap] [130mm] = 267mm
const FORM_W = MM(130)
const GAP_W  = MM(7)

// 내부 테이블 컬럼 [33, 50, 27, 20] = 130mm
const C = [MM(33), MM(50), MM(27), MM(20)] as const

const FS    = 18  // 9pt
const FS_SM = 16  // 8pt
const FS_TL = 24  // 12pt (form title)

const THIN   = { style: BorderStyle.SINGLE, size: 4,  color: '000000' }
const NONE_B = { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' }
const DASH_B = { style: BorderStyle.DASHED, size: 8,  color: '666666' }

const BORDERS_ALL  = { top: THIN, bottom: THIN, left: THIN, right: THIN }
const BORDERS_NONE = { top: NONE_B, bottom: NONE_B, left: NONE_B, right: NONE_B }

// ── 단락 헬퍼 ────────────────────────────────────────────────────────────

function p(
  text: string,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER,
  size = FS,
  bold = false,
  spaceBefore = 0,
  spaceAfter = 0,
): Paragraph {
  return new Paragraph({
    alignment: align,
    spacing: { before: spaceBefore, after: spaceAfter },
    children: [new TextRun({ text, bold, size, font: '맑은 고딕' })],
  })
}

function gap(twips: number): Paragraph {
  return new Paragraph({ spacing: { before: twips, after: 0 }, children: [] })
}

// 양식 제목 (하단 테두리로 밑줄 효과)
function formTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: MM(4) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
    children: [new TextRun({ text, bold: true, size: FS_TL, font: '맑은 고딕' })],
  })
}

// ── 날짜/시간 포맷 ───────────────────────────────────────────────────────

function fmtDT(date: string, time: string | null, suffix: '부터' | '까지'): string {
  const [y, m, d] = date.split('-')
  if (!time) {
    return `${y}년   월   일   시   분 ${suffix}`
  }
  const [h, mi] = time.split(':')
  return `${y}년  ${m}월  ${d}일  ${h}시  ${mi}분 ${suffix}`
}

function fmtDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${y}년       ${m}월       ${d}일`
}

// ── 셀 헬퍼 ─────────────────────────────────────────────────────────────

function spanW(start: number, count: number): number {
  return (C.slice(start, start + count) as number[]).reduce((a, b) => a + b, 0)
}

function cell(
  text: string,
  width: number,
  opts: {
    colspan?: number
    rowspan?: 'start' | 'continue'
    bold?: boolean
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    size?: number
  } = {},
): TableCell {
  return new TableCell({
    width:         { size: width, type: WidthType.DXA },
    columnSpan:    opts.colspan ?? 1,
    verticalMerge:
      opts.rowspan === 'start'    ? VerticalMergeType.RESTART  :
      opts.rowspan === 'continue' ? VerticalMergeType.CONTINUE :
      undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders:       BORDERS_ALL,
    margins:       { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      opts.rowspan === 'continue'
        ? new Paragraph({ children: [] })
        : new Paragraph({
            alignment: opts.align ?? AlignmentType.CENTER,
            spacing:   { before: 0, after: 0 },
            children:  [new TextRun({
              text,
              bold:  opts.bold ?? false,
              size:  opts.size ?? FS,
              font:  '맑은 고딕',
            })],
          }),
    ],
  })
}

const ROW_H = { value: MM(10), rule: 'exact' as const }

// ── 배차신청서 테이블 ─────────────────────────────────────────────────────

function requestTable(r: RecordWithJoins): Table {
  const dept    = r.departments?.name ?? '산림특용자원연구과'
  const endDate = (r.end_date && r.end_date !== r.usage_date) ? r.end_date : r.usage_date

  return new Table({
    width:        { size: FORM_W, type: WidthType.DXA },
    layout:       TableLayoutType.FIXED,
    columnWidths: [...C],
    rows: [
      new TableRow({ height: ROW_H, children: [
        cell('사 용 일 자', C[0], { rowspan: 'start', bold: true }),
        cell(fmtDT(r.usage_date, r.departure_time, '부터'), spanW(1, 3),
          { colspan: 3, align: AlignmentType.CENTER }),
      ]}),
      new TableRow({ height: ROW_H, children: [
        cell('', C[0], { rowspan: 'continue' }),
        cell(fmtDT(endDate, r.arrival_time, '까지'), spanW(1, 3),
          { colspan: 3, align: AlignmentType.CENTER }),
      ]}),
      new TableRow({ height: ROW_H, children: [
        cell('행  선  지', C[0], { bold: true }),
        cell(r.destination, C[1], { align: AlignmentType.CENTER }),
        cell('경  유  지', C[2], { bold: true }),
        cell(r.waypoint || '-', C[3], { align: AlignmentType.CENTER }),
      ]}),
      new TableRow({ height: ROW_H, children: [
        cell('용     무', C[0], { bold: true }),
        cell(r.purpose, spanW(1, 3), { colspan: 3, align: AlignmentType.CENTER }),
      ]}),
      new TableRow({ height: ROW_H, children: [
        cell('사  용  자', C[0], { bold: true }),
        cell(`${dept}   ${r.driver_name}`, spanW(1, 3), { colspan: 3, align: AlignmentType.CENTER }),
      ]}),
    ],
  })
}

// ── 배차승인서 테이블 ─────────────────────────────────────────────────────

function approvalTable(r: RecordWithJoins): Table {
  const dept     = r.departments?.name ?? '산림특용자원연구과'
  const plate    = r.vehicles?.license_plate ?? r.vehicles?.name ?? ''
  const endDate  = (r.end_date && r.end_date !== r.usage_date) ? r.end_date : r.usage_date
  const distance = r.distance_traveled != null ? `${r.distance_traveled}km` : ''

  return new Table({
    width:        { size: FORM_W, type: WidthType.DXA },
    layout:       TableLayoutType.FIXED,
    columnWidths: [...C],
    rows: [
      // 차량번호 | plate | 운전원 | driver
      new TableRow({ height: ROW_H, children: [
        cell('차  량  번  호', C[0], { bold: true }),
        cell(plate, C[1], { align: AlignmentType.CENTER }),
        cell('운  전  원', C[2], { bold: true }),
        cell(r.driver_name, C[3], { align: AlignmentType.CENTER }),
      ]}),
      // 배차일시 (rowspan 2) | 부터
      new TableRow({ height: ROW_H, children: [
        cell('배  차  일  시', C[0], { rowspan: 'start', bold: true }),
        cell(fmtDT(r.usage_date, r.departure_time, '부터'), spanW(1, 3),
          { colspan: 3, align: AlignmentType.CENTER }),
      ]}),
      // continue | 까지
      new TableRow({ height: ROW_H, children: [
        cell('', C[0], { rowspan: 'continue' }),
        cell(fmtDT(endDate, r.arrival_time, '까지'), spanW(1, 3),
          { colspan: 3, align: AlignmentType.CENTER }),
      ]}),
      // 행선지 | dest | 경유지 | waypoint
      new TableRow({ height: ROW_H, children: [
        cell('행  선  지', C[0], { bold: true }),
        cell(r.destination, C[1], { align: AlignmentType.CENTER }),
        cell('경  유  지', C[2], { bold: true }),
        cell(r.waypoint || '-', C[3], { align: AlignmentType.CENTER }),
      ]}),
      // 용무 | purpose | 운행거리 | km
      new TableRow({ height: ROW_H, children: [
        cell('용     무', C[0], { bold: true }),
        cell(r.purpose, C[1], { align: AlignmentType.CENTER }),
        cell('운 행 거 리', C[2], { bold: true }),
        cell(distance, C[3], { align: AlignmentType.CENTER }),
      ]}),
      // 사용자 | colspan 3
      new TableRow({ height: ROW_H, children: [
        cell('사  용  자', C[0], { bold: true }),
        cell(`${dept}   ${r.driver_name}`, spanW(1, 3), { colspan: 3, align: AlignmentType.CENTER }),
      ]}),
    ],
  })
}

// ── 주석 박스 ─────────────────────────────────────────────────────────────

function noteBox(text: string): Table {
  return new Table({
    width:  { size: FORM_W, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width:   { size: FORM_W, type: WidthType.DXA },
            borders: BORDERS_ALL,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing:   { before: 0, after: 0 },
              children:  [new TextRun({ text, size: FS_SM, font: '맑은 고딕' })],
            })],
          }),
        ],
      }),
    ],
  })
}

// ── 각 셀 내부 콘텐츠 ────────────────────────────────────────────────────

function requestContent(r: RecordWithJoins): (Paragraph | Table)[] {
  const dept = r.departments?.name ?? '산림특용자원연구과'
  const driver = r.driver_name
  const { ownerDept, approver } = resolveApprover(r.vehicles?.name, driver)
  return [
    gap(MM(6)),
    formTitle('배 차 신 청 서'),
    gap(MM(5)),
    requestTable(r),
    gap(MM(10)),
    p('위와 같이 차량의 배차를 요청하오니 승인하여 주시기 바랍니다.', AlignmentType.CENTER, FS),
    gap(MM(12)),
    p(fmtDate(r.usage_date), AlignmentType.CENTER, FS),
    gap(MM(10)),
    p(`${dept}   ${driver}   (인)`, AlignmentType.CENTER, FS),
    gap(MM(6)),
    p(`${ownerDept}   ${approver}   귀하`, AlignmentType.CENTER, FS),
    gap(MM(10)),
    noteBox('※ 적어도 사용하기 1시간 전까지 배차를 요청하여야 합니다.'),
  ]
}

function approvalContent(r: RecordWithJoins): (Paragraph | Table)[] {
  const driver = r.driver_name
  const { ownerDept, approver } = resolveApprover(r.vehicles?.name, driver)
  return [
    gap(MM(6)),
    formTitle('배 차 승 인 서'),
    gap(MM(5)),
    approvalTable(r),
    gap(MM(10)),
    p('이와 같이 배차하오니 안전운행에 유의하여 주시기 바랍니다.', AlignmentType.CENTER, FS),
    gap(MM(12)),
    p(fmtDate(r.usage_date), AlignmentType.CENTER, FS),
    gap(MM(10)),
    p(`${ownerDept}   ${approver}   (인)`, AlignmentType.CENTER, FS),
    gap(MM(6)),
    p(`${ownerDept}   ${driver}   귀하`, AlignmentType.CENTER, FS),
    gap(MM(10)),
    noteBox('※ 운전원은 운행종료 후 즉시 이 승인서를 반납하여야 합니다.'),
  ]
}

// ── 페이지(레코드 1건) ────────────────────────────────────────────────────

function buildPage(r: RecordWithJoins): Table {
  return new Table({
    width:        { size: FORM_W * 2 + GAP_W, type: WidthType.DXA },
    layout:       TableLayoutType.FIXED,
    columnWidths: [FORM_W, GAP_W, FORM_W],
    rows: [
      new TableRow({
        children: [
          // 배차신청서 (우측에 dashed border = 가운데 절취선)
          new TableCell({
            width:         { size: FORM_W, type: WidthType.DXA },
            borders:       { top: NONE_B, bottom: NONE_B, left: NONE_B, right: DASH_B },
            margins:       { top: 0, bottom: 0, left: 0, right: MM(4) },
            verticalAlign: VerticalAlign.TOP,
            children:      requestContent(r),
          }),
          // 가운데 간격
          new TableCell({
            width:   { size: GAP_W, type: WidthType.DXA },
            borders: BORDERS_NONE,
            children:[new Paragraph({ children: [] })],
          }),
          // 배차승인서
          new TableCell({
            width:         { size: FORM_W, type: WidthType.DXA },
            borders:       BORDERS_NONE,
            margins:       { top: 0, bottom: 0, left: MM(4), right: 0 },
            verticalAlign: VerticalAlign.TOP,
            children:      approvalContent(r),
          }),
        ],
      }),
    ],
  })
}

// ── 공개 API ─────────────────────────────────────────────────────────────

export async function exportBaechaForms(
  records: RecordWithJoins[],
  opts: { filename?: string } = {},
): Promise<void> {
  if (records.length === 0) return

  const sorted = [...records].sort((a, b) => a.usage_date.localeCompare(b.usage_date))

  const children: (Table | Paragraph)[] = []
  sorted.forEach((r, i) => {
    if (i > 0) {
      children.push(new Paragraph({
        children:        [],
        pageBreakBefore: true,
        spacing:         { before: 0, after: 0, line: 20, lineRule: 'exact' },
      }))
    }
    children.push(buildPage(r))
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size:   { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN_TB, bottom: MARGIN_TB, left: MARGIN_LR, right: MARGIN_LR },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${opts.filename ?? `배차신청서_${new Date().toISOString().split('T')[0]}`}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
