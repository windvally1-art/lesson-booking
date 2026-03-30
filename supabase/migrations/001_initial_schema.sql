-- =============================================
-- 1:1 수업 예약 앱 초기 스키마
-- =============================================

-- ① profiles: auth.users 확장 (역할 포함)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ② time_slots: 선생님이 등록한 가능 시간대
CREATE TABLE public.time_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    teacher_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
);

-- ③ bookings: 학생의 예약
CREATE TABLE public.bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id     UUID NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ④ notifications: 발송된 이메일 로그
CREATE TABLE public.notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('confirmation', 'reminder', 'cancellation')),
  recipient_email  TEXT NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX idx_time_slots_teacher_id  ON public.time_slots(teacher_id);
CREATE INDEX idx_time_slots_start_time  ON public.time_slots(start_time);
CREATE INDEX idx_bookings_student_id    ON public.bookings(student_id);
CREATE INDEX idx_bookings_teacher_id    ON public.bookings(teacher_id);
CREATE INDEX idx_bookings_slot_id       ON public.bookings(slot_id);
CREATE INDEX idx_bookings_status        ON public.bookings(status);
CREATE INDEX idx_notifications_booking  ON public.notifications(booking_id);

-- =============================================
-- updated_at 자동 갱신 트리거
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 신규 유저 가입 시 profiles 자동 생성 트리거
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RLS (Row Level Security)
-- =============================================
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 수정, 전체 조회 가능
CREATE POLICY "profiles: anyone can view"
  ON public.profiles FOR SELECT USING (TRUE);

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- time_slots: 모두 조회 가능, 선생님만 CUD
CREATE POLICY "slots: anyone can view"
  ON public.time_slots FOR SELECT USING (TRUE);

CREATE POLICY "slots: teacher insert"
  ON public.time_slots FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

CREATE POLICY "slots: teacher update"
  ON public.time_slots FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY "slots: teacher delete"
  ON public.time_slots FOR DELETE
  USING (auth.uid() = teacher_id);

-- bookings: 관련 당사자만 조회/수정
CREATE POLICY "bookings: own view"
  ON public.bookings FOR SELECT
  USING (auth.uid() = student_id OR auth.uid() = teacher_id);

CREATE POLICY "bookings: student insert"
  ON public.bookings FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'student'
    )
  );

CREATE POLICY "bookings: parties update"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = student_id OR auth.uid() = teacher_id);

-- notifications: 관련 예약 당사자만 조회
CREATE POLICY "notifications: booking parties view"
  ON public.notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.student_id = auth.uid() OR b.teacher_id = auth.uid())
    )
  );

-- =============================================
-- btree_gist 확장 (EXCLUDE 제약에 필요)
-- =============================================
-- Supabase 대시보드 > Database > Extensions 에서 활성화 필요:
-- CREATE EXTENSION IF NOT EXISTS btree_gist;
