// Supabase Edge Function — 리마인더 이메일
// 배포: supabase functions deploy send-reminder
// 스케줄: Supabase 대시보드 > Edge Functions > Cron 에서 매일 09:00 설정
// cron expression: 0 9 * * *

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (_req) => {
  const now   = new Date()
  const from  = new Date(now.getTime() + 20 * 60 * 60 * 1000)
  const until = new Date(now.getTime() + 28 * 60 * 60 * 1000)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      time_slots(*),
      student:profiles!student_id(full_name, email),
      teacher:profiles!teacher_id(full_name, email)
    `)
    .eq('status', 'confirmed')
    .gte('time_slots.start_time', from.toISOString())
    .lte('time_slots.start_time', until.toISOString())

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 })
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
  let sent = 0

  for (const booking of bookings ?? []) {
    const { data: alreadySent } = await supabase
      .from('notifications')
      .select('id')
      .eq('booking_id', booking.id)
      .eq('type', 'reminder')
      .maybeSingle()

    if (alreadySent) continue

    for (const recipient of [booking.student, booking.teacher]) {
      if (!recipient?.email) continue

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'onboarding@resend.dev',
          to:      recipient.email,
          subject: '[수업예약] 내일 수업 리마인더',
          html:    `<h2>내일 수업이 있습니다!</h2><p>${recipient.full_name}님, 수업을 잊지 마세요.</p>`,
        }),
      })

      await supabase.from('notifications').insert({
        booking_id:      booking.id,
        type:            'reminder',
        recipient_email: recipient.email,
      })
    }
    sent++
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
