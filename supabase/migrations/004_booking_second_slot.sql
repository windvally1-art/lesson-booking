-- 50분 수업 예약 시 두 번째 슬롯을 저장하기 위한 컬럼 추가
ALTER TABLE public.bookings
  ADD COLUMN second_slot_id UUID REFERENCES public.time_slots(id) ON DELETE SET NULL;
