import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { bookingsApi } from '../../api'

const STATUS_LABEL = { pending: '대기', confirmed: '확정', cancelled: '취소' }
const STATUS_COLOR = {
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function BookingItem({ b, isPast, onConfirm, onCancel }) {
  return (
    <li className={`border rounded-xl p-4 transition-colors ${
      isPast ? 'border-gray-100 bg-gray-50' : 'border-gray-100'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isPast ? 'bg-gray-100 text-gray-400' : STATUS_COLOR[b.status]
        }`}>
          {isPast ? '완료' : STATUS_LABEL[b.status]}
        </span>
        <span className={`text-xs ${isPast ? 'text-gray-300' : 'text-gray-400'}`}>
          {format(new Date(b.created_at), 'M/d HH:mm')}
        </span>
      </div>

      <p className={`text-sm font-medium ${isPast ? 'text-gray-400' : 'text-gray-800'}`}>
        {format(new Date(b.time_slots.start_time), 'M월 d일 (EEE) HH:mm', { locale: ko })}
        {' ~ '}
        {format(new Date(b.time_slots.end_time), 'HH:mm')}
      </p>
      <p className={`text-xs mt-1 ${isPast ? 'text-gray-400' : 'text-gray-500'}`}>
        학생: {b.profiles?.full_name}
      </p>
      {b.notes && (
        <p className={`text-xs mt-1 ${isPast ? 'text-gray-400' : 'text-gray-500'}`}>
          메모: {b.notes}
        </p>
      )}

      {!isPast && b.status === 'pending' && (
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
      {!isPast && b.status === 'confirmed' && (
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

export default function BookingList() {
  const [upcoming, setUpcoming] = useState([])

  useEffect(() => { loadBookings() }, [])

  async function loadBookings() {
    try {
      const data = await bookingsApi.getMyBookings()
      const now  = new Date()
      setUpcoming(data.filter(b => new Date(b.time_slots.start_time) > now))
    } catch {
      toast.error('예약 목록을 불러오지 못했습니다.')
    }
  }

  async function handleConfirm(id) {
    try {
      await bookingsApi.confirm(id)
      toast.success('예약이 확정되었습니다.')
      loadBookings()
    } catch {
      toast.error('확정에 실패했습니다.')
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

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">예약 요청</h3>

      <ul className="space-y-3 max-h-[500px] overflow-y-auto">
        {upcoming.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">예약 요청이 없습니다.</p>
        )}

        {upcoming.map(b => (
          <BookingItem
            key={b.id} b={b} isPast={false}
            onConfirm={handleConfirm} onCancel={handleCancel}
          />
        ))}
      </ul>
    </section>
  )
}
