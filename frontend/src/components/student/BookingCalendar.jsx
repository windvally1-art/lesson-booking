import { useEffect, useState, useMemo } from 'react'
import {
  format, isSameDay, isToday, startOfMonth, getDay,
  getDaysInMonth, addMonths, subMonths, startOfWeek, addDays,
} from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useDateLocale } from '../../hooks/useDateLocale'
import toast from 'react-hot-toast'
import { slotsApi, bookingsApi, packagesApi } from '../../api'
import PushPermission from '../common/PushPermission'
import ReminderSettings from '../common/ReminderSettings'

const DEFAULT_REMINDERS = { remind_1day: true, remind_1hour: true, remind_10min: true }

export default function BookingCalendar() {
  const { t } = useTranslation()
  const dateLocale = useDateLocale()

  const [allSlots, setAllSlots]                         = useState([])
  const [myBookings, setMyBookings]                     = useState([])
  const [packages, setPackages]                         = useState([])
  const [baseDate, setBaseDate]                         = useState(new Date())
  const [weekStart, setWeekStart]                       = useState(startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [selectedDate, setSelectedDate]                 = useState(new Date())
  const [showCalendar, setShowCalendar]                 = useState(false)
  const [selectedSlot, setSelectedSlot]                 = useState(null)
  const [selectedSecondSlot, setSelectedSecondSlot]     = useState(null)
  const [selectedDuration, setSelectedDuration]         = useState(null)
  const [pendingSlot, setPendingSlot]                   = useState(null)
  const [showDurationPicker, setShowDurationPicker]     = useState(false)
  const [slotExceedError, setSlotExceedError]           = useState(false)
  const [notes, setNotes]                               = useState('')
  const [reminders, setReminders]                       = useState(DEFAULT_REMINDERS)
  const [submitting, setSubmitting]                     = useState(false)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const remaining25 = useMemo(() =>
    packages
      .filter(p => p.is_active && p.duration_minutes === 25)
      .reduce((sum, p) => sum + Math.max(0, p.total_lessons - p.completed_lessons), 0),
    [packages]
  )
  const remaining50 = useMemo(() =>
    packages
      .filter(p => p.is_active && p.duration_minutes === 50)
      .reduce((sum, p) => sum + Math.max(0, p.total_lessons - p.completed_lessons), 0),
    [packages]
  )

  const selectedDateSlots = useMemo(() =>
    allSlots
      .filter(s => isSameDay(new Date(s.start_time), selectedDate))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    [allSlots, selectedDate]
  )

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [all, bookings, pkgs] = await Promise.all([
        slotsApi.getAll(),
        bookingsApi.getMyBookings(),
        packagesApi.list(),
      ])
      setAllSlots(all)
      setMyBookings(bookings.filter(b => b.status !== 'cancelled'))
      setPackages(pkgs)
    } catch { toast.error(t('booking_calendar.error_load')) }
  }

  function findMyBookingBySlot(slot) {
    return myBookings.find(b =>
      b.slot_id === slot.id || b.second_slot_id === slot.id
    )
  }

  function findNextSlot(slot) {
    const endMs = new Date(slot.end_time).getTime()
    return allSlots.find(s =>
      s.is_available &&
      new Date(s.start_time).getTime() === endMs &&
      s.teacher_id === slot.teacher_id
    ) ?? null
  }

  function hasSlotOnDate(date) {
    return allSlots.some(s => isSameDay(new Date(s.start_time), date))
  }

  function clearSelection() {
    setSelectedSlot(null)
    setSelectedSecondSlot(null)
    setSelectedDuration(null)
    setSlotExceedError(false)
  }

  function selectFor25Min(slot) {
    setSelectedSlot(slot)
    setSelectedSecondSlot(null)
    setSelectedDuration(25)
    setSlotExceedError(false)
    setShowDurationPicker(false)
    setPendingSlot(null)
  }

  function selectFor50Min(slot) {
    const nextSlot = findNextSlot(slot)
    if (!nextSlot) {
      clearSelection()
      setSlotExceedError(true)
      setShowDurationPicker(false)
      setPendingSlot(null)
      return
    }
    setSelectedSlot(slot)
    setSelectedSecondSlot(nextSlot)
    setSelectedDuration(50)
    setSlotExceedError(false)
    setShowDurationPicker(false)
    setPendingSlot(null)
  }

  function handleSlotClick(slot) {
    if (selectedSlot?.id === slot.id || selectedSecondSlot?.id === slot.id) {
      clearSelection()
      return
    }
    if (!slot.is_available || findMyBookingBySlot(slot)) return

    setSlotExceedError(false)
    const has25 = remaining25 > 0
    const has50 = remaining50 > 0
    if (has25 && has50) {
      setPendingSlot(slot)
      setShowDurationPicker(true)
    } else if (has50) {
      selectFor50Min(slot)
    } else {
      selectFor25Min(slot)
    }
  }

  function jumpToDate(date) {
    setBaseDate(date)
    setWeekStart(startOfWeek(date, { weekStartsOn: 0 }))
    setSelectedDate(date)
    setShowCalendar(false)
  }

  async function handleBook() {
    if (!selectedSlot) return
    setSubmitting(true)
    try {
      await bookingsApi.create({
        slot_id:        selectedSlot.id,
        teacher_id:     selectedSlot.teacher_id,
        second_slot_id: selectedSecondSlot?.id ?? null,
        notes,
        reminders,
      })
      toast.success(t('booking_calendar.book_success'))
      clearSelection()
      setNotes('')
      setReminders(DEFAULT_REMINDERS)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || t('booking_calendar.book_error'))
    } finally {
      setSubmitting(false)
    }
  }

  const calendarCells = useMemo(() => {
    const startDow = getDay(startOfMonth(baseDate))
    const total    = getDaysInMonth(baseDate)
    return [
      ...Array(startDow).fill(null),
      ...Array.from({ length: total }, (_, i) =>
        new Date(baseDate.getFullYear(), baseDate.getMonth(), i + 1)
      ),
    ]
  }, [baseDate])

  const weekDayLabels = t('booking_calendar.week_days', { returnObjects: true })

  const displayEndTime = selectedSecondSlot
    ? format(new Date(selectedSecondSlot.end_time), 'HH:mm')
    : selectedSlot
      ? format(new Date(selectedSlot.end_time), 'HH:mm')
      : null

  return (
    <section className="bg-white rounded-2xl shadow-sm">

      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">{t('booking_calendar.title')}</h2>
        <PushPermission />
      </div>

      {/* Duration picker */}
      {showDurationPicker && pendingSlot && (
        <div className="border-b border-gray-100 px-4 py-4 bg-amber-50">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            {t('booking_calendar.ticket_select_title')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => selectFor25Min(pendingSlot)}
              className="flex-1 py-2 rounded-xl border-2 border-sky-400 text-sky-700 bg-sky-50 text-sm font-semibold hover:bg-sky-100 transition-colors"
            >
              {t('booking_calendar.ticket_25min', { count: remaining25 })}
            </button>
            <button
              onClick={() => selectFor50Min(pendingSlot)}
              className="flex-1 py-2 rounded-xl border-2 border-violet-400 text-violet-700 bg-violet-50 text-sm font-semibold hover:bg-violet-100 transition-colors"
            >
              {t('booking_calendar.ticket_50min', { count: remaining50 })}
            </button>
            <button
              onClick={() => { setShowDurationPicker(false); setPendingSlot(null) }}
              className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors"
            >
              {t('booking_calendar.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* 슬롯 초과 에러 */}
      {slotExceedError && (
        <div className="border-b border-red-100 px-4 py-3 bg-red-50 text-sm text-red-600 font-medium">
          {t('booking_calendar.slot_exceed_error')}
        </div>
      )}

      {/* 날짜 선택 영역 */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        {/* 주간 이동 + 월 표시 */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setWeekStart(d => addDays(d, -7))}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-teal-50 text-teal-500 font-bold"
          >‹</button>
          <button
            onClick={() => setShowCalendar(p => !p)}
            className="text-sm font-semibold text-gray-700 flex items-center gap-1 hover:text-teal-500 transition-colors"
          >
            {format(selectedDate, t('booking_calendar.date_month'), { locale: dateLocale })}
            <span className={`text-base transition-transform duration-200 ${showCalendar ? 'rotate-180' : ''}`}>▾</span>
          </button>
          <button
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-teal-50 text-teal-500 font-bold"
          >›</button>
        </div>

        {/* 7일 날짜 스트립 */}
        <div className="flex gap-1">
          {weekDays.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate)
            const today      = isToday(day)
            const hasSlot    = hasSlotOnDate(day)
            return (
              <button
                key={i}
                onClick={() => { setSelectedDate(day); setBaseDate(day) }}
                className={`flex-1 flex flex-col items-center py-1.5 rounded-xl transition-colors ${
                  isSelected ? 'bg-teal-500' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`text-[11px] ${isSelected ? 'text-teal-100' : 'text-gray-400'}`}>
                  {weekDayLabels[i]}
                </span>
                <span className={`text-sm font-semibold mt-0.5 ${
                  isSelected ? 'text-white'
                  : today    ? 'text-red-500'
                  :            'text-gray-700'
                }`}>
                  {format(day, 'd')}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                  hasSlot ? (isSelected ? 'bg-teal-200' : 'bg-teal-400') : 'invisible'
                }`} />
              </button>
            )
          })}
        </div>

        {/* 월간 달력 팝업 */}
        {showCalendar && (
          <div className="mt-3 border-t border-gray-100 pt-4 pb-2">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setBaseDate(d => subMonths(d, 1))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-teal-50 text-teal-500 font-bold text-sm">‹</button>
              <h3 className="flex-1 text-center text-base font-bold text-gray-800">
                {format(baseDate, t('booking_calendar.date_full'))}
              </h3>
              <button onClick={() => setBaseDate(d => addMonths(d, 1))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-teal-50 text-teal-500 font-bold text-sm">›</button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {weekDayLabels.map(d => (
                <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {calendarCells.map((date, i) => {
                if (!date) return <div key={`e-${i}`} />
                const selected = isSameDay(date, selectedDate)
                const today    = isToday(date)
                const hasAvail = hasSlotOnDate(date)
                return (
                  <div key={i} onClick={() => jumpToDate(date)}
                    className="flex flex-col items-center cursor-pointer">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors
                      ${selected ? 'bg-teal-400 text-white font-bold'
                      : today    ? 'text-red-500 font-bold hover:bg-teal-50'
                      :            'text-gray-600 hover:bg-teal-50'}
                    `}>{date.getDate()}</span>
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${hasAvail ? 'bg-teal-400' : 'invisible'}`} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 시간 목록 */}
      <div className="px-4 py-3 min-h-[120px]">
        {selectedDateSlots.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('booking_calendar.no_slots')}</p>
        ) : (
          <ul className="space-y-1">
            {selectedDateSlots.map(slot => {
              const time        = format(new Date(slot.start_time), 'HH:mm')
              const myBooking   = findMyBookingBySlot(slot)
              const isPending   = myBooking?.status === 'pending'
              const isConfirmed = myBooking?.status === 'confirmed'
              const isSelected  = selectedSlot?.id === slot.id || selectedSecondSlot?.id === slot.id
              const isAvailable = slot.is_available && !myBooking

              const textClass = isSelected
                ? 'text-teal-800 font-bold bg-teal-50'
                : isPending
                  ? 'text-yellow-600 font-medium cursor-default'
                  : isConfirmed
                    ? 'text-green-600 font-medium cursor-default'
                    : isAvailable
                      ? 'text-teal-600 font-medium hover:text-teal-800 hover:bg-teal-50 cursor-pointer'
                      : 'text-gray-400 cursor-default'

              return (
                <li key={slot.id}>
                  <button
                    onClick={() => handleSlotClick(slot)}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-colors ${textClass}`}
                  >
                    <span>{time}</span>
                    {isPending   && <span className="ml-2 text-xs opacity-70">{t('booking_calendar.my_pending')}</span>}
                    {isConfirmed && <span className="ml-2 text-xs opacity-70">{t('booking_calendar.confirmed')}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 flex-wrap px-4 py-2 border-t border-gray-100 text-xs">
        <span className="text-teal-600 font-medium">{t('booking_calendar.legend_available')}</span>
        <span className="text-teal-800 font-bold">{t('booking_calendar.legend_selected')}</span>
        <span className="text-yellow-600 font-medium">{t('booking_calendar.legend_pending')}</span>
        <span className="text-green-600 font-medium">{t('booking_calendar.legend_confirmed')}</span>
        <span className="text-gray-400">{t('booking_calendar.legend_unavailable')}</span>
      </div>

      {/* 선택된 슬롯 정보 + 예약 폼 */}
      {selectedSlot && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-teal-50 rounded-b-2xl">
          <p className="text-sm font-semibold text-teal-700">
            {format(new Date(selectedSlot.start_time), t('booking_calendar.date_slot'), { locale: dateLocale })}
            {' ~ '}
            {displayEndTime}
            {selectedDuration && (
              <span className="ml-2 text-xs font-normal text-teal-500">({selectedDuration}분)</span>
            )}
            <span className="ml-2 font-normal text-teal-600 text-xs">
              {selectedSlot.profiles?.full_name} {t('booking_calendar.teacher_suffix')}
            </span>
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('booking_calendar.notes_placeholder')}
            rows={2}
            className="w-full border border-teal-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          />
          <ReminderSettings value={reminders} onChange={setReminders} />
          <button
            onClick={handleBook}
            disabled={submitting}
            className="w-full bg-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? t('booking_calendar.book_loading') : t('booking_calendar.book_submit')}
          </button>
        </div>
      )}
    </section>
  )
}
