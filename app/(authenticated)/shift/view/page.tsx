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
import { ChevronLeft, ChevronRight, Loader2, Clock, BarChart2, List, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Shift, Profile, Store } from '@/lib/types'
import { getStoreHourlyWage } from '@/lib/wages'

type ShiftWithRelations = Shift & { profiles: Profile; stores: Store }

// 時刻文字列（"HH:MM" or "HH:MM:SS"）を分に変換
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// 分を "H:MM" 形式に変換
function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, '0')}`
}

interface BarChartProps {
  shifts: ShiftWithRelations[]
}

function ShiftBarChart({ shifts }: BarChartProps) {
  if (shifts.length === 0) return null

  // 表示範囲を計算（最小 8:00〜22:00、実データに合わせて拡張）
  const allMinutes = shifts.flatMap((s) => [
    s.start_time ? timeToMinutes(s.start_time) : null,
    s.end_time ? timeToMinutes(s.end_time) : null,
  ]).filter((m): m is number => m !== null)

  const minTime = Math.min(480, ...allMinutes) // 8:00 = 480分
  const maxTime = Math.max(1320, ...allMinutes) // 22:00 = 1320分
  const totalSpan = maxTime - minTime

  // 目盛りラベル（1時間ごと）
  const tickHours: number[] = []
  const startHour = Math.floor(minTime / 60)
  const endHour = Math.ceil(maxTime / 60)
  for (let h = startHour; h <= endHour; h++) {
    tickHours.push(h)
  }

  const toPercent = (minutes: number) => ((minutes - minTime) / totalSpan) * 100

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[360px]">
        {/* 時間軸ラベル */}
        <div className="relative h-6 ml-24 mb-1">
          {tickHours.map((h) => {
            const pct = toPercent(h * 60)
            if (pct < 0 || pct > 100) return null
            return (
              <span
                key={h}
                className="absolute text-[10px] text-secondary -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                {h}
              </span>
            )
          })}
        </div>

        {/* グリッド線 + バー */}
        <div className="space-y-2">
          {shifts.map((shift) => {
            const hasTime = shift.start_time && shift.end_time
            if (!hasTime) return null

            const startMin = timeToMinutes(shift.start_time!)
            const endMin = timeToMinutes(shift.end_time!)
            const breakStartMin = shift.break_start_time ? timeToMinutes(shift.break_start_time) : null
            const breakEndMin = shift.break_end_time ? timeToMinutes(shift.break_end_time) : null

            const barLeft = toPercent(startMin)
            const barRight = toPercent(endMin)
            const barWidth = barRight - barLeft

            // 休憩部分（バー内の相対位置）
            let breakLeft: number | null = null
            let breakWidth: number | null = null
            if (breakStartMin !== null && breakEndMin !== null) {
              breakLeft = ((breakStartMin - startMin) / (endMin - startMin)) * 100
              breakWidth = ((breakEndMin - breakStartMin) / (endMin - startMin)) * 100
            }

            return (
              <div key={shift.id} className="flex items-center gap-2">
                {/* スタッフ名 */}
                <div className="w-24 shrink-0 text-xs text-foreground font-medium text-right pr-2 truncate">
                  {shift.profiles?.name}
                </div>

                {/* バー領域 */}
                <div className="relative flex-1 h-7 bg-muted rounded-sm">
                  {/* グリッド線 */}
                  {tickHours.map((h) => {
                    const pct = toPercent(h * 60)
                    if (pct <= 0 || pct >= 100) return null
                    return (
                      <div
                        key={h}
                        className="absolute top-0 bottom-0 border-l border-border/60"
                        style={{ left: `${pct}%` }}
                      />
                    )
                  })}

                  {/* 勤務バー */}
                  <div
                    className="absolute top-1 bottom-1 bg-primary rounded"
                    style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                  >
                    {/* 休憩帯 */}
                    {breakLeft !== null && breakWidth !== null && (
                      <div
                        className="absolute top-0 bottom-0 bg-amber-300 rounded-sm opacity-80"
                        style={{ left: `${breakLeft}%`, width: `${breakWidth}%` }}
                      />
                    )}
                    {/* 時刻ラベル（バーが十分広い場合） */}
                    {barWidth > 8 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-medium pointer-events-none">
                        {shift.start_time!.substring(0, 5)}〜{shift.end_time!.substring(0, 5)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 時間数 */}
                <div className="w-12 shrink-0 text-xs text-secondary text-right">
                  {(() => {
                    let work = endMin - startMin
                    if (breakStartMin !== null && breakEndMin !== null) {
                      work -= breakEndMin - breakStartMin
                    }
                    return `${minutesToLabel(work)}h`
                  })()}
                </div>
              </div>
            )
          })}
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-4 mt-4 text-xs text-secondary">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded bg-primary" />
            <span>勤務</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded bg-amber-300" />
            <span>休憩</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ShiftViewPage() {
  const { supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [shifts, setShifts] = useState<ShiftWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('chart')
  const [hourlyWagesByStaffStore, setHourlyWagesByStaffStore] = useState<Record<string, Map<string, number>>>({})

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    const [{ data: shiftsData }, { data: wagesData }] = await Promise.all([
      supabase
        .from('shifts')
        .select('*, profiles(name, hourly_wage), stores(name, code)')
        .gte('shift_date', start)
        .lte('shift_date', end)
        .order('shift_date', { ascending: true }),
      supabase
        .from('staff_store_hourly_wages')
        .select('user_id, store_id, hourly_wage'),
    ])

    const hourlyWageMap: Record<string, Map<string, number>> = {}
    wagesData?.forEach((wage) => {
      if (!hourlyWageMap[wage.user_id]) {
        hourlyWageMap[wage.user_id] = new Map()
      }
      hourlyWageMap[wage.user_id].set(wage.store_id, wage.hourly_wage)
    })

    setShifts((shiftsData || []) as ShiftWithRelations[])
    setHourlyWagesByStaffStore(hourlyWageMap)
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
  const shiftsByDate = new Map<string, ShiftWithRelations[]>()
  shifts.forEach((shift) => {
    const dateStr = shift.shift_date
    if (!shiftsByDate.has(dateStr)) {
      shiftsByDate.set(dateStr, [])
    }
    shiftsByDate.get(dateStr)!.push(shift)
  })

  const selectedShifts = selectedDate ? shiftsByDate.get(selectedDate) || [] : []
  // 開始時間順にソート
  const sortedSelectedShifts = [...selectedShifts].sort((a, b) => {
    if (!a.start_time) return 1
    if (!b.start_time) return -1
    return a.start_time.localeCompare(b.start_time)
  })

  const getShiftHourlyWage = (shift: ShiftWithRelations) =>
    getStoreHourlyWage(
      hourlyWagesByStaffStore[shift.user_id],
      shift.store_id,
      shift.profiles?.hourly_wage ?? 0
    )

  // 選択日の合計人件費
  const dailyLaborCost = sortedSelectedShifts.reduce((total, shift) => {
    if (!shift.start_time || !shift.end_time) return total
    let work = timeToMinutes(shift.end_time) - timeToMinutes(shift.start_time)
    if (shift.break_start_time && shift.break_end_time) {
      work -= timeToMinutes(shift.break_end_time) - timeToMinutes(shift.break_start_time)
    }
    work = Math.max(0, work)
    const wage = getShiftHourlyWage(shift)
    return total + Math.round((work / 60) * wage)
  }, 0)

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
                        onClick={() => {
                          if (!isCurrentMonth) return
                          setSelectedDate(isSelected ? null : dateStr)
                        }}
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
                            <span className="text-[10px] text-primary font-medium">
                              {dayShifts.length}名
                            </span>
                            {dayShifts.slice(0, 1).map((shift) => (
                              <span
                                key={shift.id}
                                className="text-[9px] leading-tight text-primary/70 truncate w-full text-center"
                              >
                                {shift.start_time && shift.end_time
                                  ? `${shift.start_time.substring(0, 5)}〜`
                                  : shift.profiles?.name}
                              </span>
                            ))}
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
        <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              {selectedDate
                ? format(new Date(selectedDate), 'M月d日（E）', { locale: ja })
                : '日付を選択'}
            </h3>
            {selectedDate && selectedShifts.length > 0 && (
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button
                  onClick={() => setViewMode('chart')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'chart' ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-foreground'
                  )}
                  title="グラフ表示"
                >
                  <BarChart2 size={15} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'list' ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-foreground'
                  )}
                  title="リスト表示"
                >
                  <List size={15} />
                </button>
              </div>
            )}
            </div>
            {selectedDate && selectedShifts.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-700">
                <Banknote size={12} />
                <span>予定人件費合計: <span className="font-semibold text-sm">¥{dailyLaborCost.toLocaleString()}</span></span>
                <span className="text-orange-400 ml-1">({selectedShifts.length}名)</span>
              </div>
            )}
          </div>
          <div className="p-6 flex-1">
            {selectedDate ? (
              selectedShifts.length > 0 ? (
                viewMode === 'chart' ? (
                  <ShiftBarChart shifts={sortedSelectedShifts} />
                ) : (
                  <div className="space-y-3">
                    {sortedSelectedShifts.map((shift) => (
                      <div
                        key={shift.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {shift.profiles?.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{shift.profiles?.name}</p>
                          <p className="text-xs text-secondary">{shift.stores?.name}</p>
                          {shift.start_time && shift.end_time && (
                            <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {shift.start_time.substring(0, 5)} 〜 {shift.end_time.substring(0, 5)}
                            </p>
                          )}
                          {shift.break_start_time && shift.break_end_time && (
                            <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              休憩: {shift.break_start_time.substring(0, 5)} 〜 {shift.break_end_time.substring(0, 5)}
                            </p>
                          )}
                          {shift.notes && (
                            <p className="text-xs text-secondary mt-0.5">{shift.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
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
