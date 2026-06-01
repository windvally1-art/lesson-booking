import { useEffect, useState } from 'react'
import { format, addMinutes } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useDateLocale } from '../../hooks/useDateLocale'
import toast from 'react-hot-toast'
import { bookingsApi } from '../../api'
import ReminderSettings from '../common/ReminderSettings'

export default function BookingHistory() {
  const { t } = useTranslation()
  const dateLocale = useDateLocale()

  const STATUS_LABEL = {
    pending:   t('booking_history.status_pending'),
    confirmed: t('booking_history.status_confirmed'),
    cancelled: t('booking_history.status_cancelled'),
  }
  const STATUS_COLOR = {
    pending:   'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  const [bookings, setBookings]   = useState([])
  const [reminders, setReminders] = useState({})

  useEffect(() => { loadBookings() }, [])

  async function loadBookings() {
    try {
      const data = await bookingsApi.getMyBookings()
      const now  = new Date()
      setBookings(
        data
          .filter(b => new Date(b.time_slots.start_time) > now)
          .sort((a, b) => new Date(a.time_slots.start_time) - new Date(b.time_slots.start_time))
      )

      const init = {}
      data.forEach(b => {
        const p = b.notification_preferences
        init[b.id] = p
          ? { remind_1day: p.remind_1day, remind_1hour: p.remind_1hour, remind_10min: p.remind_10min }
          : { remind_1day: true, remind_1hour: true, remind_10min: true }
      })
      setReminders(init)
    } catch {
      toast.error(t('booking_history.error_load'))
    }
  }

  async function handleCancel(id) {
    if (!confirm(t('booking_history.cancel_confirm'))) return
    try {
      await bookingsApi.cancel(id)
      toast.success(t('booking_history.cancel_success'))
      loadBookings()
    } catch {
      toast.error(t('booking_history.cancel_error'))
    }
  }

  async function handleReminderChange(bookingId, newVal) {
    setReminders(p => ({ ...p, [bookingId]: newVal }))
    try {
      await bookingsApi.updateReminders(bookingId, newVal)
      toast.success(t('booking_history.reminder_saved'))
    } catch {
      toast.error(t('booking_history.reminder_error'))
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('booking_history.title')}</h3>

      <ul className="space-y-3 max-h-[500px] overflow-y-auto">
        {bookings.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">{t('booking_history.empty')}</p>
        )}

        {bookings.map(b => {
          const canCancel =
            b.status !== 'cancelled' &&
            new Date(b.time_slots.start_time) > new Date(Date.now() + 6 * 60 * 60 * 1000)
          return (
          <li key={b.id} className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[b.status]}`}>
                {STATUS_LABEL[b.status]}
              </span>
            </div>

            <p className="text-sm font-medium text-gray-800">
              {format(new Date(b.time_slots.start_time), t('booking_history.date_format'), { locale: dateLocale })}
              {' ~ '}
              {format(addMinutes(new Date(b.time_slots.start_time), b.second_slot ? 50 : 25), 'HH:mm')}
            </p>
            <p className="text-xs text-gray-500 mt-1">{t('booking_history.teacher_prefix')}: {b.teacher?.full_name}</p>
            {b.notes && <p className="text-xs text-gray-500 mt-1">{t('booking_history.memo_prefix')}: {b.notes}</p>}

            {b.status !== 'cancelled' && reminders[b.id] && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <ReminderSettings
                  value={reminders[b.id]}
                  onChange={val => handleReminderChange(b.id, val)}
                />
              </div>
            )}

            {canCancel && (
              <button
                onClick={() => handleCancel(b.id)}
                className="mt-3 text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                {t('booking_history.cancel_btn')}
              </button>
            )}
          </li>
          )
        })}
      </ul>
    </section>
  )
}
