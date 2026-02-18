'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  getDay,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Check, X, Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile, Store, Shift, ShiftUnavailable, ShiftPreference } from '@/lib/types'

interface ShiftEntry {
  storeId: string
  startTime: string
  endTime: string
  notes: string
}

export default function ShiftManagePage() {
  const { supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(addMonths(new Date(), 1))
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [unavailables, setUnavailables] = useState<ShiftUnavailable[]>([])
  const [preferences, setPreferences] = useState<ShiftPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [selectedStore, setSelectedStore] = useState<string>('')

  // 編集中のシフト: { `${userId}-${dateStr}`: ShiftEntry }
  const [editingShifts, setEditingShifts] = useState<Map<string, ShiftEntry>>(new Map())

  // 選択中のセル（詳細パネル表示用）
  const [selectedCell, setSelectedCell] = useState<{ userId: string; dateStr: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    const [profilesRes, storesRes, shiftsRes, unavailableRes, preferencesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('name'),
      supabase.from('stores').select('*'),
      supabase.from('shifts').select('*').gte('shift_date', start).lte('shift_date', end),
      supabase.from('shift_unavailable').select('*').gte('unavailable_date', start).lte('unavailable_date', end),
      supabase.from('shift_preferences').select('*').gte('preference_date', start).lte('preference_date', end),
    ])

    setProfiles(profilesRes.data || [])
    setStores(storesRes.data || [])
    setShifts(shiftsRes.data || [])
    setUnavailables(unavailableRes.data || [])
    setPreferences(preferencesRes.data || [])

    if (storesRes.data && storesRes.data.length > 0 && !selectedStore) {
      setSelectedStore(storesRes.data[0].id)
    }

    // 既存シフトを編集マップに反映
    const existing = new Map<string, ShiftEntry>()
    shiftsRes.data?.forEach((s) => {
      existing.set(`${s.user_id}-${s.shift_date}`, {
        storeId: s.store_id,
        startTime: s.start_time ? s.start_time.substring(0, 5) : '',
        endTime: s.end_time ? s.end_time.substring(0, 5) : '',
        notes: s.notes || '',
      })
    })
    setEditingShifts(existing)

    setLoading(false)
  }, [currentMonth, supabase, selectedStore])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 店舗変更時に選択セルをリセット
  useEffect(() => {
    setSelectedCell(null)
  }, [selectedStore, currentMonth])

  // 希望時間マップ: `${userId}-${dateStr}` -> ShiftPreference
  const preferenceMap = new Map<string, ShiftPreference>()
  preferences.forEach((p) => {
    preferenceMap.set(`${p.user_id}-${p.preference_date}`, p)
  })

  // 不可日マップ: `${userId}-${dateStr}` -> ShiftUnavailable
  const unavailableDetailMap = new Map<string, ShiftUnavailable>()
  unavailables.forEach((u) => {
    unavailableDetailMap.set(`${u.user_id}-${u.unavailable_date}`, u)
  })

  // 選択店舗の情報
  const currentStore = stores.find((s) => s.id === selectedStore)
  const baseDayOfWeek = currentStore?.base_day_of_week ?? 1

  // セルクリック
  const handleCellClick = (userId: string, dateStr: string) => {
    const key = `${userId}-${dateStr}`
    const isUnavailable = unavailableDetailMap.has(key)
    if (isUnavailable) return

    setSelectedCell({ userId, dateStr })

    // まだシフトが入っていなければ、希望時間をデフォルトでセット
    if (!editingShifts.has(key)) {
      const pref = preferenceMap.get(key)
      setEditingShifts((prev) => {
        const next = new Map(prev)
        next.set(key, {
          storeId: selectedStore,
          startTime: pref ? pref.start_time.substring(0, 5) : '',
          endTime: pref ? pref.end_time.substring(0, 5) : '',
          notes: pref?.notes || '',
        })
        return next
      })
    }
  }

  // シフトエントリ更新
  const updateShiftEntry = (key: string, field: keyof ShiftEntry, value: string) => {
    setEditingShifts((prev) => {
      const next = new Map(prev)
      const current = next.get(key)
      if (current) {
        next.set(key, { ...current, [field]: value })
      }
      return next
    })
  }

  // シフト削除
  const removeShift = (key: string) => {
    setEditingShifts((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
    setSelectedCell(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    // 既存シフトを削除
    await supabase
      .from('shifts')
      .delete()
      .gte('shift_date', start)
      .lte('shift_date', end)

    // 新しいシフトを挿入（時間が両方入っているもののみ）
    const inserts: { user_id: string; store_id: string; shift_date: string; start_time: string | null; end_time: string | null; notes: string | null }[] = []
    editingShifts.forEach((entry, key) => {
      if (!entry.startTime || !entry.endTime) return
      const uid = key.substring(0, 36)
      const shiftDate = key.substring(37)
      inserts.push({
        user_id: uid,
        store_id: entry.storeId,
        shift_date: shiftDate,
        start_time: entry.startTime || null,
        end_time: entry.endTime || null,
        notes: entry.notes || null,
      })
    })

    if (inserts.length > 0) {
      const { error } = await supabase.from('shifts').insert(inserts)
      if (error) {
        setMessage({ type: 'error', text: `保存に失敗しました: ${error.message}` })
        setSaving(false)
        return
      }
    }

    setMessage({ type: 'success', text: 'シフトを保存しました' })
    setSaving(false)
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  // 月の該当曜日の日付を取得
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const baseDays = allDays.filter((d) => getDay(d) === baseDayOfWeek)

  // 不可日のセット: userId -> Set<dateStr>
  const unavailableMap = new Map<string, Set<string>>()
  unavailables.forEach((u) => {
    if (!unavailableMap.has(u.user_id)) {
      unavailableMap.set(u.user_id, new Set())
    }
    unavailableMap.get(u.user_id)!.add(u.unavailable_date)
  })

  // 時間表示ヘルパー
  const formatTimeShort = (time: string) => {
    if (!time) return ''
    const h = parseInt(time.split(':')[0], 10)
    const m = time.split(':')[1]
    return m === '00' ? String(h) : `${h}:${m}`
  }

  // 選択セルのキーと情報
  const selectedKey = selectedCell ? `${selectedCell.userId}-${selectedCell.dateStr}` : null
  const selectedEntry = selectedKey ? editingShifts.get(selectedKey) : undefined
  const selectedPref = selectedKey ? preferenceMap.get(selectedKey) : undefined
  const selectedProfile = selectedCell ? profiles.find((p) => p.id === selectedCell.userId) : undefined

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">シフト管理</h1>
      <p className="text-secondary text-sm mb-6">
        セルをクリックして時間を入力し、シフトを確定できます
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
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-4">
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

          <div className="flex items-center gap-3">
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border text-sm bg-white"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* シフト表 */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 bg-card px-4 py-3 text-left font-medium text-secondary w-32">
                    スタッフ
                  </th>
                  {baseDays.map((day) => {
                    const dayOfWeek = getDay(day)
                    return (
                      <th
                        key={format(day, 'yyyy-MM-dd')}
                        className={cn(
                          'px-2 py-3 text-center font-medium min-w-[80px]',
                          dayOfWeek === 6 ? 'text-blue-500' : dayOfWeek === 0 ? 'text-red-500' : 'text-secondary'
                        )}
                      >
                        <div>{format(day, 'd')}</div>
                        <div className="text-xs">{format(day, 'E', { locale: ja })}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {profiles
                  .filter((p) => p.role === 'staff')
                  .map((profile) => (
                    <tr key={profile.id} className="border-b border-border hover:bg-muted/30">
                      <td className="sticky left-0 bg-card px-4 py-3 font-medium text-foreground">
                        {profile.name}
                      </td>
                      {baseDays.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const key = `${profile.id}-${dateStr}`
                        const shiftEntry = editingShifts.get(key)
                        const hasTime = shiftEntry && shiftEntry.startTime && shiftEntry.endTime
                        const isUnavailable = unavailableMap.get(profile.id)?.has(dateStr) || false
                        const pref = preferenceMap.get(key)
                        const isSelected = selectedCell?.userId === profile.id && selectedCell?.dateStr === dateStr

                        return (
                          <td key={dateStr} className="px-1 py-2 text-center">
                            {isUnavailable ? (
                              <div className="flex flex-col items-center">
                                <span className="inline-flex items-center justify-center w-full py-1.5 rounded-lg bg-red-50 text-red-400 text-xs">
                                  <X size={12} className="mr-0.5" />不可
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleCellClick(profile.id, dateStr)}
                                className={cn(
                                  'w-full py-1.5 rounded-lg transition-all text-xs leading-tight',
                                  isSelected && 'ring-2 ring-primary',
                                  hasTime
                                    ? 'bg-primary text-white font-medium'
                                    : 'bg-muted text-secondary hover:bg-primary-light hover:text-primary'
                                )}
                              >
                                {hasTime ? (
                                  <span>{formatTimeShort(shiftEntry.startTime)}-{formatTimeShort(shiftEntry.endTime)}</span>
                                ) : (
                                  <span className="text-[10px]">
                                    {pref ? (
                                      <span className="text-green-600">
                                        希望{formatTimeShort(pref.start_time)}-{formatTimeShort(pref.end_time)}
                                      </span>
                                    ) : (
                                      '---'
                                    )}
                                  </span>
                                )}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 詳細パネル */}
        {selectedCell && selectedEntry && (
          <div className="px-6 py-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">
                {selectedProfile?.name} - {format(new Date(selectedCell.dateStr), 'M月d日（E）', { locale: ja })}
              </h3>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1 rounded-lg hover:bg-muted text-secondary"
              >
                <X size={16} />
              </button>
            </div>

            {/* 希望時間の参考表示 */}
            {selectedPref && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 flex items-center gap-1.5">
                <Clock size={12} />
                スタッフ希望: {selectedPref.start_time.substring(0, 5)} 〜 {selectedPref.end_time.substring(0, 5)}
                {selectedPref.notes && ` (${selectedPref.notes})`}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-secondary mb-1">開始時間</label>
                <input
                  type="time"
                  value={selectedEntry.startTime}
                  onChange={(e) => updateShiftEntry(selectedKey!, 'startTime', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">終了時間</label>
                <input
                  type="time"
                  value={selectedEntry.endTime}
                  onChange={(e) => updateShiftEntry(selectedKey!, 'endTime', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-secondary mb-1">備考</label>
                <input
                  type="text"
                  value={selectedEntry.notes}
                  onChange={(e) => updateShiftEntry(selectedKey!, 'notes', e.target.value)}
                  placeholder="備考（任意）"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => removeShift(selectedKey!)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-500 text-sm hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                削除
              </button>
            </div>
          </div>
        )}

        {/* 凡例と保存ボタン */}
        <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-secondary">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-4 rounded bg-primary" />
              <span>確定シフト</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-4 rounded bg-red-50 border border-red-200" />
              <span>出勤不可</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-green-600" />
              <span className="text-green-600">希望時間</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {saving ? '保存中...' : 'シフトを確定する'}
          </button>
        </div>
      </div>
    </div>
  )
}
