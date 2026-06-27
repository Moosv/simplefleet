-- 배차신청 (외부/타 부서 사전 신청) — 운행기록과 분리, 연결형(driving_record_id)

CREATE TABLE IF NOT EXISTS dispatch_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         TIMESTAMPTZ DEFAULT now(),
  -- 신청자(등록 명단 FK + 스냅샷)
  department_id      UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id            UUID REFERENCES teams(id)       ON DELETE SET NULL,
  employee_id        UUID REFERENCES employees(id)   ON DELETE SET NULL,
  driver_name        TEXT NOT NULL,            -- 명단 변경 대비 스냅샷
  -- 신청 내용
  vehicle_id         UUID REFERENCES vehicles(id)    ON DELETE SET NULL,
  usage_date         DATE NOT NULL,
  end_date           DATE,                     -- 숙박(여러 날) 시
  departure_time     TEXT,                     -- "HH:MM"
  arrival_time       TEXT,
  destination        TEXT NOT NULL,            -- 행선지
  waypoint           TEXT,                     -- 경유지
  purpose            TEXT NOT NULL,            -- 용무
  -- 결재(차량별 자동 결재자 스냅샷)
  approver_name      TEXT,
  -- 상태 / 연결형
  status             TEXT NOT NULL DEFAULT 'requested'
                       CHECK (status IN ('requested', 'linked', 'printed', 'cancelled')),
  driving_record_id  UUID REFERENCES driving_records(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dispatch_requests_usage_date ON dispatch_requests(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_requests_vehicle_id ON dispatch_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_requests_status     ON dispatch_requests(status);

-- RLS
ALTER TABLE dispatch_requests ENABLE ROW LEVEL SECURITY;

-- INSERT: 누구나(공개 신청 폼) — driving_records 정책과 동일
CREATE POLICY "dispatch_requests_insert_public" ON dispatch_requests
  FOR INSERT WITH CHECK (true);

-- SELECT: 활성 관리자(운영자/부서관리자)
CREATE POLICY "dispatch_requests_select_admin" ON dispatch_requests
  FOR SELECT USING (
    get_my_role() = 'system_operator' OR get_my_role() = 'department_manager'
  );

-- UPDATE: 활성 관리자
CREATE POLICY "dispatch_requests_update_admin" ON dispatch_requests
  FOR UPDATE USING (
    get_my_role() = 'system_operator' OR get_my_role() = 'department_manager'
  );

-- DELETE: 활성 관리자
CREATE POLICY "dispatch_requests_delete_admin" ON dispatch_requests
  FOR DELETE USING (
    get_my_role() = 'system_operator' OR get_my_role() = 'department_manager'
  );
