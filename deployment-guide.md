# 🚀 SimpleFleet 프로덕션 배포 가이드

## 1단계: GitHub 저장소 설정

### GitHub 저장소 생성
1. https://github.com/new 접속
2. Repository name: `simplefleet`
3. Description: `Korean fleet management system with Next.js 14 and Supabase`
4. Public 선택
5. **중요:** README, .gitignore, license 체크하지 말고 빈 저장소로 생성

### 코드 푸시
```bash
# 이미 설정됨
git remote add origin https://github.com/Moosv/simplefleet.git
git branch -M main
git push -u origin main
```

## 2단계: Supabase 프로덕션 프로젝트

### 프로젝트 생성
1. https://supabase.com/dashboard 접속
2. "New project" 클릭
3. 설정:
   - **Name:** SimpleFleet Production
   - **Database Password:** 강력한 비밀번호 (잘 보관!)
   - **Region:** Northeast Asia (Seoul)
   - **Plan:** 무료 플랜

### 데이터베이스 스키마 설정
1. **SQL Editor** 접속
2. `database_schema.sql` 파일 내용을 복사해서 실행
3. 모든 테이블, RLS 정책, 인덱스가 생성됨

### 마스터 관리자 계정 생성
1. **Authentication > Users** 접속
2. "Add user" 클릭:
   - Email: `master@korea.kr`
   - Password: 강력한 비밀번호
3. **SQL Editor**에서 실행:
```sql
INSERT INTO drivers (user_id, name, email, role, department)
SELECT id, 'Master Admin', email, 'master_admin', 'System'
FROM auth.users
WHERE email = 'master@korea.kr';
```

### API 키 설정
1. **Settings > API** 접속
2. 다음 값들을 복사:
   - Project URL
   - anon/public key
   - service_role key (비공개)

## 3단계: 환경변수 설정

### .env.production 업데이트
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app-domain.vercel.app
NEXTAUTH_SECRET=your-production-secret-key-here
```

## 4단계: Vercel 배포

### Vercel 프로젝트 생성
1. https://vercel.com 접속
2. "Import Git Repository" 클릭
3. GitHub의 simplefleet 저장소 선택
4. Framework: Next.js 자동 감지
5. "Deploy" 클릭

### 환경변수 설정
Vercel Dashboard > Settings > Environment Variables에서:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`

### 도메인 설정
1. Vercel Dashboard > Domains
2. 커스텀 도메인 설정 (선택사항)
3. `.vercel.app` 도메인은 자동 제공

## 5단계: 최종 확인

### 애플리케이션 테스트
1. 배포된 URL에 접속
2. 마스터 관리자 로그인 테스트
3. 모든 기능 정상 작동 확인

### 보안 점검
- [x] RLS 정책 활성화
- [x] 환경변수 암호화
- [x] HTTPS 적용
- [x] 강력한 비밀번호 사용

## 6단계: 지속적 배포

### 자동 배포
- GitHub main 브랜치에 푸시할 때마다 자동 배포
- Vercel이 빌드/배포 자동 처리

### 모니터링
- Vercel Analytics (트래픽 모니터링)
- Supabase Dashboard (데이터베이스 모니터링)
- Next.js 내장 성능 메트릭

---

## 🔧 개발 vs 프로덕션 환경

| 구분 | 개발 환경 | 프로덕션 환경 |
|------|-----------|---------------|
| **데이터베이스** | Supabase 개발 프로젝트 | Supabase 프로덕션 프로젝트 |
| **도메인** | localhost:3000 | your-app.vercel.app |
| **환경변수** | .env.local | Vercel 환경변수 |
| **인증** | 테스트 계정 | 실제 관리자 계정 |
| **RLS** | 개발용 정책 | 프로덕션용 정책 |

## 📞 지원

- **기술 문서:** [Next.js 공식 문서](https://nextjs.org/docs)
- **Supabase 문서:** [Supabase 가이드](https://supabase.com/docs)
- **Vercel 배포:** [Vercel 문서](https://vercel.com/docs)

---

**🎉 배포 완료 후 SimpleFleet이 프로덕션 환경에서 정상 작동합니다!**