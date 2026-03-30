import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// GET /api/slots/available — 학생용: 예약 가능한 슬롯 전체
router.get('/available', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('time_slots')
      .select('*, profiles!teacher_id(id, full_name)')
      .eq('is_available', true)
      .gte('start_time', new Date().toISOString())
      .order('start_time')

    if (error) throw error
    res.json(data)
  } catch (err) { next(err) }
})

// GET /api/slots?teacher_id=... — 선생님 본인 슬롯
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const teacherId = req.query.teacher_id || req.profile.id

    const { data, error } = await supabase
      .from('time_slots')
      .select(`
        *,
        bookings!slot_id(
          id, status,
          profiles!student_id(full_name)
        )
      `)
      .eq('teacher_id', teacherId)
      .order('start_time')

    if (error) throw error
    res.json(data)
  } catch (err) { next(err) }
})

// POST /api/slots — 선생님만 슬롯 추가
router.post('/', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { start_time, end_time } = req.body
    if (!start_time || !end_time) {
      return res.status(400).json({ error: 'start_time, end_time 필드가 필요합니다.' })
    }

    const { data, error } = await supabase
      .from('time_slots')
      .insert({ teacher_id: req.profile.id, start_time, end_time })
      .select()
      .single()

    if (error) {
      if (error.code === '23P01') {
        return res.status(409).json({ error: '이미 등록된 시간대와 겹칩니다.' })
      }
      throw error
    }
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// PUT /api/slots/:id — 선생님 슬롯 수정
router.put('/:id', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { start_time, end_time } = req.body

    const { data, error } = await supabase
      .from('time_slots')
      .update({ start_time, end_time })
      .eq('id', req.params.id)
      .eq('teacher_id', req.profile.id) // 본인 슬롯만
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: '슬롯을 찾을 수 없습니다.' })
    res.json(data)
  } catch (err) { next(err) }
})

// DELETE /api/slots/:id — 예약 없는 슬롯만 삭제
router.delete('/:id', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    // 예약된 슬롯인지 확인
    const { data: booking } = await supabase
      .from('bookings')
      .select('id')
      .eq('slot_id', req.params.id)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (booking) {
      return res.status(409).json({ error: '예약이 있는 슬롯은 삭제할 수 없습니다.' })
    }

    const { error } = await supabase
      .from('time_slots')
      .delete()
      .eq('id', req.params.id)
      .eq('teacher_id', req.profile.id)

    if (error) throw error
    res.status(204).send()
  } catch (err) { next(err) }
})

export default router
