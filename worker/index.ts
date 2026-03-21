/// <reference lib="webworker" />
// Web Push通知ハンドラー（Service Worker内で実行）
export {}
declare const self: ServiceWorkerGlobalScope

self.addEventListener('push', (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() ?? '' }
  }

  const title = data.title ?? '通知'
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'attendance-notification',
    data: { url: data.url ?? '/dashboard' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url: string = event.notification.data?.url ?? '/dashboard'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.postMessage({ type: 'NAVIGATE', url })
            return client.focus()
          }
        }
        return self.clients.openWindow(url)
      })
  )
})
