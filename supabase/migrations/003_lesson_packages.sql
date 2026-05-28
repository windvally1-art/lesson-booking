-- =============================================
-- 수업권 패키지 & 수업 완료 추적
-- =============================================

-- ① lesson_packages: 학생별 수업 패키지
CREATE TABLE public.lesson_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration_minutes  INT NOT NULL CHECK (duration_minutes IN (25, 50)),
  total_lessons     INT NOT NULL CHECK (total_lessons > 0),
  completed_lessons INT NOT NULL DEFAULT 0 CHECK (completed_lessons >= 0),
  label             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT completed_le_total CHECK (completed_lessons <= total_lessons)
);

-- ② bookings 테이블에 완료 관련 컬럼 추가
ALTER TABLE public.bookings
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN package_id   UUID REFERENCES public.lesson_packages(id) ON DELETE SET NULL;

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX idx_lesson_packages_student ON public.lesson_packages(student_id);
CREATE INDEX idx_lesson_packages_teacher ON public.lesson_packages(teacher_id);
CREATE INDEX idx_bookings_package_id     ON public.bookings(package_id);
CREATE INDEX idx_bookings_completed_at   ON public.bookings(completed_at);

-- =============================================
-- updated_at 트리거
-- =============================================
CREATE TRIGGER trg_lesson_packages_updated_at
  BEFORE UPDATE ON public.lesson_packages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.lesson_packages ENABLE ROW LEVEL SECURITY;

-- teacher/student 모두 자신의 패키지 조회 가능
CREATE POLICY "packages: view own"
  ON public.lesson_packages FOR SELECT
  USING (auth.uid() = teacher_id OR auth.uid() = student_id);

-- 선생님만 생성
CREATE POLICY "packages: teacher insert"
  ON public.lesson_packages FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- 선생님만 수정
CREATE POLICY "packages: teacher update"
  ON public.lesson_packages FOR UPDATE
  USING (auth.uid() = teacher_id);

-- 선생님만 삭제
CREATE POLICY "packages: teacher delete"
  ON public.lesson_packages FOR DELETE
  USING (auth.uid() = teacher_id);
