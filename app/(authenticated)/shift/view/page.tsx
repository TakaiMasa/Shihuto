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
  getDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Shift, Profile, Store } from '@/lib/types'

export default function ShiftViewPage() {
  const { supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [shifts, setShifts] = useState<(Shift & { profiles: Profile; stores: Store })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('shifts')
      .select('*, profiles(name), stores(name, code)')
      .gte('shift_date', start)
      .lte('shift_date', end)
      .order('shift_date', { ascending: true })

    setShifts((data || []) as any)
    setLoading(false)
  }, [currentMonth, supabase])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  // カレンダー生成
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })
  const weekDays = ['月', '火', '水', '木', '金', '土', '日']

  // 日付ごとのシフトをマッピング
  const shiftsByDate = new Map<string, typeof shifts>()
  shifts.forEach((shift) => {
    const dateStr = shift.shift_date
    if (!shiftsByDate.has(dateStr)) {
      shiftsByDate.set(dateStr, [])
    }
    shiftsByDate.get(dateStr)!.push(shift)
  })

  const selectedShifts = selectedDate ? shiftsByDate.get(selectedDate) || [] : []

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">シフト確認</h1>
      <p className="text-secondary text-sm mb-6">確定済みシフトを確認できます</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* カレンダー */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm">
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

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : (
              <>
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

                <div className="grid grid-cols-7 gap-1">
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const isCurrentMonth = isSameMonth(day, currentMonth)
                    const dayShifts = shiftsByDate.get(dateStr) || []
                    const hasShifts = dayShifts.length > 0
                    const isSelected = selectedDate === dateStr
                    const dayOfWeek = getDay(day)

                    return (
                      <button
                        key={dateStr}
                        onClick={() => isCurrentMonth && setSelectedDate(dateStr)}
                        disabled={!isCurrentMonth}
                        className={cn(
                          'relative min-h-[70px] flex flex-col items-center rounded-lg text-sm transition-all p-1',
                          !isCurrentMonth && 'opacity-30 cursor-default',
                          isCurrentMonth && 'hover:bg-muted cursor-pointer',
                          hasShifts && 'bg-primary-light',
                          isSelected && 'ring-2 ring-primary',
                          dayOfWeek === 6 && 'text-blue-500',
                          dayOfWeek === 0 && 'text-red-500'
                        )}
                      >
                        <span>{format(day, 'd')}</span>
                        {hasShifts && (
                          <div className="flex flex-col items-center gap-0.5 mt-0.5 w-full overflow-hidden">
                            {dayShifts.slice(0, 2).map((shift) => (
                              <span
                                key={shift.id}
                                className="text-[9px] leading-tight text-primary font-medium truncate w-full text-center"
                              >
                                {shift.start_time && shift.end_time
                                  ? `${shift.start_time.substring(0, 5)}〜${shift.end_time.substring(0, 5)}`
                                  : shift.profiles?.name}
                              </span>
                            ))}
                            {dayShifts.length > 2 && (
                              <span className="text-[9px] text-secondary">
                                +{dayShifts.length - 2}名
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 選択日の詳細 */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">
              {selectedDate
                ? format(new Date(selectedDate), 'M月d日（E）', { locale: ja })
                : '日付を選択'}
            </h3>
          </div>
          <div className="p-6">
            {selectedDate ? (
              selectedShifts.length > 0 ? (
                <div className="space-y-3">
                  {selectedShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center text-sm font-bold">
                        {shift.profiles?.name?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{shift.profiles?.name}</p>
                        <p className="text-xs text-secondary">{shift.stores?.name}</p>
                        {shift.start_time && shift.end_time && (
                          <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                            <Clock size={10} />
                            {shift.start_time.substring(0, 5)} 〜 {shift.end_time.substring(0, 5)}
                          </p>
                        )}
                        {shift.notes && (
                          <p className="text-xs text-secondary mt-0.5">{shift.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-secondary text-center py-4">
                  この日のシフトはありません
                </p>
              )
            ) : (
              <p className="text-sm text-secondary text-center py-4">
                カレンダーから日付を選択してください
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
