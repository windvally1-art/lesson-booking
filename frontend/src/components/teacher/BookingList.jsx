import { useEffect, useState } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useDateLocale } from '../../hooks/useDateLocale'
import toast from 'react-hot-toast'
import { bookingsApi, packagesApi } from '../../api'

function inferDuration(startTime, endTime) {
  const mins = differenceInMinutes(new Date(endTime), new Date(startTime))
  if (Math.abs(mins - 25) <= 5) return 25
  if (Math.abs(mins - 50) <= 5) return 50
  return null
}

function BookingItem({ b, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const dateLocale = useDateLocale()

  const STATUS_LABEL = {
    pending:   t('booking_list.status_pending'),
    confirmed: t('booking_list.status_confirmed'),
    cancelled: t('booking_list.status_cancelled'),
  }
  const STATUS_COLOR = {
    pending:   'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  return (
    <li className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[b.status]}`}>
          {STATUS_LABEL[b.status]}
        </span>
        <span className="text-xs text-gray-400">
          {format(new Date(b.created_at), 'M/d HH:mm')}
        </span>
      </div>

      <p className="text-sm font-medium text-gray-800">
        {format(new Date(b.time_slots.start_time), t('booking_list.date_format'), { locale: dateLocale })}
        {' ~ '}
        {format(new Date(b.time_slots.end_time), 'HH:mm')}
      </p>
      <p className="text-xs mt-1 text-gray-500">{t('booking_list.student_prefix')}: {b.profiles?.full_name}</p>
      {b.notes && <p className="text-xs mt-1 text-gray-500">{t('booking_list.memo_prefix')}: {b.notes}</p>}

      {b.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onConfirm(b.id)}
            className="flex-1 text-xs bg-green-500 text-white py-1.5 rounded-lg hover:bg-green-600 transition-colors"
          >
            {t('booking_list.confirm_btn')}
          </button>
          <button
            onClick={() => onCancel(b.id)}
            className="flex-1 text-xs bg-red-400 text-white py-1.5 rounded-lg hover:bg-red-500 transition-colors"
          >
            {t('booking_list.reject_btn')}
          </button>
        </div>
      )}
      {b.status === 'confirmed' && (
        <button
          onClick={() => onCancel(b.id)}
          className="mt-3 w-full text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          {t('booking_list.cancel_btn')}
        </button>
      )}
    </li>
  )
}

function CompleteItem({ b, packages, onComplete }) {
  const { t } = useTranslation()
  const dateLocale = useDateLocale()
  const duration  = inferDuration(b.time_slots.start_time, b.time_slots.end_time)
  const studentId = b.profiles?.id ?? b.student_id

  const studentPkgs = packages.filter(p => p.student?.id === studentId && p.is_active)
  const matchedPkgs = duration
    ? studentPkgs.filter(p => p.duration_minutes === duration)
    : studentPkgs

  const [selectedPkgId, setSelectedPkgId] = useState(
    matchedPkgs.length === 1 ? matchedPkgs[0].id : ''
  )

  return (
    <li className="border border-amber-100 bg-amber-50/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          {t('booking_list.complete_wait')}
        </span>
      </div>

      <p className="text-sm font-medium text-gray-800">
        {format(new Date(b.time_slots.start_time), t('booking_list.date_format'), { locale: dateLocale })}
        {' ~ '}
        {format(new Date(b.time_slots.end_time), 'HH:mm')}
      </p>
      <p className="text-xs mt-1 text-gray-500">{t('booking_list.student_prefix')}: {b.profiles?.full_name}</p>
      {duration && (
        <p className="text-xs mt-0.5 text-gray-400">{duration}{t('booking_list.duration_suffix')}</p>
      )}

      {matchedPkgs.length > 1 && (
        <div className="mt-3">
          <label className="text-xs text-gray-500 block mb-1">{t('booking_list.pkg_select_label')}</label>
          <select
            value={selectedPkgId}
            onChange={e => setSelectedPkgId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            <option value="">{t('booking_list.pkg_no_deduct')}</option>
            {matchedPkgs.map(p => (
              <option key={p.id} value={p.id}>
                {p.label || t('booking_list.pkg_label_fallback', { duration: p.duration_minutes })} ({t('booking_list.pkg_remaining')}: {p.total_lessons - p.completed_lessons})
              </option>
            ))}
          </select>
        </div>
      )}

      {matchedPkgs.length === 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {t('booking_list.no_active_pkg')}
        </p>
      )}

      <button
        onClick={() => onComplete(b.id, selectedPkgId || null)}
        className="mt-3 w-full text-xs bg-teal-500 text-white py-1.5 rounded-lg hover:bg-teal-600 transition-colors"
      >
        {t('booking_list.complete_btn')}
      </button>
    </li>
  )
}

export default function BookingList() {
  const { t } = useTranslation()
  const [upcoming, setUpcoming]       = useState([])
  const [awaitingComplete, setAwaiting] = useState([])
  const [packages, setPackages]       = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [bookings, pkgs] = await Promise.all([
        bookingsApi.getMyBookings(),
        packagesApi.list(),
      ])
      const now = new Date()
      setUpcoming(
        bookings.filter(b =>
          new Date(b.time_slots.start_time) > now && b.status !== 'cancelled'
        )
      )
      setAwaiting(
        bookings.filter(b =>
          b.status === 'confirmed' &&
          new Date(b.time_slots.end_time) < now &&
          !b.completed_at
        )
      )
      setPackages(pkgs)
    } catch {
      toast.error(t('booking_list.error_load'))
    }
  }

  async function handleConfirm(id) {
    try {
      await bookingsApi.confirm(id)
      toast.success(t('booking_list.confirm_success'))
      load()
    } catch {
      toast.error(t('booking_list.confirm_error'))
    }
  }

  async function handleCancel(id) {
    if (!confirm(t('booking_list.cancel_confirm'))) return
    try {
      await bookingsApi.cancel(id)
      toast.success(t('booking_list.cancel_success'))
      load()
    } catch {
      toast.error(t('booking_list.cancel_error'))
    }
  }

  async function handleComplete(id, packageId) {
    try {
      await bookingsApi.complete(id, packageId)
      toast.success(packageId ? t('booking_list.complete_with_pkg') : t('booking_list.complete_no_pkg'))
      load()
    } catch (err) {
      const msg = err?.response?.data?.error ?? t('booking_list.complete_error')
      toast.error(msg)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
      {awaitingComplete.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            {t('booking_list.section_complete')}
            <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
              {awaitingComplete.length}
            </span>
          </h3>
          <ul className="space-y-3">
            {awaitingComplete.map(b => (
              <CompleteItem
                key={b.id}
                b={b}
                packages={packages}
                onComplete={handleComplete}
              />
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3">{t('booking_list.section_requests')}</h3>
        <ul className="space-y-3 max-h-[400px] overflow-y-auto">
          {upcoming.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">{t('booking_list.requests_empty')}</p>
          )}
          {upcoming.map(b => (
            <BookingItem
              key={b.id} b={b}
              onConfirm={handleConfirm} onCancel={handleCancel}
            />
          ))}
        </ul>
      </div>
    </section>
  )
}
