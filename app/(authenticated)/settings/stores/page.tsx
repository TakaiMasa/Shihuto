'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Loader2, Pencil, Check, X, Store as StoreIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Store } from '@/lib/types'

export default function StoreSettingsPage() {
  const { supabase } = useAuth()
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    has_transportation_fee: false,
  })

  const fetchStores = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('stores').select('*').order('name')
    setStores((data || []) as Store[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  const startEdit = (store: Store) => {
    setEditingId(store.id)
    setEditForm({
      name: store.name,
      code: store.code,
      has_transportation_fee: store.has_transportation_fee,
    })
  }

  const saveEdit = async () => {
    if (!editingId) return

    await supabase
      .from('stores')
      .update({
        name: editForm.name,
        code: editForm.code,
        has_transportation_fee: editForm.has_transportation_fee,
      })
      .eq('id', editingId)

    setEditingId(null)
    fetchStores()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">店舗設定</h1>
      <p className="text-secondary text-sm mb-6">店舗情報の確認・編集ができます</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          stores.map((store) => (
            <div
              key={store.id}
              className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            >
              {editingId === store.id ? (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      店舗名
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      店舗コード
                    </label>
                    <input
                      type="text"
                      value={editForm.code}
                      onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`fee-${store.id}`}
                      checked={editForm.has_transportation_fee}
                      onChange={(e) =>
                        setEditForm({ ...editForm, has_transportation_fee: e.target.checked })
                      }
                      className="rounded"
                    />
                    <label htmlFor={`fee-${store.id}`} className="text-sm text-foreground">
                      交通費支給あり
                    </label>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-all"
                    >
                      <Check size={16} />
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-all"
                    >
                      <X size={16} />
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-primary to-blue-400 px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StoreIcon size={24} />
                        <h3 className="text-lg font-bold">{store.name}</h3>
                      </div>
                      <button
                        onClick={() => startEdit(store)}
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-secondary text-sm">店舗コード</span>
                      <span className="font-mono text-sm font-medium text-foreground bg-muted px-2 py-0.5 rounded">
                        {store.code}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-secondary text-sm">打刻ページURL</span>
                      <span className="font-mono text-xs text-primary">
                        /attendance/{store.code}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-secondary text-sm">交通費支給</span>
                      <span
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          store.has_transportation_fee
                            ? 'bg-green-50 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {store.has_transportation_fee ? 'あり' : 'なし'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
