import webpush from 'web-push'
import { supabase } from '../lib/supabase.js'

webpush.setVapidDetails(
  `mailto:${process.env.SMTP_USER}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

/**
 * 특정 유저의 모든 기기에 푸쉬 알림 발송
 * 만료된 구독은 자동 삭제
 */
export async function sendPushToUser(userId, payload) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId)

  if (!subs?.length) return

  const expiredIds = []

  await Promise.all(subs.map(async ({ id, subscription }) => {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload))
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        expiredIds.push(id)
      } else {
        console.error('[Push] 발송 오류:', err.message)
      }
    }
  }))

  // 만료된 구독 정리
  if (expiredIds.length) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds)
  }
}
