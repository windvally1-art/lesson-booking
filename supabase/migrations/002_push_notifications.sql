-- =============================================
-- 푸쉬 알림 관련 테이블
-- =============================================

-- 브라우저 푸쉬 구독 정보 (기기별)
CREATE TABLE public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subs_user_id ON public.push_subscriptions(user_id);

-- 예약별 알림 설정 및 발송 여부
CREATE TABLE public.notification_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  remind_1day  BOOLEAN NOT NULL DEFAULT TRUE,
  remind_1hour BOOLEAN NOT NULL DEFAULT TRUE,
  remind_10min BOOLEAN NOT NULL DEFAULT TRUE,
  sent_1day    BOOLEAN NOT NULL DEFAULT FALSE,
  sent_1hour   BOOLEAN NOT NULL DEFAULT FALSE,
  sent_10min   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_prefs_booking ON public.notification_preferences(booking_id);

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.push_subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 본인 구독만 관리
CREATE POLICY "push_subs: own manage"
  ON public.push_subscriptions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 예약 당사자만 알림 설정 조회/수정
CREATE POLICY "notif_prefs: parties view"
  ON public.notification_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.student_id = auth.uid() OR b.teacher_id = auth.uid())
    )
  );

CREATE POLICY "notif_prefs: student insert"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.student_id = auth.uid()
    )
  );

CREATE POLICY "notif_prefs: student update"
  ON public.notification_preferences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.student_id = auth.uid()
    )
  );
