import { usePush } from '../../hooks/usePush'
import toast from 'react-hot-toast'

export default function PushPermission() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePush()

  if (!supported || permission === 'denied') return null

  async function handleSubscribe() {
    const ok = await subscribe()
    if (ok) toast.success('푸쉬 알림이 활성화되었습니다.')
    else toast.error('알림 권한이 거부되었습니다.')
  }

  async function handleUnsubscribe() {
    await unsubscribe()
    toast.success('푸쉬 알림이 해제되었습니다.')
  }

  if (subscribed) {
    return (
      <button
        onClick={handleUnsubscribe}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        🔔 알림 해제
      </button>
    )
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="flex items-center gap-1 text-xs bg-teal-50 text-teal-600 border border-teal-200 px-3 py-1.5 rounded-full hover:bg-teal-100 transition-colors font-medium"
    >
      🔔 {loading ? '처리 중...' : '수업 알림 받기'}
    </button>
  )
}
