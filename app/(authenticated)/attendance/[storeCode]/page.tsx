'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, Coffee, LogOut as LogOutIcon, Loader2, Play, AlertCircle } from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'
import type { Attendance, Store } from '@/lib/types'

type AttendanceStatus = 'not_started' | 'clocked_in' | 'on_break' | 'clocked_out'

function getCurrentBreakNumber(att: Attendance): number {
  if (att.break3_start) return 3
  if (att.break2_start) return 2
  if (att.break1_start) return 1
  return 0
}

function isOnBreak(att: Attendance): boolean {
  if (att.break3_start && !att.break3_end) return true
  if (att.break2_start && !att.break2_end) return true
  if (att.break1_start && !att.break1_end) return true
  return false
}

function getCompletedBreaks(att: Attendance): number {
  let count = 0
  if (att.break1_start && att.break1_end) count++
  if (att.break2_start && att.break2_end) count++
  if (att.break3_start && att.break3_end) count++
  return count
}

function canTakeMoreBreaks(att: Attendance): boolean {
  return getCompletedBreaks(att) + (isOnBreak(att) ? 1 : 0) < 3
}

function getStatus(attendance: Attendance | null): AttendanceStatus {
  if (!attendance || !attendance.clock_in) return 'not_started'
  if (attendance.clock_out) return 'clocked_out'
  if (isOnBreak(attendance)) return 'on_break'
  return 'clocked_in'
}

function getStatusLabel(att: Attendance | null): string {
  if (!att || !att.clock_in) return '未出勤'
  if (att.clock_out) return '退勤済'
  if (isOnBreak(att)) {
    const breakNum = getCurrentBreakNumber(att)
    return `休憩${breakNum}回目`
  }
  const completed = getCompletedBreaks(att)
  if (completed > 0) return `出勤中（休憩${completed}回済）`
  return '出勤中'
}

const storeNames: Record<string, string> = {
  sui: '麺屋 水',
  monday: 'RAMEN MONDAY',
  friday: 'RAMEN FRIDAY',
}

