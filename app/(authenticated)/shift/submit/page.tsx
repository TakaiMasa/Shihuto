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
import { ChevronLeft, ChevronRight, Check, Loader2, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Store } from '@/lib/types'

interface UnavailableInfo {
  notes: string
}

interface PreferenceInfo {
  startTime: string
  endTime: string
  notes: string
}

// date-fns getDay: 0=Sun, 1=Mon, ..., 6=Sat (DB と同じ)
const DAY_LABELS: Record<number, string> = {
  0: '日', 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土',
}

export default function ShiftSubmitPage() {
  const { user, supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [unavailableDates, setUnavailableDates] = useState<Map<string, UnavailableInfo>>(new Map())
  const [preferences, setPreferences] = useState<Map<string, PreferenceInfo>>(new Map())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    const [unavailableRes, preferencesRes, storesRes] = await Promise.all([
      supabase
        .from('shift_unavailable')
        .select('unavailable_date, notes')
        .eq('user_id', user.id)
        .gte('unavailable_date', start)
        .lte('unavailable_date', end),
      supabase
        .from('shift_preferences')
        .select('preference_date, start_time, end_time, notes')
        .eq('user_id', user.id)
        .gte('preference_date', start)
        .lte('preference_date', end),
      supabase.from('stores').select('*'),
    ])

    const unavMap = new Map<string, UnavailableInfo>()
    unavailableRes.data?.forEach((d) =>
      unavMap.set(d.unavailable_date, { notes: d.notes || '' })
    )
    setUnavailableDates(unavMap)

    const prefMap = new Map<string, PreferenceInfo>()
    preferencesRes.data?.forEach((d) =>
      prefMap.set(d.preference_date, {
        startTime: d.start_time?.substring(0, 5) || '',
        endTime: d.end_time?.substring(0, 5) || '',
        notes: d.notes || '',
      })
    )
    setPreferences(prefMap)
    setStores(storesRes.data || [])

    setLoading(false)
  }, [currentMonth, supabase, user.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setSelectedDate(null)
  }, [currentMonth])

  // 店舗の基本出勤曜日セット
  const baseDaySet = new Set(stores.map((s) => s.base_day_of_week))

  // どの曜日がどの店舗かのラベル
  const baseDayStoreLabel = (dow: number): string | null => {
    const matching = stores.filter((s) => s.base_day_of_week === dow)
    if (matching.length === 0) return null
    return matching.map((s) => s.name).join('/')
  }

  // 基本出勤日の説明テキスト
  const baseDayDescription = stores
    .map((s) => `${s.name}: ${DAY_LABELS[s.base_day_of_week]}曜日`)
    .join('、')

  const handleDateClick = (dateStr: string) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr))
  }

  const toggleUnavailable = (dateStr: string) => {
    setUnavailableDates((prev) => {
      const next = new Map(prev)
      if (next.has(dateStr)) {
        next.delete(dateStr)
      } else {
        next.set(dateStr, { notes: '' })
        setPreferences((p) => {
          const n = new Map(p)
          n.delete(dateStr)
          return n
        })
      }
      return next
    })
  }

  const updateUnavailableNotes = (dateStr: string, notes: string) => {
    setUnavailableDates((prev) => {
      const next = new Map(prev)
      next.set(dateStr, { notes })
      return next
    })
  }

  const updatePreference = (dateStr: string, field: keyof PreferenceInfo, value: string) => {
    setPreferences((prev) => {
      const next = new Map(prev)
      const current = next.get(dateStr) || { startTime: '', endTime: '', notes: '' }
      next.set(dateStr, { ...current, [field]: value })
      return next
    })
  }

  const removePreference = (dateStr: string) => {
    setPreferences((prev) => {
      const next = new Map(prev)
      next.delete(dateStr)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    await Promise.all([
      supabase
        .from('shift_unavailable')
        .delete()
        .eq('user_id', user.id)
        .gte('unavailable_date', start)
        .lte('unavailable_date', end),
      supabase
        .from('shift_preferences')
        .delete()
        .eq('user_id', user.id)
        .gte('preference_date', start)
        .lte('preference_date', end),
    ])

    const errors: string[] = []

    if (unavailableDates.size > 0) {
      const inserts = Array.from(unavailableDates.entries()).map(([date, info]) => ({
        user_id: user.id,
        unavailable_date: date,
        notes: info.notes || null,
      }))
      const { error } = await supabase.from('shift_unavailable').insert(inserts)
      if (error) errors.push('出勤不可日')
    }

    if (preferences.size > 0) {
      const prefInserts = Array.from(preferences.entries())
        .filter(([, info]) => info.startTime && info.endTime)
        .map(([date, info]) => ({
          user_id: user.id,
          preference_date: date,
          start_time: info.startTime,
          end_time: info.endTime,
          notes: info.notes || null,
        }))
      if (prefInserts.length > 0) {
        const { error } = await supabase.from('shift_preferences').insert(prefInserts)
        if (error) errors.push('希望時間')
      }
    }

    if (errors.length > 0) {
      setMessage({ type: 'error', text: `${errors.join('・')}の保存に失敗しました` })
    } else {
      setMessage({ type: 'success', text: '保存しました' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
    setSaving(false)
  }

  // カレンダー生成
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const weekDays = ['月', '火', '水', '木', '金', '土', '日']

  const selectedIsUnavailable = selectedDate ? unavailableDates.has(selectedDate) : false
  const selectedPreference = selectedDate ? preferences.get(selectedDate) : undefined

  const formatTimeShort = (time: string) => {
    const h = parseInt(time.split(':')[0], 10)
    return String(h)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">シフト提出</h1>
      <p className="text-secondary text-sm mb-6">
        日付をタップして希望時間や出勤不可を設定してください
        {baseDayDescription && `（基本出勤日: ${baseDayDescription}）`}
      </p>

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
                  const pref = preferences.get(dateStr)
                  const hasPreference = pref && pref.startTime && pref.endTime
                  const dayOfWeek = getDay(day)
                  const isBaseDay = baseDaySet.has(dayOfWeek)
                  const isSat = dayOfWeek === 6
                  const isSun = dayOfWeek === 0
                  const isSelected = selectedDate === dateStr

                  return (
                    <button
                      key={dateStr}
                      onClick={() => isCurrentMonth && handleDateClick(dateStr)}
                      disabled={!isCurrentMonth}
                      className={cn(
                        'relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-all',
                        !isCurrentMonth && 'opacity-30 cursor-default',
                        isCurrentMonth && 'cursor-pointer',
                        isSelected && 'ring-2 ring-primary',
                        isUnavailable && 'bg-red-100 text-red-700 hover:bg-red-200',
                        !isUnavailable && hasPreference && 'bg-green-100 text-green-700 hover:bg-green-200',
                        !isUnavailable && !hasPreference && isBaseDay && 'bg-blue-50 font-semibold',
                        !isUnavailable && !hasPreference && !isBaseDay && 'hover:bg-muted',
                        isSat && !isUnavailable && !hasPreference && 'text-blue-500',
                        isSun && !isUnavailable && !hasPreference && 'text-red-500'
                      )}
                    >
                      <span>{format(day, 'd')}</span>
                      {isUnavailable && (
                        <span className="text-[10px] font-medium">不可</span>
                      )}
                      {!isUnavailable && hasPreference && pref && (
                        <span className="text-[10px] font-medium">
                          {formatTimeShort(pref.startTime)}-{formatTimeShort(pref.endTime)}
                        </span>
                      )}
                      {isBaseDay && !isUnavailable && !hasPreference && (
                        <span className="text-[10px] text-blue-500">基本</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 凡例 */}
              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-secondary">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200" />
                  <span>基本出勤日</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                  <span>出勤不可</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
                  <span>希望時間あり</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 詳細パネル */}
        {selectedDate && !loading && (
          <div className="px-6 py-4 border-t border-border">
            <h3 className="font-semibold text-foreground mb-3">
              {format(new Date(selectedDate), 'M月d日（E）', { locale: ja })} の設定
            </h3>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIsUnavailable}
                onChange={() => toggleUnavailable(selectedDate)}
                className="w-4 h-4 rounded border-border text-red-500 focus:ring-red-400"
              />
              <span className="text-sm font-medium text-foreground">出勤不可</span>
            </label>

            {selectedIsUnavailable ? (
              <div>
                <label className="block text-xs text-secondary mb-1">理由（任意）</label>
                <input
                  type="text"
                  value={unavailableDates.get(selectedDate)?.notes || ''}
                  onChange={(e) => updateUnavailableNotes(selectedDate, e.target.value)}
                  placeholder="例: 大学の試験"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-secondary mb-2">
                  <Clock size={14} />
                  <span>希望時間帯</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={selectedPreference?.startTime || ''}
                    onChange={(e) => updatePreference(selectedDate, 'startTime', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-secondary">〜</span>
                  <input
                    type="time"
                    value={selectedPreference?.endTime || ''}
                    onChange={(e) => updatePreference(selectedDate, 'endTime', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {selectedPreference && (selectedPreference.startTime || selectedPreference.endTime) && (
                    <button
                      onClick={() => removePreference(selectedDate)}
                      className="p-1.5 rounded-lg hover:bg-muted text-secondary transition-colors"
                      title="希望時間をクリア"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-secondary mb-1">備考（任意）</label>
                  <input
                    type="text"
                    value={selectedPreference?.notes || ''}
                    onChange={(e) => updatePreference(selectedDate, 'notes', e.target.value)}
                    placeholder="例: 午前のみ希望"
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>
        )}

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
