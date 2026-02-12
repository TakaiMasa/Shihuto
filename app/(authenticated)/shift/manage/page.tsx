'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  isMonday,
  isFriday,
  getDay,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Check, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile, Store, Shift, ShiftUnavailable } from '@/lib/types'

export default function ShiftManagePage() {
  const { supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(addMonths(new Date(), 1))
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [unavailables, setUnavailables] = useState<ShiftUnavailable[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [selectedStore, setSelectedStore] = useState<string>('')

  // 編集中のシフト: { `${userId}-${dateStr}`: storeId }
  const [editingShifts, setEditingShifts] = useState<Map<string, string>>(new Map())

  const fetchData = useCallback(async () => {
    setLoading(true)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    const [profilesRes, storesRes, shiftsRes, unavailableRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('name'),
      supabase.from('stores').select('*'),
      supabase.from('shifts').select('*').gte('shift_date', start).lte('shift_date', end),
      supabase.from('shift_unavailable').select('*').gte('unavailable_date', start).lte('unavailable_date', end),
    ])

    setProfiles(profilesRes.data || [])
    setStores(storesRes.data || [])
    setShifts(shiftsRes.data || [])
    setUnavailables(unavailableRes.data || [])

    if (storesRes.data && storesRes.data.length > 0 && !selectedStore) {
      setSelectedStore(storesRes.data[0].id)
    }

    // 既存シフトを編集マップに反映
    const existing = new Map<string, string>()
    shiftsRes.data?.forEach((s) => {
      existing.set(`${s.user_id}-${s.shift_date}`, s.store_id)
    })
    setEditingShifts(existing)

    setLoading(false)
  }, [currentMonth, supabase, selectedStore])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleShift = (userId: string, dateStr: string) => {
    setEditingShifts((prev) => {
      const next = new Map(prev)
      const key = `${userId}-${dateStr}`
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.set(key, selectedStore)
      }
      return next
    })
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

    // 新しいシフトを挿入
    // key format: UUID(36chars)-YYYY-MM-DD
    const inserts: { user_id: string; store_id: string; shift_date: string }[] = []
    editingShifts.forEach((storeId, key) => {
      const uid = key.substring(0, 36)
      const shiftDate = key.substring(37)
      inserts.push({
        user_id: uid,
        store_id: storeId,
        shift_date: shiftDate,
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

  // 月の基本出勤日(月曜・金曜)を取得
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const baseDays = allDays.filter((d) => isMonday(d) || isFriday(d))

  // 不可日のセット: userId -> Set<dateStr>
  const unavailableMap = new Map<string, Set<string>>()
  unavailables.forEach((u) => {
    if (!unavailableMap.has(u.user_id)) {
      unavailableMap.set(u.user_id, new Set())
    }
    unavailableMap.get(u.user_id)!.add(u.unavailable_date)
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">シフト管理</h1>
      <p className="text-secondary text-sm mb-6">
        スタッフのシフトを確定・編集できます
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
                          'px-2 py-3 text-center font-medium min-w-[60px]',
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
                        const isAssigned = editingShifts.has(key)
                        const isUnavailable = unavailableMap.get(profile.id)?.has(dateStr) || false

                        return (
                          <td key={dateStr} className="px-2 py-3 text-center">
                            {isUnavailable ? (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-400">
                                <X size={14} />
                              </span>
                            ) : (
                              <button
                                onClick={() => toggleShift(profile.id, dateStr)}
                                className={cn(
                                  'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all',
                                  isAssigned
                                    ? 'bg-primary text-white'
                                    : 'bg-muted text-secondary hover:bg-primary-light hover:text-primary'
                                )}
                              >
                                {isAssigned ? <Check size={14} /> : <Plus size={14} />}
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

        {/* 凡例と保存ボタン */}
        <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-secondary">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
              <span>出勤</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded bg-red-50 flex items-center justify-center">
                <X size={12} className="text-red-400" />
              </div>
              <span>出勤不可</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                <Plus size={12} className="text-secondary" />
              </div>
              <span>未割当</span>
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
