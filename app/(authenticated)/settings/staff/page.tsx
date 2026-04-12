'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import {
  Loader2,
  Plus,
  Pencil,
  X,
  Check,
  UserPlus,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import { createStaffUser } from '@/app/actions/auth'

export default function StaffSettingsPage() {
  const { supabase } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState({ type: '', text: '' })

  // 新規登録フォーム
  const [newForm, setNewForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'staff' as 'staff' | 'admin',
    hourly_wage: 1000,
  })

  // 編集フォーム
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'staff' as 'staff' | 'admin',
    hourly_wage: 1000,
    is_active: true,
  })

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name')

    setProfiles((data || []) as Profile[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    const result = await createStaffUser({
      email: newForm.email,
      password: newForm.password,
      name: newForm.name,
      role: newForm.role,
      hourly_wage: newForm.hourly_wage,
    })

    if (result.error) {
      setMessage({ type: 'error', text: `登録に失敗しました: ${result.error}` })
      return
    }

    setMessage({ type: 'success', text: 'スタッフを登録しました' })
    setShowAddForm(false)
    setNewForm({ email: '', password: '', name: '', role: 'staff', hourly_wage: 1000 })
    fetchProfiles()
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const startEdit = (profile: Profile) => {
    setEditingId(profile.id)
    setEditForm({
      name: profile.name,
      role: profile.role,
      hourly_wage: profile.hourly_wage,
      is_active: profile.is_active,
    })
  }

  const saveEdit = async () => {
    if (!editingId) return

    await supabase
      .from('profiles')
      .update({
        name: editForm.name,
        role: editForm.role,
        hourly_wage: editForm.hourly_wage,
        is_active: editForm.is_active,
      })
      .eq('id', editingId)

    setEditingId(null)
    fetchProfiles()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">スタッフ管理</h1>
          <p className="text-secondary text-sm mt-1">スタッフの登録・編集ができます</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-all"
        >
          {showAddForm ? <X size={16} /> : <UserPlus size={16} />}
          {showAddForm ? '閉じる' : '新規登録'}
        </button>
      </div>

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

      {/* 新規登録フォーム */}
      {showAddForm && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">新規スタッフ登録</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">メールアドレス</label>
              <input
                type="email"
                value={newForm.email}
                onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">パスワード</label>
              <input
                type="password"
                value={newForm.password}
                onChange={(e) => setNewForm({ ...newForm, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                placeholder="6文字以上"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">氏名</label>
              <input
                type="text"
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">権限</label>
              <select
                value={newForm.role}
                onChange={(e) => setNewForm({ ...newForm, role: e.target.value as 'staff' | 'admin' })}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white"
              >
                <option value="staff">スタッフ</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">時給（円）</label>
              <input
                type="number"
                value={newForm.hourly_wage}
                onChange={(e) => setNewForm({ ...newForm, hourly_wage: parseInt(e.target.value) || 0 })}
                required
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-all"
              >
                <Plus size={18} />
                登録する
              </button>
            </div>
          </form>
        </div>
      )}

      {/* スタッフ一覧 */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-secondary">氏名</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">権限</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">時給</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">状態</th>
                  <th className="px-4 py-3 text-center font-medium text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className={cn(
                      'border-b border-border hover:bg-muted/30',
                      !profile.is_active && 'opacity-50'
                    )}
                  >
                    {editingId === profile.id ? (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-2 py-1 rounded border border-border text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'staff' | 'admin' })}
                            className="px-2 py-1 rounded border border-border text-sm bg-white"
                          >
                            <option value="staff">スタッフ</option>
                            <option value="admin">管理者</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            value={editForm.hourly_wage}
                            onChange={(e) => setEditForm({ ...editForm, hourly_wage: parseInt(e.target.value) || 0 })}
                            className="w-20 px-2 py-1 rounded border border-border text-sm text-center"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <label className="flex items-center justify-center gap-1">
                            <input
                              type="checkbox"
                              checked={editForm.is_active}
                              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-xs">有効</span>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary-light text-primary flex items-center justify-center text-xs font-bold">
                              {profile.name.charAt(0)}
                            </div>
                            {profile.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              'px-2 py-1 rounded-full text-xs font-medium',
                              profile.role === 'admin'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {profile.role === 'admin' ? '管理者' : 'スタッフ'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {formatCurrency(profile.hourly_wage)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              'px-2 py-1 rounded-full text-xs font-medium',
                              profile.is_active
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                            )}
                          >
                            {profile.is_active ? '有効' : '無効'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => startEdit(profile)}
                            className="p-1.5 rounded-lg hover:bg-muted text-secondary hover:text-primary transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
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
