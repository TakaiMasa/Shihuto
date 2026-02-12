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
    break_start: '',
    break_end: '',
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
    setEditForm({
      clock_in: att.clock_in ? format(new Date(att.clock_in), "yyyy-MM-dd'T'HH:mm") : '',
      break_start: att.break_start ? format(new Date(att.break_start), "yyyy-MM-dd'T'HH:mm") : '',
      break_end: att.break_end ? format(new Date(att.break_end), "yyyy-MM-dd'T'HH:mm") : '',
      clock_out: att.clock_out ? format(new Date(att.clock_out), "yyyy-MM-dd'T'HH:mm") : '',
      memo: att.memo || '',
    })
  }

  const saveEdit = async () => {
    if (!editingId) return

    const updates: Record<string, string | null> = {
      clock_in: editForm.clock_in ? new Date(editForm.clock_in).toISOString() : null,
      break_start: editForm.break_start ? new Date(editForm.break_start).toISOString() : null,
      break_end: editForm.break_end ? new Date(editForm.break_end).toISOString() : null,
      clock_out: editForm.clock_out ? new Date(editForm.clock_out).toISOString() : null,
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">勤怠管理</h1>
      <p className="text-secondary text-sm mb-6">全スタッフの勤怠を管理できます</p>

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

        {/* テーブル */}
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
                  <th className="px-4 py-3 text-center font-medium text-secondary">休憩開始</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">休憩終了</th>
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
                        <td className="px-2 py-2">
                          <input type="datetime-local" value={editForm.clock_in}
                            onChange={(e) => setEditForm({ ...editForm, clock_in: e.target.value })}
                            className="w-full px-2 py-1 text-xs rounded border border-border" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="datetime-local" value={editForm.break_start}
                            onChange={(e) => setEditForm({ ...editForm, break_start: e.target.value })}
                            className="w-full px-2 py-1 text-xs rounded border border-border" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="datetime-local" value={editForm.break_end}
                            onChange={(e) => setEditForm({ ...editForm, break_end: e.target.value })}
                            className="w-full px-2 py-1 text-xs rounded border border-border" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="datetime-local" value={editForm.clock_out}
                            onChange={(e) => setEditForm({ ...editForm, clock_out: e.target.value })}
                            className="w-full px-2 py-1 text-xs rounded border border-border" />
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
                        <td className="px-4 py-3 text-center">{formatTime(att.break_start)}</td>
                        <td className="px-4 py-3 text-center">{formatTime(att.break_end)}</td>
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
