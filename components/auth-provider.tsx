'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import type { SupabaseClient, User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User
  profile: Profile
  supabase: SupabaseClient
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const userName =
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        '未設定'

      const { data: profiles, error } = await supabase.rpc('get_or_create_profile', {
        p_user_id: user.id,
        p_user_name: userName,
      })

      if (error || !profiles?.[0]) {
        console.error('プロフィール取得エラー:', error?.message)
        await supabase.auth.signOut()
        window.location.href = '/login?error=profile_creation_failed'
        return
      }

      setState({
        user,
        profile: profiles[0] as Profile,
        supabase,
      })
      setLoading(false)
    }

    init()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-secondary">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  )
}
