'use client'

import { useAuth } from '@/components/auth-provider'
import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { formatCurrency, formatMinutesToHours, getCurrentYearMonth } from '@/lib/utils'
import {
  Clock,
  Calendar,
  Wallet,
  Users,
  TrendingUp,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { profile, supabase, user } = useAuth()
  const isAdmin = profile.role === 'admin'

  if (isAdmin) {
    return <AdminDashboard />
  }

  return <StaffDashboard />
}

function StaffDashboard() {
  const { profile, supabase, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [totalWorkMinutes, setTotalWorkMinutes] = useState(0)
  const [shikiDays, setShikiDays] = useState(0)
  const [totalDays, setTotalDays] = useState(0)

  const currentYearMonth = getCurrentYearMonth()
  const transportationTotal = shikiDays * (profile.transportation_fee || 0)
  const estimatedSalary = Math.floor(totalWorkMinutes / 60 * profile.hourly_wage) + transportationTotal

  useEffect(() => {
    const fetchData = async () => {
      const { data: myAttendances } = await supabase
        .from('attendances')
        .select('work_minutes, break_minutes, store_id, stores(code, has_transportation_fee)')
        .eq('user_id', user.id)
        .gte('work_date', format(startOfMonth(new Date()), 'yyyy-MM-dd'))
        .lte('work_date', format(endOfMonth(new Date()), 'yyyy-MM-dd'))
        .not('clock_out', 'is', null)

      if (myAttendances) {
        setTotalWorkMinutes(myAttendances.reduce((sum: number, a: any) => sum + (a.work_minutes || 0), 0))
        setShikiDays(myAttendances.filter((a: any) => a.stores?.has_transportation_fee).length)
        setTotalDays(myAttendances.length)
      }
      setLoading(false)
    }
    fetchData()
  }, [supabase, user.id, currentYearMonth])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">ダッシュボード</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-primary">
              <Clock size={20} />
            </div>
            <span className="text-sm text-secondary">今月の勤務時間</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {formatMinutesToHours(totalWorkMinutes)}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-50 text-success">
              <Wallet size={20} />
            </div>
            <span className="text-sm text-secondary">今月の給与見込み</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(estimatedSalary)}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-amber-50 text-accent">
              <Calendar size={20} />
            </div>
            <span className="text-sm text-secondary">今月の出勤日数</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {totalDays}日
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/shift/submit" className="bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">シフト提出</h3>
              <p className="text-sm text-secondary mt-1">出勤できない日を提出する</p>
            </div>
            <ArrowRight size={20} className="text-secondary group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link href="/shift/view" className="bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">シフト確認</h3>
              <p className="text-sm text-secondary mt-1">確定シフトを確認する</p>
            </div>
            <ArrowRight size={20} className="text-secondary group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link href="/attendance/history" className="bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">勤怠履歴</h3>
              <p className="text-sm text-secondary mt-1">勤怠記録を確認・修正する</p>
            </div>
            <ArrowRight size={20} className="text-secondary group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link href="/salary/view" className="bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">給与確認</h3>
              <p className="text-sm text-secondary mt-1">給与明細を確認する</p>
            </div>
            <ArrowRight size={20} className="text-secondary group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const { profile, supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [todayAttendances, setTodayAttendances] = useState<any[]>([])
  const [staffCount, setStaffCount] = useState(0)
  const [totalWorkMinutes, setTotalWorkMinutes] = useState(0)

  const currentYearMonth = getCurrentYearMonth()

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split('T')[0]

      const [todayAttRes, staffCountRes, monthAttRes] = await Promise.all([
        supabase
          .from('attendances')
          .select('*, profiles(name), stores(name, code)')
          .eq('work_date', today),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase
          .from('attendances')
          .select('work_minutes, user_id, stores(code)')
          .gte('work_date', format(startOfMonth(new Date()), 'yyyy-MM-dd'))
          .lte('work_date', format(endOfMonth(new Date()), 'yyyy-MM-dd'))
          .not('clock_out', 'is', null),
      ])

      setTodayAttendances(todayAttRes.data || [])
      setStaffCount(staffCountRes.count || 0)
      setTotalWorkMinutes(
        (monthAttRes.data || []).reduce((sum: number, a: any) => sum + (a.work_minutes || 0), 0)
      )
      setLoading(false)
    }
    fetchData()
  }, [supabase, currentYearMonth])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">管理者ダッシュボード</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-primary"><Users size={20} /></div>
            <span className="text-sm text-secondary">スタッフ数</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{staffCount}名</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-50 text-success"><Clock size={20} /></div>
            <span className="text-sm text-secondary">本日の出勤者</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {todayAttendances.filter((a: any) => a.clock_in && !a.clock_out).length}名
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-amber-50 text-accent"><TrendingUp size={20} /></div>
            <span className="text-sm text-secondary">今月の総勤務時間</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatMinutesToHours(totalWorkMinutes)}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600"><Calendar size={20} /></div>
            <span className="text-sm text-secondary">今日の打刻数</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{todayAttendances.length}件</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">本日の出勤状況</h2>
          <Link href="/attendance/manage" className="text-sm text-primary hover:underline">詳細を見る</Link>
        </div>
        <div className="p-6">
          {todayAttendances.length > 0 ? (
            <div className="space-y-3">
              {todayAttendances.map((att: any) => (
                <div key={att.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center text-sm font-bold">
                      {att.profiles?.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{att.profiles?.name}</p>
                      <p className="text-xs text-secondary">{att.stores?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {att.clock_in && !att.clock_out && (
                      <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">出勤中</span>
                    )}
                    {att.break_start && !att.break_end && (
                      <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">休憩中</span>
                    )}
                    {att.clock_out && (
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">退勤済</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary text-center py-4">本日の打刻データはありません</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/shift/manage" className="bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">シフト管理</h3>
              <p className="text-sm text-secondary mt-1">シフトの確定・編集</p>
            </div>
            <ArrowRight size={20} className="text-secondary group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link href="/salary/manage" className="bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">給与管理</h3>
              <p className="text-sm text-secondary mt-1">給与計算・PDF出力</p>
            </div>
            <ArrowRight size={20} className="text-secondary group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link href="/settings/staff" className="bg-card rounded-xl border border-border p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">スタッフ管理</h3>
              <p className="text-sm text-secondary mt-1">スタッフの登録・編集</p>
            </div>
            <ArrowRight size={20} className="text-secondary group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  )
}
