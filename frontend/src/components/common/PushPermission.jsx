import { usePush } from '../../hooks/usePush'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

export default function PushPermission() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePush()
  const { t } = useTranslation()

  if (!supported || permission === 'denied') return null

  async function handleSubscribe() {
    const ok = await subscribe()
    if (ok) toast.success(t('push.enabled'))
    else toast.error(t('push.denied'))
  }

  async function handleUnsubscribe() {
    await unsubscribe()
    toast.success(t('push.disabled'))
  }

  if (subscribed) {
    return (
      <button
        onClick={handleUnsubscribe}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        🔔 {t('push.turn_off')}
      </button>
    )
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="flex items-center gap-1 text-xs bg-teal-50 text-teal-600 border border-teal-200 px-3 py-1.5 rounded-full hover:bg-teal-100 transition-colors font-medium"
    >
      🔔 {loading ? t('push.loading') : t('push.subscribe')}
    </button>
  )
}
