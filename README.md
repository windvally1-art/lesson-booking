# 수업 예약 앱

1:1 수업 예약 시스템 — React + Vite 프론트엔드 / Node.js + Express 백엔드 / Supabase

## 폴더 구조

```
lesson-booking/
├── frontend/          # React + Vite + Tailwind CSS
│   └── src/
│       ├── api/           # axios 클라이언트
│       ├── components/
│       │   ├── auth/
│       │   ├── common/    # Navbar, PrivateRoute
│       │   ├── teacher/   # SlotManager, BookingList
│       │   └── student/   # BookingCalendar, BookingHistory
│       ├── context/       # AuthContext (Supabase Auth)
│       ├── lib/           # supabase 클라이언트
│       └── pages/
├── backend/           # Node.js + Express
│   └── src/
│       ├── lib/           # supabase 클라이언트 (service role)
│       ├── middleware/    # auth, errorHandler
│       ├── routes/        # slots, bookings
│       └── services/      # emailService, reminderService
└── supabase/
    ├── migrations/    # 001_initial_schema.sql
    └── functions/     # send-reminder (Edge Function)
```

## DB 테이블

| 테이블 | 역할 |
|--------|------|
| `profiles` | auth.users 확장 — 이름, 역할(teacher/student) |
| `time_slots` | 선생님 가능 시간대 — EXCLUDE로 중복 방지 |
| `bookings` | 예약 — pending/confirmed/cancelled |
| `notifications` | 발송된 이메일 로그 |

## 시작하기

### 1. Supabase 설정

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. `Database > Extensions` 에서 **btree_gist** 활성화
3. `SQL Editor` 에서 `supabase/migrations/001_initial_schema.sql` 실행
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

### 슬롯 (선생님)
| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/slots` | 내 슬롯 목록 |
| `GET` | `/api/slots/available` | 예약 가능 슬롯 (학생용) |
| `POST` | `/api/slots` | 슬롯 추가 |
| `PUT` | `/api/slots/:id` | 슬롯 수정 |
| `DELETE` | `/api/slots/:id` | 슬롯 삭제 |

### 예약
| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/bookings/me` | 내 예약 목록 |
| `POST` | `/api/bookings` | 예약 생성 (학생) |
| `PATCH` | `/api/bookings/:id/confirm` | 예약 확정 (선생님) |
| `PATCH` | `/api/bookings/:id/cancel` | 예약 취소 |
