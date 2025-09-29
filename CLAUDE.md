# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SimpleFleet is a Next.js 14-based fleet management system for tracking official vehicle usage. It's designed as a mobile-first web application with Korean UI for government/corporate vehicle management with complete Supabase integration.

## Key Technologies

- **Next.js 14 App Router**: Server Components are prioritized throughout
- **Supabase**: Complete backend integration (Auth, Database, RLS policies)
- **shadcn/ui + Tailwind CSS**: Design system with neutral color palette 
- **TypeScript**: Strict typing across all components
- **Lucide React**: Icon library for consistent UI

## Commands

```bash
# Development server (may use different port if 3000 is occupied)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Application Architecture

### Routing Structure
- `/` - Redirects to `/auth/login`
- `/auth/login` - Dual authentication system (Admin + Simple user login)
- `/(dashboard)/` - Layout group with shared navigation and authentication
  - `/records/new` - Mobile-optimized driving record form with Supabase integration
  - `/reports` - Statistics, analytics and CRUD operations for driving records
  - `/admin` - Complete admin system with role-based permissions

### Authentication System

**Dual Login System**:
1. **관리자 로그인**: Email(@korea.kr) + Password via Supabase Auth
2. **일반 사용자 로그인**: Name + Department selection via localStorage

**Role-Based Access Control**:
- `master_admin`: Full system access, can modify all user data including roles
- `admin`: Limited admin access, can only modify department and vehicle info
- `user`: Basic user access for personal driving records
- `pending_admin`: Waiting for admin approval

### Key Components

**Navigation System (`/src/components/navigation.tsx`)**
- Responsive sidebar with role-based menu items
- Real-time permission checking
- Dual authentication support

**Admin System (`/src/app/(dashboard)/admin/page.tsx`)**
- Complete user management with granular permissions
- Department management with real-time updates
- Role-based UI restrictions and visual indicators

### Database Schema (Supabase)

```sql
-- drivers table (User Management)
CREATE TABLE drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'master_admin', 'pending_admin')),
  main_vehicle_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- driving_records table (Driving Records)
CREATE TABLE driving_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  driver_name TEXT,
  department TEXT,
  start_date DATE,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  vehicle_number TEXT,
  start_odometer INTEGER,
  end_odometer INTEGER,
  total_distance INTEGER,
  destination TEXT,
  purpose TEXT,
  passengers INTEGER,
  fuel_cost INTEGER,
  toll_cost INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### RLS Policies

```sql
-- Allow public read for login verification
CREATE POLICY "Allow public read for login verification" 
ON drivers FOR SELECT USING (true);

-- Users can view their own driving records
CREATE POLICY "Users can view own records" 
ON driving_records FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can view all records
CREATE POLICY "Admins can view all records" 
ON driving_records FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM drivers 
  WHERE user_id = auth.uid() 
  AND role IN ('admin', 'master_admin')
));
```

### Permission System

**마스터 관리자 (Master Admin)**:
- ✅ 사용자 이름 수정
- ✅ 소속부서 수정  
- ✅ 주 차량번호 수정
- ✅ 사용자 권한 수정
- ✅ 사용자 삭제
- ✅ 부서 생성/수정/삭제
- ✅ 모든 운행기록 수정/삭제

**일반 관리자 (Admin)**:
- 🔒 사용자 이름 수정 불가
- ✅ 소속부서 수정
- ✅ 주 차량번호 수정  
- 🔒 사용자 권한 수정 불가
- 🔒 사용자 삭제 불가
- ✅ 부서 수정 (삭제 불가)
- ✅ 모든 운행기록 수정/삭제

**일반 사용자 (User)**:
- 🔒 관리자 페이지 접근 불가
- ✅ 개인 운행기록 작성
- ✅ 개인 운행기록 조회
- ✅ 개인 통계 확인

## Key Features Implemented

### 🚀 2025-09-17: Complete Admin System with Role Restrictions

#### 1. 권한 기반 UI 시스템
- **시각적 권한 표시**: ✅ (수정 가능), 🔒 (수정 불가) 아이콘
- **동적 UI 제한**: 일반 관리자는 권한 관련 기능 비활성화
- **마스터 전용 기능**: 이름 수정, 권한 관리, 사용자 삭제

#### 2. 운행기록 CRUD 시스템
- **관리자 전용**: 모든 운행기록 수정/삭제 기능
- **실시간 업데이트**: Supabase와 완전 연동
- **폼 검증**: 필수 입력 사항 검증 및 날짜 유효성 검사

#### 3. 완성된 인증 시스템
- **듀얼 로그인**: 관리자(이메일+비밀번호) + 일반사용자(이름+부서)
- **세션 관리**: Supabase Auth + localStorage 혼합 방식
- **권한 동기화**: drivers 테이블과 auth.users 메타데이터 동기화

#### 4. 부서 관리 시스템
- **동적 부서 목록**: 실제 사용자 데이터 기반 부서 생성
- **사용자 수 추적**: 부서별 소속 인원 실시간 표시
- **마스터 전용 삭제**: 일반 관리자는 수정만 가능

## Development Notes

- **포트**: 기본 3000, 점유시 3001 사용
- **폰트**: Geist font family (sans and mono variants)
- **인증 리다이렉트**: 미인증 사용자는 `/auth/login`으로 자동 이동
- **한국어**: 모든 UI 텍스트 및 에러 메시지 한국어 지원

## System Initialization Guide

### 새 환경 구축 시:

1. **Supabase 프로젝트 생성**
2. **마스터 관리자 계정 생성**:
   ```sql
   -- Supabase Dashboard > Authentication > Users에서 추가
   -- Email: master@korea.kr
   -- Password: [원하는 비밀번호]
   ```

3. **데이터베이스 테이블 생성** (위 스키마 참조)

4. **RLS 정책 설정** (위 정책 참조)

5. **마스터 관리자를 drivers 테이블에 추가**:
   ```sql
   INSERT INTO drivers (user_id, name, email, role, department)
   SELECT id, 'Master Admin', email, 'master_admin', 'System'
   FROM auth.users 
   WHERE email = 'master@korea.kr';
   ```

## Security Features

- **RLS 정책**: 테이블 수준 보안
- **역할 기반 접근**: UI와 API 모두 권한 검증
- **세션 관리**: 자동 로그아웃 및 권한 재검증
- **입력 검증**: 모든 폼 데이터 서버사이드 검증

## UI/UX Highlights

- **모바일 우선**: 반응형 디자인
- **직관적 권한 표시**: 아이콘으로 수정 가능/불가능 구분
- **실시간 피드백**: 성공/에러 메시지 즉시 표시
- **일관된 디자인**: shadcn/ui 기반 통일된 컴포넌트

---

## 구현 완료된 주요 기능

✅ **인증 시스템**: 듀얼 로그인 + 역할 기반 접근 제어  
✅ **관리자 시스템**: 완전한 사용자 관리 + 권한 제한  
✅ **운행기록**: CRUD 작업 + 폼 검증  
✅ **부서 관리**: 동적 생성 + 실시간 통계  
✅ **권한 시스템**: 마스터/일반 관리자 구분 + UI 제한  
✅ **데이터베이스**: Supabase 완전 연동 + RLS 정책  

시스템이 프로덕션 준비 상태로 구현되었습니다.1