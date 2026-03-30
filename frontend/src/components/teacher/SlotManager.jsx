import { useEffect, useState, useMemo } from 'react'
import { format, startOfWeek, addDays, addWeeks, subWeeks,
         isSameDay, isToday, startOfMonth, endOfMonth,
         addMonths, subMonths, getDay, getDaysInMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { slotsApi } from '../../api'

// 30분 단위 시간 슬롯 (00:00 ~ 23:30)
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const WEEK_DAY_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEK_DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

export default function SlotManager() {
  const { profile } = useAuth()
  const [slots, setSlots]           = useState([])
  const [activeTab, setActiveTab]   = useState('일정')
  const [baseDate, setBaseDate]     = useState(new Date())
  const [weekStart, setWeekStart]   = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  )
  const [showCalendar, setShowCalendar] = useState(false)
  // 대기 중인 변경사항: 추가할 셀 키 Set, 삭제할 슬롯 ID Set
  const [pendingAdd, setPendingAdd]       = useState(new Set()) // "dayISO|time"
  const [pendingDelete, setPendingDelete] = useState(new Set()) // slot.id
  const [saving, setSaving]               = useState(false)

  const hasPending = pendingAdd.size > 0 || pendingDelete.size > 0

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  useEffect(() => { if (profile) loadSlots() }, [profile])

  async function loadSlots() {
    try {
      setSlots(await slotsApi.getByTeacher(profile.id))
    } catch {
      toast.error('슬롯을 불러오지 못했습니다.')
    }
  }

  // 셀 고유 키 — 날짜를 타임스탬프(ms)로 저장해 UTC/로컬 변환 오류 방지
  function cellKey(day, time) {
    return `${day.getTime()}|${time}`
  }

  function findSlot(day, time) {
    return slots.find(s => {
      const d = new Date(s.start_time)
      return isSameDay(d, day) && format(d, 'HH:mm') === time
    })
  }

  function handleCellClick(day, time) {
    const existing = findSlot(day, time)
    const key = cellKey(day, time)

    if (existing) {
      if (!existing.is_available) return // 예약된 슬롯은 변경 불가
      setPendingDelete(prev => {
        const next = new Set(prev)
        // 이미 삭제 대기 중이면 취소
        next.has(existing.id) ? next.delete(existing.id) : next.add(existing.id)
        return next
      })
    } else {
      setPendingAdd(prev => {
        const next = new Set(prev)
        // 이미 추가 대기 중이면 취소
        next.has(key) ? next.delete(key) : next.add(key)
        return next
      })
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      // 삭제 처리
      await Promise.all(
        [...pendingDelete].map(id => slotsApi.remove(id))
      )
      // 추가 처리
      await Promise.all(
        [...pendingAdd].map(key => {
          const [ts, time] = key.split('|')
          const [h, m] = time.split(':').map(Number)
          const start = new Date(Number(ts)); start.setHours(h, m, 0, 0)
          const end   = new Date(start);      end.setMinutes(end.getMinutes() + 30)
          return slotsApi.create({
            teacher_id: profile.id,
            start_time: start.toISOString(),
            end_time:   end.toISOString(),
          })
        })
      )
      setPendingAdd(new Set())
      setPendingDelete(new Set())
      await loadSlots()
      toast.success('저장되었습니다.')
    } catch (err) {
      toast.error(err.response?.data?.error || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  function isPast(day, time) {
    const [h, m] = time.split(':').map(Number)
    const d = new Date(day); d.setHours(h, m, 0, 0)
    return d < new Date()
  }

  function jumpToDate(date) {
    setBaseDate(date)
    setWeekStart(startOfWeek(date, { weekStartsOn: 0 }))
    setShowCalendar(false)
  }

  // ── 월 달력 계산 ──────────────────────────────────────
  const monthStart     = startOfMonth(baseDate)
  const startDow       = getDay(monthStart)
  const totalDays      = getDaysInMonth(baseDate)
  const calendarCells  = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) =>
      new Date(baseDate.getFullYear(), baseDate.getMonth(), i + 1)
    ),
  ]

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="flex items-center px-4 py-3 border-b border-gray-100">
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm select-none">
          ‹
        </div>
        <h2 className="flex-1 text-center text-base font-semibold text-gray-800">
          수업 일정 편집
        </h2>
        <div className="w-8" />
      </div>

      {/* ── 탭 ── */}
      <div className="flex border-b border-gray-100">
        {['일정', '고정 일정'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-teal-500 border-b-2 border-teal-500 -mb-px'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── 주간 뷰 ── */}
      <div className="relative overflow-auto" style={{ maxHeight: 600 }}>

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
                  isToday(day)
                    ? 'text-red-500'
                    : 'text-gray-700'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 달력 오버레이 ── */}
        {showCalendar && (
          <div className="absolute inset-x-0 bottom-0 bg-white border-t border-gray-100 px-4 pt-4 pb-5 z-20 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setBaseDate(d => subMonths(d, 1))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-teal-50 text-teal-500 font-bold text-sm"
              >
                ‹
              </button>
              <h3 className="text-base font-bold text-gray-800">
                {format(baseDate, 'yyyy년 M월')}
              </h3>
              <button
                onClick={() => setBaseDate(d => addMonths(d, 1))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-teal-50 text-teal-500 font-bold text-sm"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAY_KO.map(d => (
                <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {calendarCells.map((date, i) => {
                if (!date) return <div key={`e-${i}`} />
                const selected = isSameDay(date, baseDate)
                const today    = isToday(date)
                return (
                  <div
                    key={i}
                    onClick={() => jumpToDate(date)}
                    className="flex items-center justify-center cursor-pointer"
                  >
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors
                      ${selected ? 'bg-teal-400 text-white font-bold'
                        : today   ? 'text-red-500 font-bold hover:bg-teal-50'
                        :           'text-gray-400 hover:bg-teal-50'}
                    `}>
                      {date.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 시간 그리드 */}
        {TIME_SLOTS.map((time) => {
          const isHour = time.endsWith(':00')
          return (
            <div key={time} className={`flex ${isHour ? 'border-t border-gray-100' : ''}`}>
              {/* 시간 레이블 */}
              <div className="w-14 shrink-0 text-[12px] text-gray-400 text-right pr-2 pt-1 leading-none">
                {isHour ? time : ''}
              </div>
              {/* 셀 */}
              {weekDays.map((day, di) => {
                const slot        = findSlot(day, time)
                const key          = cellKey(day, time)
                const past         = isPast(day, time)
                const activeBooking = slot?.bookings?.find(b => b.status !== 'cancelled')
                const isPending    = activeBooking?.status === 'pending'
                const isConfirmed  = activeBooking?.status === 'confirmed'
                const booked       = slot && !slot.is_available
                const toDelete     = slot && pendingDelete.has(slot.id)
                const toAdd        = !slot && pendingAdd.has(key)
                const savedActive  = slot && !toDelete
                const studentName  = activeBooking?.profiles?.full_name ?? ''
                return (
                  <div
                    key={di}
                    onClick={() => !past && handleCellClick(day, time)}
                    title={
                      past        ? '지난 시간'
                      : isPending   ? `신청중: ${studentName}`
                      : isConfirmed ? `확정: ${studentName}`
                      : '클릭하여 토글'
                    }
                    className={`relative flex-1 h-6 border-l border-gray-100 transition-colors overflow-hidden ${
                      past && (isPending || isConfirmed) ? 'bg-gray-300 cursor-default'
                      : past      ? 'bg-gray-100 cursor-default'
                      : isPending   ? 'bg-yellow-200 cursor-not-allowed'
                      : isConfirmed ? 'bg-green-300 cursor-not-allowed'
                      : toDelete  ? 'bg-red-200 cursor-pointer'
                      : toAdd     ? 'bg-teal-200 cursor-pointer'
                      : savedActive ? 'bg-teal-400 cursor-pointer'
                      : 'hover:bg-teal-50 cursor-pointer'
                    }`}
                  >
                    {(isPending || isConfirmed) && studentName && (
                      <span className={`absolute inset-0 flex items-center px-0.5 text-[10px] font-medium leading-none truncate ${past ? 'text-gray-500' : 'text-gray-700'}`}>
                        {studentName}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── 범례 + 저장 버튼 ── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-teal-400 inline-block" />
            등록됨
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-teal-200 inline-block" />
            추가 예정
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-200 inline-block" />
            삭제 예정
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" />
            신청중
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-green-300 inline-block" />
            확정
          </span>
        </div>
        {hasPending && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-4 px-5 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 disabled:opacity-50 transition-colors shrink-0"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        )}
      </div>
    </section>
  )
}
