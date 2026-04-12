'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Loader2, Check, Train } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Store, Profile } from '@/lib/types'

// 管理者ビュー：全スタッフ×全店舗を一覧で編集
function AdminView() {
  const { supabase } = useAuth()
  const [stores, setStores] = useState<Store[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  // feeData[userId][storeId] = fee
  const [feeData, setFeeData] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [storesRes, profilesRes, feesRes] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('profiles').select('*').eq('is_active', true).order('name'),
      supabase.from('staff_transportation_fees').select('user_id, store_id, fee'),
    ])

    setStores((storesRes.data || []) as Store[])
    setProfiles((profilesRes.data || []) as Profile[])

    const map: Record<string, Record<string, number>> = {}
    feesRes.data?.forEach((f) => {
      if (!map[f.user_id]) map[f.user_id] = {}
      map[f.user_id][f.store_id] = f.fee
    })
    setFeeData(map)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFeeChange = (userId: string, storeId: string, value: number) => {
    setFeeData((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), [storeId]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    const upserts = profiles.flatMap((profile) =>
      stores.map((store) => ({
        user_id: profile.id,
        store_id: store.id,
        fee: feeData[profile.id]?.[store.id] ?? 0,
      }))
    )

    const { error } = await supabase
      .from('staff_transportation_fees')
      .upsert(upserts, { onConflict: 'user_id,store_id' })

    if (error) {
      setMessage({ type: 'error', text: '保存に失敗しました' })
    } else {
      setMessage({ type: 'success', text: '保存しました' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  return (
    <>
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

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-secondary">スタッフ</th>
              {stores.map((store) => (
                <th key={store.id} className="px-4 py-3 text-center font-medium text-secondary">
                  <div className="flex items-center justify-center gap-1.5">
                    <Train size={14} />
                    {store.name}
                  </div>
                  <div className="text-xs font-normal text-secondary/60 mt-0.5">円 / 回</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-b border-border hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {profile.name.charAt(0)}
                    </div>
                    {profile.name}
                  </div>
                </td>
                {stores.map((store) => (
                  <td key={store.id} className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min="0"
                      value={feeData[profile.id]?.[store.id] ?? 0}
                      onChange={(e) =>
                        handleFeeChange(profile.id, store.id, Number(e.target.value))
                      }
                      className="w-24 px-2 py-1.5 rounded-lg border border-border text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50 transition-all"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </>
  )
}

// スタッフビュー：自分の交通費のみ編集
function StaffView() {
  const { user, supabase } = useAuth()
  const [stores, setStores] = useState<Store[]>([])
  const [fees, setFees] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [storesRes, feesRes] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('staff_transportation_fees').select('store_id, fee').eq('user_id', user.id),
    ])

    setStores((storesRes.data || []) as Store[])

    const feeMap: Record<string, number> = {}
    feesRes.data?.forEach((f) => {
      feeMap[f.store_id] = f.fee
    })
    setFees(feeMap)
    setLoading(false)
  }, [supabase, user.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    const upserts = stores.map((store) => ({
      user_id: user.id,
      store_id: store.id,
      fee: fees[store.id] ?? 0,
    }))

    const { error } = await supabase
      .from('staff_transportation_fees')
      .upsert(upserts, { onConflict: 'user_id,store_id' })

    if (error) {
      setMessage({ type: 'error', text: '保存に失敗しました' })
    } else {
      setMessage({ type: 'success', text: '保存しました' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  return (
    <>
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

      <div className="bg-card rounded-xl border border-border shadow-sm p-6 max-w-md">
        <div className="space-y-4">
          {stores.map((store) => (
            <div key={store.id} className="flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Train size={16} className="text-primary" />
                </div>
                <span className="font-medium text-foreground text-sm">{store.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="0"
                  value={fees[store.id] ?? 0}
                  onChange={(e) =>
                    setFees((prev) => ({ ...prev, [store.id]: Number(e.target.value) }))
                  }
                  className="w-28 px-3 py-2 rounded-lg border border-border text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0"
                />
                <span className="text-sm text-secondary w-4">円</span>
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-border flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function TransportationSettingsPage() {
  const { profile } = useAuth()
  const isAdmin = profile.role === 'admin'

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">交通費設定</h1>
      <p className="text-secondary text-sm mb-6">
        {isAdmin
          ? '各メンバーの店舗別交通費（1回あたり）を設定できます'
          : '店舗ごとの交通費（1回あたり）を入力してください。給与計算に反映されます。'}
      </p>
      {isAdmin ? <AdminView /> : <StaffView />}
    </div>
  )
}
