'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  CalendarCheck,
  CalendarCog,
  Clock,
  History,
  ClipboardList,
  Wallet,
  Receipt,
  Users,
  Store,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import NotificationBell from '@/components/notification-bell'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
  staffOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'ダッシュボード', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
  // シフト
  { label: 'シフト提出', href: '/shift/submit', icon: <Calendar size={20} />, staffOnly: true },
  { label: 'シフト確認', href: '/shift/view', icon: <CalendarCheck size={20} /> },
  { label: 'シフト管理', href: '/shift/manage', icon: <CalendarCog size={20} />, adminOnly: true },
  // 勤怠
  { label: '打刻（麺屋 水）', href: '/attendance/sui', icon: <Clock size={20} /> },
  { label: '打刻（MONDAY）', href: '/attendance/monday', icon: <Clock size={20} /> },
  { label: '勤怠履歴', href: '/attendance/history', icon: <History size={20} /> },
  { label: '勤怠管理', href: '/attendance/manage', icon: <ClipboardList size={20} />, adminOnly: true },
  // 給与
  { label: '給与確認', href: '/salary/view', icon: <Wallet size={20} />, staffOnly: true },
  { label: '給与管理', href: '/salary/manage', icon: <Receipt size={20} />, adminOnly: true },
  // 設定
  { label: 'スタッフ管理', href: '/settings/staff', icon: <Users size={20} />, adminOnly: true },
  { label: '店舗設定', href: '/settings/stores', icon: <Store size={20} />, adminOnly: true },
]

export default function Sidebar() {
  const { profile, supabase } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = profile.role === 'admin'

  const filteredItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.staffOnly && isAdmin) return false
    return true
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const sidebarContent = (
    <>
      {/* ロゴ */}
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-white font-bold text-lg">シフト管理</h1>
        <p className="text-sidebar-text text-xs mt-1">麵屋 水とRAMEN MONDAY</p>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-sidebar-active text-white'
                      : 'text-sidebar-text hover:bg-white/10 hover:text-white'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ユーザー情報・ログアウト */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-sidebar-active flex items-center justify-center text-white text-sm font-bold">
            {profile.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{profile.name}</p>
            <p className="text-sidebar-text text-xs">
              {isAdmin ? '管理者' : 'スタッフ'}
            </p>
          </div>
          {isAdmin && <NotificationBell />}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sidebar-text hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut size={20} />
          ログアウト
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* モバイルハンバーガーボタン */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed left-4 z-50 p-2 rounded-lg bg-sidebar text-white shadow-lg"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Menu size={24} />
      </button>

      {/* モバイルオーバーレイ */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* モバイルサイドバー */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col transform transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-4 text-sidebar-text hover:text-white"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>

      {/* デスクトップサイドバー */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar">
        {sidebarContent}
      </aside>
    </>
  )
}
