import { useEffect, useState, useMemo, useRef } from 'react'
import { format, startOfWeek, addDays, addWeeks, subWeeks,
         isSameDay, isToday, startOfMonth, endOfMonth,
         addMonths, subMonths, getDay, getDaysInMonth } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useDateLocale } from '../../hooks/useDateLocale'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { slotsApi } from '../../api'

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})


const TABS = ['schedule', 'fixed']

export default function SlotManager() {
  const { profile } = useAuth()
  const { t } = useTranslation()
  const dateLocale = useDateLocale()

  const [slots, setSlots]           = useState([])
  const [activeTab, setActiveTab]   = useState('schedule')
  const [baseDate, setBaseDate]     = useState(new Date())
  const [weekStart, setWeekStart]   = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  )
  const [showCalendar, setShowCalendar] = useState(false)
  const [pendingAdd, setPendingAdd]       = useState(new Set())
  const [pendingDelete, setPendingDelete] = useState(new Set())
  const [saving, setSaving]               = useState(false)

  const hasPending = pendingAdd.size > 0 || pendingDelete.size > 0
  const gridRef = useRef(null)

  useEffect(() => {
    if (!gridRef.current) return
    const now = new Date()
    const slotIndex = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0)
    const ROW_H = 24
    gridRef.current.scrollTop = Math.max(0, (slotIndex - 3) * ROW_H)
  }, [])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  useEffect(() => { if (profile) loadSlots() }, [profile])

  async function loadSlots() {
    try {
      setSlots(await slotsApi.getByTeacher(profile.id))
    } catch {
      toast.error(t('slot_manager.error_load'))
    }
  }

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
      if (!existing.is_available) return
      setPendingDelete(prev => {
        const next = new Set(prev)
        next.has(existing.id) ? next.delete(existing.id) : next.add(existing.id)
        return next
      })
    } else {
      setPendingAdd(prev => {
        const next = new Set(prev)
        next.has(key) ? next.delete(key) : next.add(key)
        return next
      })
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all(
        [...pendingDelete].map(id => slotsApi.remove(id))
      )
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
      toast.success(t('slot_manager.save_success'))
    } catch (err) {
      toast.error(err.response?.data?.error || t('slot_manager.save_error'))
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

  const monthStart     = startOfMonth(baseDate)
  const startDow       = getDay(monthStart)
  const totalDays      = getDaysInMonth(baseDate)
  const calendarCells  = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) =>
      new Date(baseDate.getFullYear(), baseDate.getMonth(), i + 1)
    ),
  ]

  const weekDayLabels = t('slot_manager.week_days', { returnObjects: true })

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">

      <div className="flex items-center px-4 py-3 border-b border-gray-100">
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm select-none">
          ‹
        </div>
        <h2 className="flex-1 text-center text-base font-semibold text-gray-800">
          {t('slot_manager.title')}
        </h2>
        <div className="w-8" />
      </div>

      <div className="flex border-b border-gray-100">
        {TABS.map(tabId => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tabId
                ? 'text-teal-500 border-b-2 border-teal-500 -mb-px'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t(`slot_manager.tab_${tabId}`)}
          </button>
        ))}
      </div>

      <div ref={gridRef} className="relative overflow-auto" style={{ maxHeight: 600 }}>

        <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
          <button
            onClick={() => setShowCalendar(p => !p)}
            className="pl-14 pr-1 pt-2 pb-1 text-sm font-semibold text-gray-700 flex items-center gap-1 hover:text-teal-500 transition-colors"
          >
            {format(weekStart, t('slot_manager.date_month'), { locale: dateLocale })}
            <span className={`text-base transition-transform duration-200 ${showCalendar ? 'rotate-180' : ''}`}>▾</span>
          </button>
          <div className="flex pl-14 pr-1">
            {weekDays.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center py-1">
                <span className="text-[13px] text-gray-400">{weekDayLabels[i]}</span>
                <span className={`text-sm font-semibold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday(day) ? 'text-red-500' : 'text-gray-700'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>
            ))}
          </div>
        </div>

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
                {format(baseDate, t('slot_manager.date_full'))}
              </h3>
              <button
                onClick={() => setBaseDate(d => addMonths(d, 1))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-teal-50 text-teal-500 font-bold text-sm"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {weekDayLabels.map(d => (
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

        {TIME_SLOTS.map((time) => {
          const isHour = time.endsWith(':00')
          return (
            <div key={time} className={`flex ${isHour ? 'border-t border-gray-100' : ''}`}>
              <div className="w-14 shrink-0 text-[12px] text-gray-400 text-right pr-2 pt-1 leading-none">
                {isHour ? time : ''}
              </div>
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
                      past        ? t('slot_manager.past')
                      : isPending   ? `${t('slot_manager.pending_prefix')}: ${studentName}`
                      : isConfirmed ? `${t('slot_manager.confirmed_prefix')}: ${studentName}`
                      : t('slot_manager.toggle')
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

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-teal-400 inline-block" />
            {t('slot_manager.legend_saved')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-teal-200 inline-block" />
            {t('slot_manager.legend_add')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-200 inline-block" />
            {t('slot_manager.legend_delete')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" />
            {t('slot_manager.legend_pending')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-green-300 inline-block" />
            {t('slot_manager.legend_confirmed')}
          </span>
        </div>
        {hasPending && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-4 px-5 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 disabled:opacity-50 transition-colors shrink-0"
          >
            {saving ? t('slot_manager.save_loading') : t('slot_manager.save_btn')}
          </button>
        )}
      </div>
    </section>
  )
}
