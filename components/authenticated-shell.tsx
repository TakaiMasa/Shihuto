'use client'

import Sidebar from '@/components/sidebar'
import NotificationBell from '@/components/notification-bell'
import { useAuth } from '@/components/auth-provider'

export default function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const isAdmin = profile.role === 'admin'

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* モバイル用通知ベル（右上固定、管理者のみ） */}
      {isAdmin && (
        <div className="lg:hidden fixed right-4 z-50" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
          <NotificationBell />
        </div>
      )}
      <main className="lg:pl-64">
        <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
