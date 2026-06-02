# 수업 예약 앱

1:1 수업 예약 시스템 — React + Vite 프론트엔드 / Node.js + Express 백엔드 / Supabase

## 주요 기능

- **선생님**: 수업 가능 슬롯 등록/수정/삭제, 예약 확정·수업 완료 처리, 학생별 수업권 패키지 관리
- **학생**: 날짜 스트립 캘린더로 슬롯 예약, 25분/50분 티켓 선택, 예약 내역 및 수업권 현황 확인
- **다국어**: 한국어 / 日本語 전환 지원 (i18next)
- **알림**: 이메일 리마인더(5분 간격 폴링), 브라우저 푸시 알림

## 폴더 구조

```
lesson-booking/
├── frontend/          # React + Vite + Tailwind CSS
│   └── src/
│       ├── api/           # axios 클라이언트
│       ├── components/
│       │   ├── auth/
│       │   ├── common/    # Navbar, PrivateRoute, PushPermission, ReminderSettings
│       │   ├── teacher/   # SlotManager, BookingList, PackageManager
│       │   └── student/   # BookingCalendar, BookingHistory, PackageStatus
│       ├── context/       # AuthContext (Supabase Auth)
│       ├── hooks/         # useDateLocale
│       ├── i18n.js        # i18next 설정
│       ├── lib/           # supabase 클라이언트
│       ├── locales/       # ko.json, ja.json
│       └── pages/
├── backend/           # Node.js + Express
│   └── src/
│       ├── lib/           # supabase 클라이언트 (service role)
│       ├── middleware/    # auth, errorHandler
│       ├── routes/        # slots, bookings, packages, push
│       └── services/      # emailService, reminderService
└── supabase/
    ├── migrations/    # 001~004 스키마 마이그레이션
    └── functions/     # send-reminder (Edge Function)
```

## DB 테이블

| 테이블 | 역할 |
|--------|------|
| `profiles` | auth.users 확장 — 이름, 역할(teacher/student) |
| `time_slots` | 선생님 가능 시간대 — EXCLUDE로 중복 방지 |
| `bookings` | 예약 — pending/confirmed/cancelled, `second_slot_id`(50분 연속 예약), `completed_at` |
| `lesson_packages` | 수업권 패키지 — 25분/50분, 총/완료 횟수, 학생-선생님 연결 |
| `push_subscriptions` | 브라우저 푸시 구독 정보 |
| `notifications` | 발송된 이메일 로그 |

## 시작하기

### 1. Supabase 설정

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. `Database > Extensions` 에서 **btree_gist** 활성화
3. `SQL Editor` 에서 `supabase/migrations/` 내 파일을 001→004 순서로 실행
4. `Project Settings > API` 에서 URL, anon key, service_role key 복사

### 2. 환경변수 설정

```bash
# 프론트엔드
cp frontend/.env.example frontend/.env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 입력

# 백엔드
cp backend/.env.example backend/.env
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_* 입력
```

### 3. 의존성 설치 및 실행

```bash
# 프론트엔드
cd frontend
npm install
npm run dev          # http://localhost:5173

# 백엔드 (별도 터미널)
cd backend
npm install
npm run dev          # http://localhost:4000
```

### 4. (선택) Supabase Edge Function 배포

```bash
npm install -g supabase
supabase login
supabase functions deploy send-reminder --project-ref <your-project-ref>
# 대시보드에서 RESEND_API_KEY secret 추가 후 Cron 설정: 0 9 * * *
```

## API 엔드포인트

### 슬롯

| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| `GET` | `/api/slots` | 선생님 | 내 슬롯 목록 |
| `GET` | `/api/slots/available` | 학생 | 예약 가능 슬롯 |
| `GET` | `/api/slots/all` | 학생 | 전체 슬롯 (타인 예약 포함, 캘린더용) |
| `POST` | `/api/slots` | 선생님 | 슬롯 추가 |
| `PUT` | `/api/slots/:id` | 선생님 | 슬롯 수정 |
| `DELETE` | `/api/slots/:id` | 선생님 | 슬롯 삭제 |

### 예약

| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| `GET` | `/api/bookings/me` | 공통 | 내 예약 목록 |
| `POST` | `/api/bookings` | 학생 | 예약 생성 (25분: 1슬롯, 50분: 연속 2슬롯) |
| `PATCH` | `/api/bookings/:id/confirm` | 선생님 | 예약 확정 |
| `PATCH` | `/api/bookings/:id/complete` | 선생님 | 수업 완료 처리 |
| `PATCH` | `/api/bookings/:id/cancel` | 공통 | 예약 취소 (학생: 수업 6시간 전까지) |
| `PATCH` | `/api/bookings/:id/reminders` | 학생 | 리마인더 설정 |

### 수업권 패키지

| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| `GET` | `/api/packages` | 공통 | 내 수업권 목록 |
| `GET` | `/api/packages/students` | 선생님 | 담당 학생 목록 |
| `POST` | `/api/packages` | 선생님 | 수업권 패키지 생성 |
| `PATCH` | `/api/packages/:id` | 선생님 | 수업권 수정 |
| `DELETE` | `/api/packages/:id` | 선생님 | 수업권 삭제 |

### 푸시 알림

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/push/vapid-key` | VAPID 공개키 조회 |
| `POST` | `/api/push/subscribe` | 푸시 구독 등록 |
| `DELETE` | `/api/push/subscribe` | 푸시 구독 해제 |
