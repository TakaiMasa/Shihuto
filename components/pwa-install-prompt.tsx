'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SNOOZE_KEY = 'pwa-install-snoozed-until'
const SNOOZE_DAYS = 7

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // スヌーズ期間中は表示しない
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY)
    if (snoozedUntil && Date.now() < Number(snoozedUntil)) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'dismissed') {
      snooze()
    }
    setVisible(false)
    setDeferredPrompt(null)
  }

  function snooze() {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(SNOOZE_KEY, String(until))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-[#1e293b] p-4 shadow-xl text-white">
      <div className="flex items-start gap-3">
        {/* アイコン */}
        <img
          src="/icons/icon-72x72.png"
          alt="シフト管理"
          className="h-12 w-12 rounded-xl shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">シフト管理をホーム画面に追加</p>
          <p className="mt-0.5 text-xs text-slate-300">素早くアクセスできます</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstall}
          className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-semibold hover:bg-blue-400 active:bg-blue-600 transition-colors"
        >
          追加する
        </button>
        <button
          onClick={snooze}
          className="flex-1 rounded-lg bg-slate-600 py-2 text-sm font-semibold hover:bg-slate-500 active:bg-slate-700 transition-colors"
        >
          あとで
        </button>
      </div>
    </div>
  )
}