export default function AttendancePage() {
  const params = useParams()
  const storeCode = params.storeCode as string
  const { user, profile, supabase } = useAuth()

  const [store, setStore] = useState<Store | null>(null)
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('code', storeCode)
      .maybeSingle()

    if (storeError || !storeData) {
      setError('店舗情報の取得に失敗しました。ページを再読み込みしてください。')
      setStore(null)
      setLoading(false)
      return
    }

    setStore(storeData as Store)

    const today = format(new Date(), 'yyyy-MM-dd')
    let { data: att } = await supabase
      .from('attendances')
      .select('*')
      .eq('user_id', user.id)
      .eq('store_id', storeData.id)
      .eq('work_date', today)
      .maybeSingle()

    // 今日の記録がない場合、前日の未退勤レコードを確認（日付をまたいだ出勤に対応）
    if (!att) {
      const yesterday = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      const { data: prevAtt } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .eq('store_id', storeData.id)
        .eq('work_date', yesterday)
        .is('clock_out', null)
        .not('clock_in', 'is', null)
        .maybeSingle()
      if (prevAtt) {
        att = prevAtt
      }
    }

    setAttendance(att as Attendance | null)
    setLoading(false)
  }, [storeCode, supabase, user.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleClockIn = async () => {
    if (!profile || !store) return
    setActionLoading(true)
    setError(null)

    const now = new Date().toISOString()
    const today = format(new Date(), 'yyyy-MM-dd')

    const { data, error: insertError } = await supabase
      .from('attendances')
      .insert({
        user_id: profile.id,
        store_id: store.id,
        work_date: today,
        clock_in: now,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      setError(`出勤打刻に失敗しました: ${insertError.message}`)
    } else if (data) {
      setAttendance(data as Attendance)
    }
    setActionLoading(false)
  }

  const handleBreakStart = async () => {
    if (!attendance) return
    setActionLoading(true)
    setError(null)

    const now = new Date().toISOString()
    const breakNum = getCompletedBreaks(attendance) + 1
    const field = `break${breakNum}_start` as keyof Attendance

    const { data, error: updateError } = await supabase
      .from('attendances')
      .update({ [field]: now })
      .eq('id', attendance.id)
      .select()
      .maybeSingle()

    if (updateError) {
      setError(`休憩開始の打刻に失敗しました: ${updateError.message}`)
    } else if (data) {
      setAttendance(data as Attendance)
    }
    setActionLoading(false)
  }

  const handleBreakEnd = async () => {
    if (!attendance) return
    setActionLoading(true)
    setError(null)

    const now = new Date().toISOString()
    const breakNum = getCurrentBreakNumber(attendance)
    const field = `break${breakNum}_end` as keyof Attendance

    const { data, error: updateError } = await supabase
      .from('attendances')
      .update({ [field]: now })
      .eq('id', attendance.id)
      .select()
      .maybeSingle()

    if (updateError) {
      setError(`休憩終了の打刻に失敗しました: ${updateError.message}`)
    } else if (data) {
      setAttendance(data as Attendance)
    }
    setActionLoading(false)
  }

  const handleClockOut = async () => {
    if (!attendance) return
    setActionLoading(true)
    setError(null)

    const now = new Date().toISOString()
    const { data, error: updateError } = await supabase
      .from('attendances')
      .update({ clock_out: now })
      .eq('id', attendance.id)
      .select()
      .maybeSingle()

    if (updateError) {
      setError(`退勤の打刻に失敗しました: ${updateError.message}`)
    } else if (data) {
      setAttendance(data as Attendance)
    }
    setActionLoading(false)
  }

  const status = getStatus(attendance)
  const storeName = storeNames[storeCode] || storeCode

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    )
  }

  if (!store) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
        <p className="text-foreground font-semibold mb-2">店舗情報を取得できませんでした</p>
        <p className="text-secondary text-sm mb-6">ネットワーク接続を確認し、再読み込みしてください。</p>
        <button
          onClick={() => fetchData()}
          className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-all"
        >
          再読み込み
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">{storeName}</h1>
        <p className="text-secondary mt-1">{profile.name} さん</p>
      </div>

      <div className="text-center mb-8">
        <p className="text-5xl font-bold text-foreground tabular-nums">
          {format(currentTime, 'HH:mm:ss')}
        </p>
        <p className="text-secondary mt-2">
          {format(currentTime, 'yyyy年M月d日（E）', { locale: ja })}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm mb-6 p-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div
            className={cn(
              'w-3 h-3 rounded-full',
              status === 'not_started' && 'bg-slate-300',
              status === 'clocked_in' && 'bg-green-400 animate-pulse',
              status === 'on_break' && 'bg-amber-400 animate-pulse',
              status === 'clocked_out' && 'bg-slate-400'
            )}
          />
          <span className="text-sm font-medium text-secondary">
            {getStatusLabel(attendance)}
          </span>
        </div>

        {attendance && (
          <div className="space-y-3 mb-6">
            {/* 出勤・退勤 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-xs text-secondary mb-1">出勤</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatTime(attendance.clock_in)}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-xs text-secondary mb-1">退勤</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatTime(attendance.clock_out)}
                </p>
              </div>
            </div>

            {/* 休憩1 */}
            {attendance.break1_start && (
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-xs text-amber-700 mb-1">休憩1 開始</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatTime(attendance.break1_start)}
                  </p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-xs text-amber-700 mb-1">休憩1 終了</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatTime(attendance.break1_end)}
                  </p>
                </div>
              </div>
            )}

            {/* 休憩2 */}
            {attendance.break2_start && (
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                  <p className="text-xs text-orange-700 mb-1">休憩2 開始</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatTime(attendance.break2_start)}
                  </p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                  <p className="text-xs text-orange-700 mb-1">休憩2 終了</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatTime(attendance.break2_end)}
                  </p>
                </div>
              </div>
            )}

            {/* 休憩3 */}
            {attendance.break3_start && (
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2.5 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs text-red-700 mb-1">休憩3 開始</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatTime(attendance.break3_start)}
                  </p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs text-red-700 mb-1">休憩3 終了</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatTime(attendance.break3_end)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* アクションボタン */}
        <div className="space-y-3">
          {status === 'not_started' && (
            <button
              onClick={handleClockIn}
              disabled={actionLoading}
              className="w-full py-4 rounded-xl bg-green-500 text-white font-bold text-lg hover:bg-green-600 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Play size={24} />}
              出勤
            </button>
          )}

          {status === 'clocked_in' && (
            <>
              {attendance && canTakeMoreBreaks(attendance) && (
                <button
                  onClick={handleBreakStart}
                  disabled={actionLoading}
                  className="w-full py-4 rounded-xl bg-amber-500 text-white font-bold text-lg hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
                  休憩開始（{getCompletedBreaks(attendance) + 1}回目）
                </button>
              )}
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full py-4 rounded-xl bg-slate-500 text-white font-bold text-lg hover:bg-slate-600 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <LogOutIcon size={24} />}
                退勤
              </button>
            </>
          )}

          {status === 'on_break' && (
            <button
              onClick={handleBreakEnd}
              disabled={actionLoading}
              className="w-full py-4 rounded-xl bg-blue-500 text-white font-bold text-lg hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Clock size={24} />}
              休憩終了
            </button>
          )}

          {status === 'clocked_out' && (
            <div className="text-center py-4">
              <p className="text-secondary">本日の勤務は完了しました</p>
              {attendance && attendance.work_minutes != null && (
                <p className="text-foreground font-semibold mt-2">
                  実働時間: {Math.floor(attendance.work_minutes / 60)}時間{attendance.work_minutes % 60}分
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
