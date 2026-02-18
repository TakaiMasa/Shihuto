'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, Coffee, LogOut as LogOutIcon, Loader2, Play, AlertCircle } from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'
import type { Attendance, Store } from '@/lib/types'

type AttendanceStatus = 'not_started' | 'clocked_in' | 'on_break' | 'break_ended' | 'clocked_out'

function getStatus(attendance: Attendance | null): AttendanceStatus {
  if (!attendance || !attendance.clock_in) return 'not_started'
  if (attendance.clock_out) return 'clocked_out'
  if (attendance.break_start && !attendance.break_end) return 'on_break'
  if (attendance.break_start && attendance.break_end) return 'break_ended'
  return 'clocked_in'
}

const storeNames: Record<string, string> = {
  sui: '麺屋 水',
  monday: 'RAMEN MONDAY',
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

  // 現在時刻を毎秒更新
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
    const { data: att } = await supabase
      .from('attendances')
      .select('*')
      .eq('user_id', user.id)
      .eq('store_id', storeData.id)
      .eq('work_date', today)
      .maybeSingle()

    setAttendance(att as Attendance | null)
    setLoading(false)
  }, [storeCode, supabase, user.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAction = async (action: 'clock_in' | 'break_start' | 'break_end' | 'clock_out') => {
    if (!profile || !store) {
      setError('店舗情報が読み込まれていません。ページを再読み込みしてください。')
      return
    }
    setActionLoading(true)
    setError(null)

    const now = new Date().toISOString()
    const today = format(new Date(), 'yyyy-MM-dd')

    try {
      if (action === 'clock_in') {
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
        } else if (!data) {
          setError('出勤打刻に失敗しました。再度お試しください。')
        } else {
          setAttendance(data as Attendance)
        }
      } else {
        if (!attendance) {
          setError('勤怠レコードが見つかりません。ページを再読み込みしてください。')
          setActionLoading(false)
          return
        }

        const { data, error: updateError } = await supabase
          .from('attendances')
          .update({ [action]: now })
          .eq('id', attendance.id)
          .select()
          .maybeSingle()

        if (updateError) {
          const actionLabel = { break_start: '休憩開始', break_end: '休憩終了', clock_out: '退勤' }[action]
          setError(`${actionLabel}の打刻に失敗しました: ${updateError.message}`)
        } else if (!data) {
          setError('打刻の更新に失敗しました。ページを再読み込みしてください。')
        } else {
          setAttendance(data as Attendance)
        }
      }
    } catch {
      setError('通信エラーが発生しました。再度お試しください。')
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
      {/* 店舗名ヘッダー */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">{storeName}</h1>
        <p className="text-secondary mt-1">{profile.name} さん</p>
      </div>

      {/* 現在時刻 */}
      <div className="text-center mb-8">
        <p className="text-5xl font-bold text-foreground tabular-nums">
          {format(currentTime, 'HH:mm:ss')}
        </p>
        <p className="text-secondary mt-2">
          {format(currentTime, 'yyyy年M月d日（E）', { locale: ja })}
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ステータス */}
      <div className="bg-card rounded-xl border border-border shadow-sm mb-6 p-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div
            className={cn(
              'w-3 h-3 rounded-full',
              status === 'not_started' && 'bg-slate-300',
              status === 'clocked_in' && 'bg-green-400 animate-pulse',
              status === 'on_break' && 'bg-amber-400 animate-pulse',
              status === 'break_ended' && 'bg-green-400 animate-pulse',
              status === 'clocked_out' && 'bg-slate-400'
            )}
          />
          <span className="text-sm font-medium text-secondary">
            {status === 'not_started' && '未出勤'}
            {status === 'clocked_in' && '出勤中'}
            {status === 'on_break' && '休憩中'}
            {status === 'break_ended' && '出勤中（休憩済）'}
            {status === 'clocked_out' && '退勤済'}
          </span>
        </div>

        {/* 打刻情報 */}
        {attendance && (
          <div className="grid grid-cols-2 gap-3 mb-6">
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
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-xs text-secondary mb-1">休憩開始</p>
              <p className="text-lg font-semibold text-foreground">
                {formatTime(attendance.break_start)}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-xs text-secondary mb-1">休憩終了</p>
              <p className="text-lg font-semibold text-foreground">
                {formatTime(attendance.break_end)}
              </p>
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="space-y-3">
          {status === 'not_started' && (
            <button
              onClick={() => handleAction('clock_in')}
              disabled={actionLoading}
              className="w-full py-4 rounded-xl bg-green-500 text-white font-bold text-lg hover:bg-green-600 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Play size={24} />}
              出勤
            </button>
          )}

          {status === 'clocked_in' && (
            <>
              <button
                onClick={() => handleAction('break_start')}
                disabled={actionLoading}
                className="w-full py-4 rounded-xl bg-amber-500 text-white font-bold text-lg hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
                休憩開始
              </button>
              <button
                onClick={() => handleAction('clock_out')}
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
              onClick={() => handleAction('break_end')}
              disabled={actionLoading}
              className="w-full py-4 rounded-xl bg-blue-500 text-white font-bold text-lg hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Clock size={24} />}
              休憩終了
            </button>
          )}

          {status === 'break_ended' && (
            <button
              onClick={() => handleAction('clock_out')}
              disabled={actionLoading}
              className="w-full py-4 rounded-xl bg-slate-500 text-white font-bold text-lg hover:bg-slate-600 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <LogOutIcon size={24} />}
              退勤
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
