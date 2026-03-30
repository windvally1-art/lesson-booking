import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { sendBookingEmail } from '../services/emailService.js'

const router = Router()

// GET /api/bookings/me — 본인 예약 목록 (역할에 따라)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const isTeacher = req.profile.role === 'teacher'
    const filterCol = isTeacher ? 'teacher_id' : 'student_id'

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        time_slots(*),
        profiles!student_id(id, full_name, email),
        teacher:profiles!teacher_id(id, full_name, email),
        notification_preferences(remind_1day, remind_1hour, remind_10min)
      `)
      .eq(filterCol, req.profile.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) { next(err) }
})

// POST /api/bookings — 학생이 예약 생성
router.post('/', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const { slot_id, teacher_id, notes, reminders } = req.body
    if (!slot_id || !teacher_id) {
      return res.status(400).json({ error: 'slot_id, teacher_id 필드가 필요합니다.' })
    }

    // 슬롯 가용 여부 확인
    const { data: slot } = await supabase
      .from('time_slots')
      .select('*')
      .eq('id', slot_id)
      .eq('is_available', true)
      .single()

    if (!slot) {
      return res.status(409).json({ error: '이미 예약된 슬롯이거나 존재하지 않습니다.' })
    }

    // 예약 생성 + 슬롯 비활성화 (트랜잭션 대신 순차 처리)
    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .insert({
        slot_id,
        student_id: req.profile.id,
        teacher_id,
        notes,
      })
      .select(`*, time_slots(*), teacher:profiles!teacher_id(full_name, email)`)
      .single()

    if (bookErr) throw bookErr

    await supabase
      .from('time_slots')
      .update({ is_available: false })
      .eq('id', slot_id)

    // 알림 설정 저장 (기본값: 모두 ON)
    const { error: prefErr } = await supabase.from('notification_preferences').insert({
      booking_id:   booking.id,
      remind_1day:  reminders?.remind_1day  ?? true,
      remind_1hour: reminders?.remind_1hour ?? true,
      remind_10min: reminders?.remind_10min ?? true,
    })
    if (prefErr) console.error('[Booking] 알림 설정 저장 오류:', prefErr)

    // 이메일 알림 (비동기, 실패해도 응답에 영향 없음)
    sendBookingEmail('confirmation', booking, req.profile).catch(console.error)

    res.status(201).json(booking)
  } catch (err) { next(err) }
})

// PATCH /api/bookings/:id/confirm — 선생님이 확정
router.patch('/:id/confirm', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', req.params.id)
      .eq('teacher_id', req.profile.id)
      .eq('status', 'pending')
      .select(`*, time_slots(*), profiles!student_id(full_name, email)`)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' })

    sendBookingEmail('confirmation_teacher', data, req.profile).catch(console.error)

    res.json(data)
  } catch (err) { next(err) }
})

// PATCH /api/bookings/:id/reminders — 알림 설정 변경 (학생)
router.patch('/:id/reminders', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const { remind_1day, remind_1hour, remind_10min } = req.body
    const { data, error } = await supabase
      .from('notification_preferences')
      .update({ remind_1day, remind_1hour, remind_10min })
      .eq('booking_id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) { next(err) }
})

// PATCH /api/bookings/:id/cancel — 양쪽 모두 취소 가능
router.patch('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (!existing) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' })

    const isParty =
      existing.student_id === req.profile.id ||
      existing.teacher_id === req.profile.id

    if (!isParty) return res.status(403).json({ error: '권한이 없습니다.' })
    if (existing.status === 'cancelled') {
      return res.status(409).json({ error: '이미 취소된 예약입니다.' })
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error

    // 슬롯 다시 활성화
    await supabase
      .from('time_slots')
      .update({ is_available: true })
      .eq('id', existing.slot_id)

    sendBookingEmail('cancellation', data, req.profile).catch(console.error)

    res.json(data)
  } catch (err) { next(err) }
})

export default router
