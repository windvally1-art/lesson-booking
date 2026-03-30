import cron from 'node-cron'
import { addMinutes, addHours } from 'date-fns'
import { supabase } from '../lib/supabase.js'
import { sendBookingEmail } from './emailService.js'
import { sendPushToUser } from './pushService.js'

// 알림 단계 정의
const REMINDER_STAGES = [
  {
    key:       '1day',
    label:     '1일 전',
    sentCol:   'sent_1day',
    enableCol: 'remind_1day',
    minutesBefore: 24 * 60,
    windowMin: 5,         // ±5분 윈도우
  },
  {
    key:       '1hour',
    label:     '1시간 전',
    sentCol:   'sent_1hour',
    enableCol: 'remind_1hour',
    minutesBefore: 60,
    windowMin: 5,
  },
  {
    key:       '10min',
    label:     '10분 전',
    sentCol:   'sent_10min',
    enableCol: 'remind_10min',
    minutesBefore: 10,
    windowMin: 3,
  },
]

async function processStage(stage, now) {
  const target = addMinutes(now, stage.minutesBefore)
  const from   = addMinutes(target, -stage.windowMin)
  const until  = addMinutes(target,  stage.windowMin)

  // 아직 발송 안 된 확정 예약 조회
  const { data: prefs, error } = await supabase
    .from('notification_preferences')
    .select(`
      id, booking_id,
      ${stage.enableCol}, ${stage.sentCol},
      bookings (
        id, student_id, teacher_id, status,
        time_slots ( start_time ),
        student:profiles!student_id ( full_name, email ),
        teacher:profiles!teacher_id ( full_name, email )
      )
    `)
    .eq(stage.sentCol, false)
    .eq(stage.enableCol, true)

  if (error) { console.error(`[Reminder:${stage.key}] 조회 오류:`, error); return }

  const targets = (prefs ?? []).filter(p => {
    const booking = p.bookings
    if (!booking || booking.status !== 'confirmed') return false
    const start = new Date(booking.time_slots?.start_time)
    return start >= from && start <= until
  })

  for (const pref of targets) {
    const booking = pref.bookings
    const startTime = new Date(booking.time_slots.start_time)
      .toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

    const payload = {
      title: `📚 수업 ${stage.label} 알림`,
      body:  `${startTime} 수업이 ${stage.label}로 다가왔습니다.`,
      tag:   `lesson-${booking.id}-${stage.key}`,
      url:   '/',
    }

    // 학생 & 선생님 푸쉬 발송
    await Promise.all([
      sendPushToUser(booking.student_id, payload),
      sendPushToUser(booking.teacher_id, payload),
    ])

    // 이메일 리마인더 (1일 전만)
    if (stage.key === '1day') {
      if (booking.student) sendBookingEmail('reminder', booking, booking.student).catch(console.error)
      if (booking.teacher) sendBookingEmail('reminder', booking, booking.teacher).catch(console.error)
    }

    // 발송 완료 표시
    await supabase
      .from('notification_preferences')
      .update({ [stage.sentCol]: true })
      .eq('id', pref.id)

    console.log(`[Reminder:${stage.key}] booking=${booking.id} 발송 완료`)
  }
}

// 5분마다 실행
export function startReminderJob() {
  cron.schedule('*/5 * * * *', async () => {
    const now = new Date()
    for (const stage of REMINDER_STAGES) {
      await processStage(stage, now).catch(err =>
        console.error(`[Reminder:${stage.key}] 오류:`, err.message)
      )
    }
  })
  console.log('[Reminder] 리마인더 작업 등록 완료 (5분 간격)')
}
