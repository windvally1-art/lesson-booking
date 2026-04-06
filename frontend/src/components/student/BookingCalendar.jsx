import { useEffect, useState, useMemo, useRef } from 'react'
import {
  format, isSameDay, isToday, startOfMonth, getDay,
  getDaysInMonth, addMonths, subMonths, startOfWeek, addDays,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { slotsApi, bookingsApi } from '../../api'
import PushPermission from '../common/PushPermission'
import ReminderSettings from '../common/ReminderSettings'

const TIME_SLOTS   = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})
const WEEK_DAY_EN  = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEK_DAY_KO  = ['일', '월', '화', '수', '목', '금', '토']
const DEFAULT_REMINDERS = { remind_1day: true, remind_1hour: true, remind_10min: true }

export default function BookingCalendar() {
  const [slots, setSlots]               = useState([])
  const [myBookings, setMyBookings]     = useState([])
  const [baseDate, setBaseDate]         = useState(new Date())
  const [weekStart, setWeekStart]       = useState(startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [notes, setNotes]               = useState('')
  const [reminders, setReminders]       = useState(DEFAULT_REMINDERS)
  const [submitting, setSubmitting]     = useState(false)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const gridRef = useRef(null)

  useEffect(() => {
    if (!gridRef.current) return
    const now = new Date()
    const slotIndex = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0)
    const ROW_H = 24 // h-6 = 24px
    gridRef.current.scrollTop = Math.max(0, (slotIndex - 3) * ROW_H)
  }, [])

  useEffect(() => { loadSlots() }, [])

  async function loadSlots() {
    try {
      const [available, bookings] = await Promise.all([
        slotsApi.getAvailable(),
        bookingsApi.getMyBookings(),
      ])
      setSlots(available)
      setMyBookings(bookings.filter(b => b.status !== 'cancelled'))
    } catch { toast.error('데이터를 불러오지 못했습니다.') }
  }

  function isPast(day, time) {
    const [h, m] = time.split(':').map(Number)
    const d = new Date(day); d.setHours(h, m, 0, 0)
    return d < new Date()
  }

  function findMyBooking(day, time) {
    return myBookings.find(b => {
      const d = new Date(b.time_slots.start_time)
      return isSameDay(d, day) && format(d, 'HH:mm') === time
    })
  }

  function findSlot(day, time) {
    return slots.find(s => {
      const d = new Date(s.start_time)
      return isSameDay(d, day) && format(d, 'HH:mm') === time
    })
  }

  function handleCellClick(day, time) {
    const slot = findSlot(day, time)
    if (!slot) return
    setSelectedSlot(prev => prev?.id === slot.id ? null : slot)
  }

  function jumpToDate(date) {
    setBaseDate(date)
    setWeekStart(startOfWeek(date, { weekStartsOn: 0 }))
    setShowCalendar(false)
  }

  async function handleBook() {
    if (!selectedSlot) return
    setSubmitting(true)
    try {
      await bookingsApi.create({
        slot_id:    selectedSlot.id,
        teacher_id: selectedSlot.teacher_id,
        notes,
        reminders,
      })
      toast.success('예약 요청이 전송되었습니다!')
      setSelectedSlot(null)
      setNotes('')
      setReminders(DEFAULT_REMINDERS)
      loadSlots()
    } catch (err) {
      toast.error(err.response?.data?.error || '예약에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 월 달력 계산 ────────────────────────────────
  function hasSlotOnDate(date) {
    return slots.some(s => isSameDay(new Date(s.start_time), date))
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

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">수업 예약</h2>
        <PushPermission />
      </div>

      {/* ── 주간 그리드 ── */}
      <div ref={gridRef} className="relative overflow-auto" style={{ maxHeight: 600 }}>

        {/* 스티키 헤더 */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
          <button
            onClick={() => setShowCalendar(p => !p)}
            className="pl-14 pr-1 pt-2 pb-1 text-sm font-semibold text-gray-700 flex items-center gap-1 hover:text-teal-500 transition-colors"
          >
            {format(weekStart, 'M월', { locale: ko })}
            <span className={`text-base transition-transform duration-200 ${showCalendar ? 'rotate-180' : ''}`}>▾</span>
          </button>
          <div className="flex pl-14 pr-1">
            {weekDays.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center py-1">
                <span className="text-[12px] text-gray-400">{WEEK_DAY_EN[i]}</span>
                <span className={`text-sm font-semibold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday(day) ? 'text-red-500' : 'text-gray-700'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 달력 오버레이 */}
        {showCalendar && (
          <div className="absolute inset-x-0 bottom-0 bg-white border-t border-gray-100 px-4 pt-4 pb-5 z-20 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setBaseDate(d => subMonths(d, 1))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-teal-50 text-teal-500 font-bold text-sm">‹</button>
              <h3 className="text-base font-bold text-gray-800">{format(baseDate, 'yyyy년 M월')}</h3>
              <button onClick={() => setBaseDate(d => addMonths(d, 1))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-teal-50 text-teal-500 font-bold text-sm">›</button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAY_KO.map(d => (
                <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {calendarCells.map((date, i) => {
                if (!date) return <div key={`e-${i}`} />
                const selected  = isSameDay(date, baseDate)
                const today     = isToday(date)
                const hasAvail  = hasSlotOnDate(date)
                return (
                  <div key={i} onClick={() => jumpToDate(date)}
                    className="flex flex-col items-center cursor-pointer">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors
                      ${selected ? 'bg-teal-400 text-white font-bold'
                      : today   ? 'text-red-500 font-bold hover:bg-teal-50'
                      :           'text-gray-400 hover:bg-teal-50'}
                    `}>{date.getDate()}</span>
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${hasAvail ? 'bg-teal-400' : 'invisible'}`} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 시간 그리드 */}
        {TIME_SLOTS.map(time => {
          const isHour = time.endsWith(':00')
          return (
            <div key={time} className={`flex ${isHour ? 'border-t border-gray-100' : ''}`}>
              <div className="w-14 shrink-0 text-[12px] text-gray-400 text-right pr-2 pt-1 leading-none">
                {isHour ? time : ''}
              </div>
              {weekDays.map((day, di) => {
                const past       = isPast(day, time)
                const slot       = findSlot(day, time)
                const myBooking  = findMyBooking(day, time)
                const isPending  = myBooking?.status === 'pending'
                const isConfirmed = myBooking?.status === 'confirmed'
                const isSelected = !!(selectedSlot && slot && selectedSlot.id === slot.id)
                return (
                  <div
                    key={di}
                    onClick={() => !past && !myBooking && handleCellClick(day, time)}
                    title={
                      past        ? '지난 시간'
                      : isPending   ? '내 예약 신청중'
                      : isConfirmed ? '예약 확정됨'
                      : slot      ? '클릭하여 선택'
                      : undefined
                    }
                    className={`flex-1 h-6 border-l border-gray-100 transition-colors ${
                      past && myBooking ? 'bg-gray-300 cursor-default'
                      : past        ? 'bg-gray-100 cursor-default'
                      : isPending   ? 'bg-yellow-300 cursor-default'
                      : isConfirmed ? 'bg-green-400 cursor-default'
                      : isSelected  ? 'bg-teal-600 cursor-pointer'
                      : slot        ? 'bg-teal-300 cursor-pointer hover:bg-teal-400'
                      :               ''
                    }`}
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── 범례 ── */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-teal-300 inline-block" />예약 가능</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-teal-600 inline-block" />선택됨</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-300 inline-block" />신청중</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />확정</span>
      </div>

      {/* ── 예약 패널 ── */}
      {selectedSlot && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-teal-50">
          <p className="text-sm font-semibold text-teal-700">
            {format(new Date(selectedSlot.start_time), 'M월 d일 (EEE) HH:mm', { locale: ko })}
            {' ~ '}
            {format(new Date(selectedSlot.end_time), 'HH:mm')}
            <span className="ml-2 font-normal text-teal-600 text-xs">{selectedSlot.profiles?.full_name} 선생님</span>
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="선생님께 전할 메모 (선택)"
            rows={2}
            className="w-full border border-teal-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          />
          <ReminderSettings value={reminders} onChange={setReminders} />
          <button
            onClick={handleBook}
            disabled={submitting}
            className="w-full bg-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? '예약 중...' : '예약 신청하기'}
          </button>
        </div>
      )}
    </section>
  )
}
