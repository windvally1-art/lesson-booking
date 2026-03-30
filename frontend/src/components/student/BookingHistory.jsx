import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { bookingsApi } from '../../api'
import ReminderSettings from '../common/ReminderSettings'

const STATUS_LABEL = { pending: '대기중', confirmed: '확정', cancelled: '취소됨' }
const STATUS_COLOR = {
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function BookingHistory() {
  const [bookings, setBookings]   = useState([])
  const [reminders, setReminders] = useState({})

  useEffect(() => { loadBookings() }, [])

  async function loadBookings() {
    try {
      const data = await bookingsApi.getMyBookings()
      const now  = new Date()
      setBookings(data.filter(b => new Date(b.time_slots.start_time) > now))

      const init = {}
      data.forEach(b => {
        const p = b.notification_preferences
        init[b.id] = p
          ? { remind_1day: p.remind_1day, remind_1hour: p.remind_1hour, remind_10min: p.remind_10min }
          : { remind_1day: true, remind_1hour: true, remind_10min: true }
      })
      setReminders(init)
    } catch {
      toast.error('예약 내역을 불러오지 못했습니다.')
    }
  }

  async function handleCancel(id) {
    if (!confirm('예약을 취소하시겠습니까?')) return
    try {
      await bookingsApi.cancel(id)
      toast.success('예약이 취소되었습니다.')
      loadBookings()
    } catch {
      toast.error('취소에 실패했습니다.')
    }
  }

  async function handleReminderChange(bookingId, newVal) {
    setReminders(p => ({ ...p, [bookingId]: newVal }))
    try {
      await bookingsApi.updateReminders(bookingId, newVal)
      toast.success('알림 설정이 저장되었습니다.')
    } catch {
      toast.error('알림 설정 저장에 실패했습니다.')
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">예약 내역</h3>

      <ul className="space-y-3 max-h-[500px] overflow-y-auto">
        {bookings.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">예약 내역이 없습니다.</p>
        )}

        {bookings.map(b => (
          <li key={b.id} className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[b.status]}`}>
                {STATUS_LABEL[b.status]}
              </span>
            </div>

            <p className="text-sm font-medium text-gray-800">
              {format(new Date(b.time_slots.start_time), 'M월 d일 (EEE) HH:mm', { locale: ko })}
              {' ~ '}
              {format(new Date(b.time_slots.end_time), 'HH:mm')}
            </p>
            <p className="text-xs text-gray-500 mt-1">선생님: {b.teacher?.full_name}</p>
            {b.notes && <p className="text-xs text-gray-500 mt-1">메모: {b.notes}</p>}

            {b.status !== 'cancelled' && reminders[b.id] && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <ReminderSettings
                  value={reminders[b.id]}
                  onChange={val => handleReminderChange(b.id, val)}
                />
              </div>
            )}

            {b.status !== 'cancelled' && (
              <button
                onClick={() => handleCancel(b.id)}
                className="mt-3 text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                취소하기
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
