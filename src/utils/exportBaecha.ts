import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, BorderStyle,
  VerticalMergeType, TableLayoutType,
} from 'docx'
import type { DrivingRecord } from '@/types'
import { VEHICLE_MANAGER_MAP } from './exportExcel'

type RecordWithJoins = DrivingRecord & {
  departments?: { name: string } | null
  vehicles?: { name: string; license_plate: string } | null
}

const MM = (v: number) => Math.round(v * 56.6929)

// A4 portrait: margins 15mm LR, 20mm TB → usable 180mm × 257mm
const PAGE_W    = MM(210)
const PAGE_H    = MM(297)
const MARGIN_LR = MM(15)
const MARGIN_TB = MM(20)

// Layout: [형식 87mm] [gap 6mm] [승인서 87mm] = 180mm
const FORM_W = MM(87)
const GAP_W  = MM(6)

// Inner form columns [22, 29, 18, 18] = 87mm
const C = [MM(22), MM(29), MM(18), MM(18)] as const

const FS    = 18  // 9pt
const FS_SM = 16  // 8pt
const FS_LG = 22  // 11pt

const THIN   = { style: BorderStyle.SINGLE, size: 4,  color: '000000' }
const NONE_B = { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' }
const DASH_B = { style: BorderStyle.DASHED, size: 6,  color: '888888' }

const BORDERS_ALL  = { top: THIN, bottom: THIN, left: THIN, right: THIN }
const BORDERS_NONE = { top: NONE_B, bottom: NONE_B, left: NONE_B, right: NONE_B }

// ── Helpers ───────────────────────────────────────────────────────────────

function korPara(text: string, opts: {
  bold?: boolean; size?: number; align?: typeof AlignmentType[keyof typeof AlignmentType]
  spaceBefore?: number; spaceAfter?: number
} = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.CENTER,
    spacing: { before: opts.spaceBefore ?? 60, after: opts.spaceAfter ?? 60 },
    children: [new TextRun({ text, bold: opts.bold ?? false, size: opts.size ?? FS, font: '맑은 고딕' })],
  })
}

function emptyP(space = 80): Paragraph {
  return new Paragraph({ spacing: { before: space, after: space }, children: [] })
}

function titlePara(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
    children: [new TextRun({ text, bold: true, size: FS_LG, font: '맑은 고딕' })],
  })
}

function fmtDT(date: string, time: string | null, suffix: string): string {
  const [y, m, d] = date.split('-')
  if (!time) return `${y}년  ${m}월  ${d}일       시       분 ${suffix}`
  const [h, mi] = time.split(':')
  return `${y}년  ${m}월  ${d}일  ${h}시  ${mi}분 ${suffix}`
}

function fmtDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${y}년     ${m}월     ${d}일`
}

function spanW(start: number, count: number): number {
  return (C.slice(start, start + count) as number[]).reduce((a, b) => a + b, 0)
}

// Table cell factory
function fc(
  text: string,
  width: number,
  opts: {
    colspan?: number
    rowspan?: 'start' | 'continue'
    bold?: boolean
    align?: typeof AlignmentType[keyof typeof AlignmentType]
    borders?: object
  } = {}
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: opts.colspan ?? 1,
    verticalMerge:
      opts.rowspan === 'start'    ? VerticalMergeType.RESTART :
      opts.rowspan === 'continue' ? VerticalMergeType.CONTINUE :
      undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: (opts.borders ?? BORDERS_ALL) as typeof BORDERS_ALL,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      opts.rowspan === 'continue'
        ? new Paragraph({ children: [] })
        : new Paragraph({
            alignment: opts.align ?? AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: opts.bold ?? false, size: FS, font: '맑은 고딕' })],
          }),
    ],
  })
}

// ── 배차신청서 내부 테이블 ─────────────────────────────────────────────────

function buildRequestTable(r: RecordWithJoins): Table {
  const dept = r.departments?.name ?? '산림특용자원연구과'
  const endDate = r.end_date && r.end_date !== r.usage_date ? r.end_date : r.usage_date

  return new Table({
    width: { size: FORM_W, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [...C],
    rows: [
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('사 용 일 자', C[0], { rowspan: 'start', bold: true }),
          fc(fmtDT(r.usage_date, r.departure_time, '부터'), spanW(1, 3), { colspan: 3, align: AlignmentType.LEFT }),
        ],
      }),
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('', C[0], { rowspan: 'continue' }),
          fc(fmtDT(endDate, r.arrival_time, '까지'), spanW(1, 3), { colspan: 3, align: AlignmentType.LEFT }),
        ],
      }),
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('행  선  지', C[0], { bold: true }),
          fc(r.destination, C[1]),
          fc('경  유  지', C[2], { bold: true }),
          fc(r.waypoint ?? '', C[3]),
        ],
      }),
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('용     무', C[0], { bold: true }),
          fc(r.purpose, spanW(1, 3), { colspan: 3 }),
        ],
      }),
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('사  용  자', C[0], { bold: true }),
          fc(dept, spanW(1, 3), { colspan: 3 }),
        ],
      }),
    ],
  })
}

// ── 배차승인서 내부 테이블 ─────────────────────────────────────────────────

function buildApprovalTable(r: RecordWithJoins): Table {
  const dept = r.departments?.name ?? '산림특용자원연구과'
  const plate = r.vehicles?.license_plate ?? r.vehicles?.name ?? ''
  const endDate = r.end_date && r.end_date !== r.usage_date ? r.end_date : r.usage_date
  const distance = r.distance_traveled != null ? `${r.distance_traveled}km` : ''

  return new Table({
    width: { size: FORM_W, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [...C],
    rows: [
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('차  량  번  호', C[0], { bold: true }),
          fc(plate, C[1]),
          fc('운  전  원', C[2], { bold: true }),
          fc(r.driver_name, C[3]),
        ],
      }),
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('배  차  일  시', C[0], { rowspan: 'start', bold: true }),
          fc(fmtDT(r.usage_date, r.departure_time, '부터'), spanW(1, 3), { colspan: 3, align: AlignmentType.LEFT }),
        ],
      }),
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('', C[0], { rowspan: 'continue' }),
          fc(fmtDT(endDate, r.arrival_time, '까지'), spanW(1, 3), { colspan: 3, align: AlignmentType.LEFT }),
        ],
      }),
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('행  선  지', C[0], { bold: true }),
          fc(r.destination, C[1]),
          fc('경  유  지', C[2], { bold: true }),
          fc(r.waypoint ?? '', C[3]),
        ],
      }),
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('용     무', C[0], { bold: true }),
          fc(r.purpose, C[1]),
          fc('운 행 거 리', C[2], { bold: true }),
          fc(distance, C[3]),
        ],
      }),
      new TableRow({
        height: { value: MM(9), rule: 'exact' },
        children: [
          fc('사  용  자', C[0], { bold: true }),
          fc(dept, spanW(1, 3), { colspan: 3 }),
        ],
      }),
    ],
  })
}

// ── 주석 박스 ─────────────────────────────────────────────────────────────

function noteBox(text: string): Table {
  return new Table({
    width: { size: FORM_W, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: FORM_W, type: WidthType.DXA },
            borders: BORDERS_ALL,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 0, after: 0 },
              children: [new TextRun({ text, size: FS_SM, font: '맑은 고딕' })],
            })],
          }),
        ],
      }),
    ],
  })
}

// ── 각 셀 콘텐츠 ──────────────────────────────────────────────────────────

function buildRequestContent(r: RecordWithJoins, managerName: string): (Paragraph | Table)[] {
  const dept = r.departments?.name ?? '산림특용자원연구과'
  return [
    emptyP(60),
    titlePara('배 차 신 청 서'),
    emptyP(80),
    buildRequestTable(r),
    emptyP(100),
    korPara('위와 같이 차량의 배차를 요청하오니 승인하여 주시기 바랍니다.'),
    emptyP(120),
    korPara(fmtDate(r.usage_date)),
    emptyP(80),
    korPara(`${dept}                     (인)`),
    emptyP(80),
    korPara(`${dept}   ${managerName}   귀하`),
    emptyP(80),
    noteBox('※ 적어도 사용하기 1시간 전까지 배차를 요청하여야 합니다.'),
  ]
}

function buildApprovalContent(r: RecordWithJoins, managerName: string): (Paragraph | Table)[] {
  const dept = r.departments?.name ?? '산림특용자원연구과'
  return [
    emptyP(60),
    titlePara('배 차 승 인 서'),
    emptyP(80),
    buildApprovalTable(r),
    emptyP(100),
    korPara('이와 같이 배차하오니 안전운행에 유의하여 주시기 바랍니다.'),
    emptyP(120),
    korPara(fmtDate(r.usage_date)),
    emptyP(80),
    korPara(`${dept}   ${managerName}   (인)`),
    emptyP(80),
    korPara(`${dept}                     귀하`),
    emptyP(80),
    noteBox('※ 운전원은 운행종료 후 즉시 이 승인서를 반납하여야 합니다.'),
  ]
}

// ── 페이지(레코드 1건) 빌드 ───────────────────────────────────────────────

function buildPage(r: RecordWithJoins, managerName: string): Table {
  return new Table({
    width: { size: FORM_W * 2 + GAP_W, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [FORM_W, GAP_W, FORM_W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: FORM_W, type: WidthType.DXA },
            borders: { top: NONE_B, bottom: NONE_B, left: NONE_B, right: DASH_B },
            margins: { top: 0, bottom: 0, left: 0, right: MM(3) },
            verticalAlign: VerticalAlign.TOP,
            children: buildRequestContent(r, managerName),
          }),
          new TableCell({
            width: { size: GAP_W, type: WidthType.DXA },
            borders: BORDERS_NONE,
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: FORM_W, type: WidthType.DXA },
            borders: BORDERS_NONE,
            margins: { top: 0, bottom: 0, left: MM(3), right: 0 },
            verticalAlign: VerticalAlign.TOP,
            children: buildApprovalContent(r, managerName),
          }),
        ],
      }),
    ],
  })
}

// ── 공개 API ──────────────────────────────────────────────────────────────

export async function exportBaechaForms(
  records: RecordWithJoins[],
  opts: { filename?: string } = {}
): Promise<void> {
  if (records.length === 0) return

  const sorted = [...records].sort((a, b) => a.usage_date.localeCompare(b.usage_date))

  const children: (Table | Paragraph)[] = []
  sorted.forEach((r, i) => {
    if (i > 0) {
      children.push(new Paragraph({
        children: [],
        pageBreakBefore: true,
        spacing: { before: 0, after: 0, line: 20, lineRule: 'exact' },
      }))
    }
    const managerName = r.vehicles ? (VEHICLE_MANAGER_MAP[r.vehicles.name] ?? '') : ''
    children.push(buildPage(r, managerName))
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN_TB, bottom: MARGIN_TB, left: MARGIN_LR, right: MARGIN_LR },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${opts.filename ?? `배차신청서_${new Date().toISOString().split('T')[0]}`}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
