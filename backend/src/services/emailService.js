import nodemailer from 'nodemailer'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { supabase } from '../lib/supabase.js'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

function formatSlotTime(slot) {
  return `${format(new Date(slot.start_time), 'M월 d일 (EEE) HH:mm', { locale: ko })} ~ ${format(new Date(slot.end_time), 'HH:mm')}`
}

const templates = {
  confirmation: (booking, actor) => ({
    to: actor.email,
    subject: '[수업예약] 예약 요청이 접수되었습니다',
    html: `
      <h2>예약 요청 완료</h2>
      <p>안녕하세요, <strong>${actor.full_name}</strong>님!</p>
      <p>아래 수업 예약이 접수되었습니다.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">시간</td><td><strong>${formatSlotTime(booking.time_slots)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">선생님</td><td>${booking.teacher?.full_name}</td></tr>
        ${booking.notes ? `<tr><td style="padding:4px 12px 4px 0;color:#666">메모</td><td>${booking.notes}</td></tr>` : ''}
      </table>
      <p>선생님의 확정을 기다려 주세요.</p>
    `,
  }),

  confirmation_teacher: (booking, actor) => ({
    to: booking.profiles?.email,
    subject: '[수업예약] 수업이 확정되었습니다',
    html: `
      <h2>수업 확정 안내</h2>
      <p>안녕하세요!</p>
      <p><strong>${actor.full_name}</strong> 선생님이 수업을 확정하였습니다.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">시간</td><td><strong>${formatSlotTime(booking.time_slots)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">선생님</td><td>${actor.full_name}</td></tr>
      </table>
      <p>수업 당일 잊지 말고 참석해 주세요!</p>
    `,
  }),

  cancellation: (booking, actor) => ({
    to: actor.email,
    subject: '[수업예약] 예약이 취소되었습니다',
    html: `
      <h2>예약 취소 안내</h2>
      <p>예약이 취소되었음을 알려드립니다.</p>
      <p>취소자: <strong>${actor.full_name}</strong></p>
    `,
  }),

  reminder: (booking, recipient) => ({
    to: recipient.email,
    subject: '[수업예약] 내일 수업 리마인더',
    html: `
      <h2>내일 수업 리마인더</h2>
      <p>안녕하세요, <strong>${recipient.full_name}</strong>님!</p>
      <p>내일 수업이 있습니다.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">시간</td><td><strong>${formatSlotTime(booking.time_slots)}</strong></td></tr>
      </table>
    `,
  }),
}

export async function sendBookingEmail(type, booking, actor) {
  const template = templates[type]
  if (!template) return

  const { to, subject, html } = template(booking, actor)
  if (!to) return

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  })

  // 발송 로그 기록
  await supabase.from('notifications').insert({
    booking_id:      booking.id,
    type:            type.startsWith('confirmation') ? 'confirmation' : type,
    recipient_email: to,
  })
}
