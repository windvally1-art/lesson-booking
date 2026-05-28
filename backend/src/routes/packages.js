import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// GET /api/packages/students — 선생님의 학생 목록 (예약 이력이 있는)
router.get('/students', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('student_id, profiles!student_id(id, full_name, email)')
      .eq('teacher_id', req.profile.id)
      .neq('status', 'cancelled')

    if (error) throw error

    // 중복 제거
    const seen = new Set()
    const students = []
    for (const b of data) {
      if (b.profiles && !seen.has(b.profiles.id)) {
        seen.add(b.profiles.id)
        students.push(b.profiles)
      }
    }

    res.json(students)
  } catch (err) { next(err) }
})

// GET /api/packages — 패키지 목록
// teacher: 자신의 학생 패키지 전체
// student: 자신의 패키지
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isTeacher = req.profile.role === 'teacher'
    const filterCol = isTeacher ? 'teacher_id' : 'student_id'

    const { data, error } = await supabase
      .from('lesson_packages')
      .select(`
        *,
        student:profiles!student_id(id, full_name, email),
        teacher:profiles!teacher_id(id, full_name, email)
      `)
      .eq(filterCol, req.profile.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) { next(err) }
})

// POST /api/packages — 선생님이 패키지 생성
router.post('/', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { student_id, duration_minutes, total_lessons, label, initial_completed } = req.body

    if (!student_id || !duration_minutes || !total_lessons) {
      return res.status(400).json({ error: 'student_id, duration_minutes, total_lessons 필드가 필요합니다.' })
    }
    if (![25, 50].includes(Number(duration_minutes))) {
      return res.status(400).json({ error: 'duration_minutes 은 25 또는 50 이어야 합니다.' })
    }

    const completedInit = Math.min(Number(initial_completed ?? 0), Number(total_lessons))

    const { data, error } = await supabase
      .from('lesson_packages')
      .insert({
        student_id,
        teacher_id:        req.profile.id,
        duration_minutes:  Number(duration_minutes),
        total_lessons:     Number(total_lessons),
        completed_lessons: completedInit,
        label: label ?? null,
      })
      .select(`*, student:profiles!student_id(id, full_name, email)`)
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// PATCH /api/packages/:id — 선생님이 패키지 수정 (수업 횟수 추가, label 변경)
router.patch('/:id', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { add_lessons, total_lessons, label, is_active } = req.body

    // 현재 값 조회
    const { data: existing, error: fetchErr } = await supabase
      .from('lesson_packages')
      .select('*')
      .eq('id', req.params.id)
      .eq('teacher_id', req.profile.id)
      .single()

    if (fetchErr || !existing) {
      return res.status(404).json({ error: '패키지를 찾을 수 없습니다.' })
    }

    const updates = {}
    if (add_lessons != null) {
      updates.total_lessons = existing.total_lessons + Number(add_lessons)
    } else if (total_lessons != null) {
      if (Number(total_lessons) < existing.completed_lessons) {
        return res.status(400).json({ error: '총 수업 수가 완료된 수업보다 적을 수 없습니다.' })
      }
      updates.total_lessons = Number(total_lessons)
    }
    if (label !== undefined) updates.label = label
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await supabase
      .from('lesson_packages')
      .update(updates)
      .eq('id', req.params.id)
      .select(`*, student:profiles!student_id(id, full_name, email)`)
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) { next(err) }
})

// DELETE /api/packages/:id — 선생님이 패키지 삭제
router.delete('/:id', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('lesson_packages')
      .delete()
      .eq('id', req.params.id)
      .eq('teacher_id', req.profile.id)

    if (error) throw error
    res.status(204).end()
  } catch (err) { next(err) }
})

export default router
