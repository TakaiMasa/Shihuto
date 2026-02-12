'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  isSameMonth,
  isMonday,
  isFriday,
  getDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ShiftSubmitPage() {
  const { user, supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const fetchUnavailableDates = useCallback(async () => {
    setLoading(true)

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('shift_unavailable')
      .select('unavailable_date')
      .eq('user_id', user.id)
      .gte('unavailable_date', start)
      .lte('unavailable_date', end)

    const dates = new Set<string>()
    data?.forEach((d) => dates.add(d.unavailable_date))
    setUnavailableDates(dates)
    setLoading(false)
  }, [currentMonth, supabase, user.id])

  useEffect(() => {
    fetchUnavailableDates()
  }, [fetchUnavailableDates])

  const toggleDate = (dateStr: string) => {
    setUnavailableDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateStr)) {
        next.delete(dateStr)
      } else {
        next.add(dateStr)
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    // 既存のデータを削除
    await supabase
      .from('shift_unavailable')
      .delete()
      .eq('user_id', user.id)
      .gte('unavailable_date', start)
      .lte('unavailable_date', end)

    // 新しいデータを挿入
    if (unavailableDates.size > 0) {
      const inserts = Array.from(unavailableDates).map((date) => ({
        user_id: user.id,
        unavailable_date: date,
      }))

      const { error } = await supabase.from('shift_unavailable').insert(inserts)

      if (error) {
        setMessage({ type: 'error', text: '保存に失敗しました' })
        setSaving(false)
        return
      }
    }

    setMessage({ type: 'success', text: '保存しました' })
    setSaving(false)
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  // カレンダー生成
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const weekDays = ['月', '火', '水', '木', '金', '土', '日']

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">シフト提出</h1>
      <p className="text-secondary text-sm mb-6">
        出勤できない日を選択してください（基本出勤日: 月曜日・金曜日）
      </p>

      {/* メッセージ */}
      {message.text && (
        <div
          className={cn(
            'mb-4 p-3 rounded-lg text-sm',
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          )}
        >
          {message.text}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm">
        {/* 月切り替えヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-foreground">
            {format(currentMonth, 'yyyy年M月', { locale: ja })}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* カレンダー */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <>
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 mb-2">
                {weekDays.map((day, i) => (
                  <div
                    key={day}
                    className={cn(
                      'text-center text-xs font-medium py-2',
                      i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : 'text-secondary'
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 日付グリッド */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isUnavailable = unavailableDates.has(dateStr)
                  const isBaseDay = isMonday(day) || isFriday(day)
                  const dayOfWeek = getDay(day)
                  const isSat = dayOfWeek === 6
                  const isSun = dayOfWeek === 0

                  return (
                    <button
                      key={dateStr}
                      onClick={() => isCurrentMonth && toggleDate(dateStr)}
                      disabled={!isCurrentMonth}
                      className={cn(
                        'relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-all',
                        !isCurrentMonth && 'opacity-30 cursor-default',
                        isCurrentMonth && !isUnavailable && 'hover:bg-muted cursor-pointer',
                        isUnavailable && 'bg-red-100 text-red-700 hover:bg-red-200',
                        isBaseDay && !isUnavailable && 'bg-blue-50 font-semibold',
                        isSat && !isUnavailable && 'text-blue-500',
                        isSun && !isUnavailable && 'text-red-500'
                      )}
                    >
                      <span>{format(day, 'd')}</span>
                      {isUnavailable && (
                        <span className="text-[10px] font-medium">不可</span>
                      )}
                      {isBaseDay && !isUnavailable && (
                        <span className="text-[10px] text-blue-500">基本</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 凡例 */}
              <div className="flex items-center gap-4 mt-4 text-xs text-secondary">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200" />
                  <span>基本出勤日</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                  <span>出勤不可</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 保存ボタン */}
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50 transition-all"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Check size={18} />
            )}
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )
}
