'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Check,
  X,
  Filter,
  Trash2,
} from 'lucide-react'
import { cn, formatTime, formatMinutesToHours, formatDate } from '@/lib/utils'
import type { Attendance, Store, Profile } from '@/lib/types'

export default function AttendanceManagePage() {
  const { supabase } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [attendances, setAttendances] = useState<(Attendance & { profiles: Profile; stores: Store })[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUserId, setFilterUserId] = useState<string>('')
  const [filterStoreId, setFilterStoreId] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    clock_in: '',
    break1_start: '',
    break1_end: '',
    break2_start: '',
    break2_end: '',
    break3_start: '',
    break3_end: '',
    clock_out: '',
    memo: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    let query = supabase
      .from('attendances')
      .select('*, profiles(name, role), stores(name, code)')
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date', { ascending: false })

    if (filterUserId) query = query.eq('user_id', filterUserId)
    if (filterStoreId) query = query.eq('store_id', filterStoreId)

    const [attRes, profilesRes, storesRes] = await Promise.all([
      query,
      supabase.from('profiles').select('*').eq('is_active', true).order('name'),
      supabase.from('stores').select('*'),
    ])

    setAttendances((attRes.data || []) as any)
    setProfiles(profilesRes.data || [])
    setStores(storesRes.data || [])
    setLoading(false)
  }, [currentMonth, filterUserId, filterStoreId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const startEdit = (att: Attendance) => {
    setEditingId(att.id)
    const fmt = (v: string | null) => v ? format(new Date(v), "yyyy-MM-dd'T'HH:mm") : ''
    setEditForm({
      clock_in: fmt(att.clock_in),
      break1_start: fmt(att.break1_start),
      break1_end: fmt(att.break1_end),
      break2_start: fmt(att.break2_start),
      break2_end: fmt(att.break2_end),
      break3_start: fmt(att.break3_start),
      break3_end: fmt(att.break3_end),
      clock_out: fmt(att.clock_out),
      memo: att.memo || '',
    })
  }

  const saveEdit = async () => {
    if (!editingId) return

    const toIso = (v: string) => v ? new Date(v).toISOString() : null

    const updates: Record<string, string | null> = {
      clock_in: toIso(editForm.clock_in),
      break1_start: toIso(editForm.break1_start),
      break1_end: toIso(editForm.break1_end),
      break2_start: toIso(editForm.break2_start),
      break2_end: toIso(editForm.break2_end),
      break3_start: toIso(editForm.break3_start),
      break3_end: toIso(editForm.break3_end),
      clock_out: toIso(editForm.clock_out),
      memo: editForm.memo || null,
    }

    await supabase.from('attendances').update(updates).eq('id', editingId)
    setEditingId(null)
    fetchData()
  }

  const deleteAttendance = async (id: string) => {
    if (!confirm('この勤怠記録を取り消しますか？この操作は元に戻せません。')) return
    await supabase.from('attendances').delete().eq('id', id)
    fetchData()
  }

  const totalWorkMinutes = attendances.reduce((sum, a) => sum + (a.work_minutes || 0), 0)

  const formatBreakSummary = (att: Attendance) => {
    const breaks: string[] = []
    if (att.break1_start) breaks.push(`${formatTime(att.break1_start)}-${formatTime(att.break1_end)}`)
    if (att.break2_start) breaks.push(`${formatTime(att.break2_start)}-${formatTime(att.break2_end)}`)
    if (att.break3_start) breaks.push(`${formatTime(att.break3_start)}-${formatTime(att.break3_end)}`)
    return breaks.length > 0 ? breaks : ['-']
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">勤怠管理</h1>
      <p className="text-secondary text-sm mb-6">全スタッフの勤怠を管理できます</p>

      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {format(currentMonth, 'yyyy年M月', { locale: ja })}
              </h2>
              <p className="text-xs text-secondary">
                総勤務時間: {formatMinutesToHours(totalWorkMinutes)}
              </p>
            </div>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-secondary" />
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border text-sm bg-white"
            >
              <option value="">全スタッフ</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={filterStoreId}
              onChange={(e) => setFilterStoreId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border text-sm bg-white"
            >
              <option value="">全店舗</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : attendances.length === 0 ? (
            <div className="text-center py-20 text-secondary">
              勤怠データがありません
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-secondary">日付</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary">スタッフ</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary">店舗</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">出勤</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">休憩</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">退勤</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">実働</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {attendances.map((att) => (
                  <tr key={att.id} className="border-b border-border hover:bg-muted/30">
                    {editingId === att.id ? (
                      <>
                        <td className="px-4 py-3 font-medium">{formatDate(att.work_date, 'M/d（E）')}</td>
                        <td className="px-4 py-3">{att.profiles?.name}</td>
                        <td className="px-4 py-3">{att.stores?.name}</td>
                        <td className="px-2 py-2" colSpan={3}>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-secondary w-12">出勤</label>
                              <input type="datetime-local" value={editForm.clock_in}
                                onChange={(e) => setEditForm({ ...editForm, clock_in: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs rounded border border-border" />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-secondary w-12">休憩1</label>
                              <input type="datetime-local" value={editForm.break1_start}
                                onChange={(e) => setEditForm({ ...editForm, break1_start: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs rounded border border-border" />
                              <span className="text-xs">〜</span>
                              <input type="datetime-local" value={editForm.break1_end}
                                onChange={(e) => setEditForm({ ...editForm, break1_end: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs rounded border border-border" />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-secondary w-12">休憩2</label>
                              <input type="datetime-local" value={editForm.break2_start}
                                onChange={(e) => setEditForm({ ...editForm, break2_start: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs rounded border border-border" />
                              <span className="text-xs">〜</span>
                              <input type="datetime-local" value={editForm.break2_end}
                                onChange={(e) => setEditForm({ ...editForm, break2_end: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs rounded border border-border" />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-secondary w-12">休憩3</label>
                              <input type="datetime-local" value={editForm.break3_start}
                                onChange={(e) => setEditForm({ ...editForm, break3_start: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs rounded border border-border" />
                              <span className="text-xs">〜</span>
                              <input type="datetime-local" value={editForm.break3_end}
                                onChange={(e) => setEditForm({ ...editForm, break3_end: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs rounded border border-border" />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-secondary w-12">退勤</label>
                              <input type="datetime-local" value={editForm.clock_out}
                                onChange={(e) => setEditForm({ ...editForm, clock_out: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs rounded border border-border" />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">-</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"><Check size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><X size={14} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-foreground">{formatDate(att.work_date, 'M/d（E）')}</td>
                        <td className="px-4 py-3">{att.profiles?.name}</td>
                        <td className="px-4 py-3 text-secondary">{att.stores?.name}</td>
                        <td className="px-4 py-3 text-center">{formatTime(att.clock_in)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="space-y-0.5">
                            {formatBreakSummary(att).map((b, i) => (
                              <p key={i} className="text-xs">{b}</p>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{formatTime(att.clock_out)}</td>
                        <td className="px-4 py-3 text-center font-medium">
                          {att.work_minutes != null ? formatMinutesToHours(att.work_minutes) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEdit(att)} className="p-1.5 rounded-lg hover:bg-muted text-secondary hover:text-primary transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deleteAttendance(att.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-secondary hover:text-red-600 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
