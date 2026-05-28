import { useEffect, useState } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { ko } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { bookingsApi, packagesApi } from '../../api'

const STATUS_LABEL = { pending: '대기', confirmed: '확정', cancelled: '취소' }
const STATUS_COLOR = {
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

// 슬롯 길이로 패키지 duration 추정 (25±5 또는 50±5 범위)
function inferDuration(startTime, endTime) {
  const mins = differenceInMinutes(new Date(endTime), new Date(startTime))
  if (Math.abs(mins - 25) <= 5) return 25
  if (Math.abs(mins - 50) <= 5) return 50
  return null
}

function BookingItem({ b, onConfirm, onCancel }) {
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
        {format(new Date(b.time_slots.start_time), 'M월 d일 (EEE) HH:mm', { locale: ko })}
        {' ~ '}
        {format(new Date(b.time_slots.end_time), 'HH:mm')}
      </p>
      <p className="text-xs mt-1 text-gray-500">학생: {b.profiles?.full_name}</p>
      {b.notes && <p className="text-xs mt-1 text-gray-500">메모: {b.notes}</p>}

      {b.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onConfirm(b.id)}
            className="flex-1 text-xs bg-green-500 text-white py-1.5 rounded-lg hover:bg-green-600 transition-colors"
          >
            확정
          </button>
          <button
            onClick={() => onCancel(b.id)}
            className="flex-1 text-xs bg-red-400 text-white py-1.5 rounded-lg hover:bg-red-500 transition-colors"
          >
            거절
          </button>
        </div>
      )}
      {b.status === 'confirmed' && (
        <button
          onClick={() => onCancel(b.id)}
          className="mt-3 w-full text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          취소하기
        </button>
      )}
    </li>
  )
}

function CompleteItem({ b, packages, onComplete }) {
  const duration  = inferDuration(b.time_slots.start_time, b.time_slots.end_time)
  const studentId = b.profiles?.id ?? b.student_id

  // 이 학생의 활성 패키지 — duration 추론 가능 시 해당 종류만, 불가 시 전체
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
          완료 대기
        </span>
      </div>

      <p className="text-sm font-medium text-gray-800">
        {format(new Date(b.time_slots.start_time), 'M월 d일 (EEE) HH:mm', { locale: ko })}
        {' ~ '}
        {format(new Date(b.time_slots.end_time), 'HH:mm')}
      </p>
      <p className="text-xs mt-1 text-gray-500">학생: {b.profiles?.full_name}</p>
      {duration && (
        <p className="text-xs mt-0.5 text-gray-400">{duration}분 수업</p>
      )}

      {/* 패키지 선택 */}
      {matchedPkgs.length > 1 && (
        <div className="mt-3">
          <label className="text-xs text-gray-500 block mb-1">차감할 패키지</label>
          <select
            value={selectedPkgId}
            onChange={e => setSelectedPkgId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            <option value="">패키지 없이 완료</option>
            {matchedPkgs.map(p => (
              <option key={p.id} value={p.id}>
                {p.label || `${p.duration_minutes}분 패키지`} (남은 수업: {p.total_lessons - p.completed_lessons})
              </option>
            ))}
          </select>
        </div>
      )}

      {matchedPkgs.length === 0 && (
        <p className="text-xs text-gray-400 mt-2">
          활성 수업권 패키지 없음 — 패키지 없이 완료 처리됩니다.
        </p>
      )}

      <button
        onClick={() => onComplete(b.id, selectedPkgId || null)}
        className="mt-3 w-full text-xs bg-teal-500 text-white py-1.5 rounded-lg hover:bg-teal-600 transition-colors"
      >
        수업 완료 확인
      </button>
    </li>
  )
}

export default function BookingList() {
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
      toast.error('데이터를 불러오지 못했습니다.')
    }
  }

  async function handleConfirm(id) {
    try {
      await bookingsApi.confirm(id)
      toast.success('예약이 확정되었습니다.')
      load()
    } catch {
      toast.error('확정에 실패했습니다.')
    }
  }

  async function handleCancel(id) {
    if (!confirm('예약을 취소하시겠습니까?')) return
    try {
      await bookingsApi.cancel(id)
      toast.success('예약이 취소되었습니다.')
      load()
    } catch {
      toast.error('취소에 실패했습니다.')
    }
  }

  async function handleComplete(id, packageId) {
    try {
      await bookingsApi.complete(id, packageId)
      toast.success(packageId ? '수업 완료! 수업권에서 차감되었습니다.' : '수업 완료 처리되었습니다.')
      load()
    } catch (err) {
      const msg = err?.response?.data?.error ?? '완료 처리에 실패했습니다.'
      toast.error(msg)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
      {/* 완료 대기 섹션 */}
      {awaitingComplete.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            완료 확인 필요
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

      {/* 예약 요청 섹션 */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3">예약 요청</h3>
        <ul className="space-y-3 max-h-[400px] overflow-y-auto">
          {upcoming.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">예약 요청이 없습니다.</p>
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
