'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

interface Notification {
  id: string
  type: 'clock_in' | 'break_start' | 'break_end' | 'clock_out'
  message: string
  is_read: boolean
  created_at: string
}

interface ToastItem {
  id: string
  message: string
  type: string
}

function typeEmoji(type: string): string {
  switch (type) {
    case 'clock_in': return '🟢'
    case 'break_start': return '🟡'
    case 'break_end': return '🔵'
    case 'clock_out': return '⚫'
    default: return '🔔'
  }
}

export default function NotificationBell({ placement = 'sidebar' }: { placement?: 'sidebar' | 'mobile' }) {
  const { supabase, profile } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const [pushEnabled, setPushEnabled] = useState(false)

  // プッシュ通知の購読状態を確認
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setPushEnabled(!!sub)
      })
    })
  }, [])

  const handlePushToggle = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      // iOSでホーム画面追加なしの場合など
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      if (isIos) {
        alert('iPhoneでプッシュ通知を受け取るには、まず「ホーム画面に追加」でアプリをインストールしてください。')
      } else {
        alert('このブラウザはプッシュ通知に対応していません。')
      }
      return
    }

    const reg = await navigator.serviceWorker.ready

    if (pushEnabled) {
      // 購読解除
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushEnabled(false)
    } else {
      // 購読開始
      if (!VAPID_PUBLIC_KEY) {
        alert('サーバーの設定が不完全です。管理者に連絡してください。')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('通知が許可されませんでした。設定アプリ →「通知」から許可してください。')
        return
      }
      try {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
        const json = sub.toJSON()
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        })
        setPushEnabled(true)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('Push subscription failed:', errMsg)
        alert(`プッシュ通知の設定に失敗しました。\n\nエラー: ${errMsg}`)
      }
    }
  }

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifications((data || []) as Notification[])
  }, [supabase, profile.id])

  const showToast = useCallback((notif: Notification) => {
    setToasts((prev) => [...prev, { id: notif.id, message: notif.message, type: notif.type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== notif.id))
    }, 5000)
  }, [])

  useEffect(() => {
    fetchNotifications()

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev])
          showToast(newNotif)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, profile.id, fetchNotifications, showToast])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleToggle = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
      if (unreadIds.length > 0) {
        await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      }
    }
  }

  return (
    <>
      {/* トースト */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3 flex items-center gap-3 w-full sm:min-w-[260px] sm:max-w-[340px] pointer-events-auto"
          >
            <span className="text-lg shrink-0">{typeEmoji(toast.type)}</span>
            <p className="text-sm text-gray-800">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* ベルボタン + ドロップダウン */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleToggle}
          className="relative p-2 rounded-lg text-sidebar-text hover:bg-white/10 hover:text-white transition-colors"
          aria-label="通知"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className={cn(
            'absolute bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden',
            placement === 'mobile'
              ? 'right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-xs'
              : 'left-0 bottom-full mb-2 w-80'
          )}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">通知</h3>
              {'Notification' in window && (
                <button
                  onClick={handlePushToggle}
                  className={cn(
                    'flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors',
                    pushEnabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  )}
                  title={pushEnabled ? 'プッシュ通知をオフにする' : 'プッシュ通知をオンにする'}
                >
                  {pushEnabled ? <Bell size={11} /> : <BellOff size={11} />}
                  {pushEnabled ? 'ON' : 'OFF'}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">通知はありません</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0',
                      !n.is_read && 'bg-blue-50'
                    )}
                  >
                    <span className="text-base mt-0.5 shrink-0">{typeEmoji(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(n.created_at), 'M月d日 HH:mm', { locale: ja })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
