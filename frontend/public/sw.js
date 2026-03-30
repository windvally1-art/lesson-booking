const CACHE_NAME = 'arin-korean-lab-v1'
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/header-logo.jpg',
]

// ── 설치: 핵심 파일 캐싱 ────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

// ── 활성화: 구버전 캐시 삭제 ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── 네트워크 우선, 실패 시 캐시 반환 ─────────────────
self.addEventListener('fetch', event => {
  // API / 외부 요청은 캐시하지 않음
  if (!event.request.url.startsWith(self.location.origin)) return
  if (event.request.url.includes('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // 성공한 응답은 캐시 업데이트
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

// ── 푸쉬 알림 수신 ───────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? '수업 알림', {
      body:  data.body ?? '',
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      tag:   data.tag ?? 'lesson-reminder',
      data:  { url: data.url ?? '/' },
      requireInteraction: false,
    })
  )
})

// ── 알림 클릭 ────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const url = event.notification.data?.url ?? '/'
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
