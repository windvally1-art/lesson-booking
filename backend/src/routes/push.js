import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/push/vapid-key — 프론트엔드에 공개키 제공
router.get('/vapid-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
})

// POST /api/push/subscribe — 구독 등록 (기기별 upsert)
router.post('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const { subscription } = req.body
    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'subscription 정보가 없습니다.' })
    }
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id:      req.profile.id,
        endpoint:     subscription.endpoint,
        subscription,
      }, { onConflict: 'endpoint' })

    if (error) throw error
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// DELETE /api/push/subscribe — 구독 해제
router.delete('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const { endpoint } = req.body
    if (!endpoint) return res.status(400).json({ error: 'endpoint 필요' })
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', req.profile.id)
      .eq('endpoint', endpoint)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
