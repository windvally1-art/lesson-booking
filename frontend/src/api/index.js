import axios from 'axios'
import { supabase } from '../lib/supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
})

// 요청마다 Supabase JWT 자동 첨부
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// ── 시간 슬롯 ──────────────────────────────────────
export const slotsApi = {
  // 선생님의 슬롯 목록
  getByTeacher: (teacherId) =>
    api.get(`/api/slots?teacher_id=${teacherId}`).then(r => r.data),

  // 예약 가능한 슬롯 전체 (학생용)
  getAvailable: () =>
    api.get('/api/slots/available').then(r => r.data),

  create: (payload) =>
    api.post('/api/slots', payload).then(r => r.data),

  update: (id, payload) =>
    api.put(`/api/slots/${id}`, payload).then(r => r.data),

  remove: (id) =>
    api.delete(`/api/slots/${id}`).then(r => r.data),
}

// ── 푸쉬 알림 ─────────────────────────────────────
export const pushApi = {
  getVapidKey: () =>
    api.get('/api/push/vapid-key').then(r => r.data),

  subscribe: (subscription) =>
    api.post('/api/push/subscribe', { subscription }).then(r => r.data),

  unsubscribe: (endpoint) =>
    api.delete('/api/push/subscribe', { data: { endpoint } }).then(r => r.data),
}

// ── 예약 ──────────────────────────────────────────
export const bookingsApi = {
  getMyBookings: () =>
    api.get('/api/bookings/me').then(r => r.data),

  create: (payload) =>
    api.post('/api/bookings', payload).then(r => r.data),

  confirm: (id) =>
    api.patch(`/api/bookings/${id}/confirm`).then(r => r.data),

  cancel: (id) =>
    api.patch(`/api/bookings/${id}/cancel`).then(r => r.data),

  updateReminders: (id, reminders) =>
    api.patch(`/api/bookings/${id}/reminders`, reminders).then(r => r.data),
}
