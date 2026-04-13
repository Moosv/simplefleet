import { useEffect, useState, createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AdminProfile } from '@/types'

interface AuthContextValue {
  user: User | null
  profile: AdminProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null; profile: AdminProfile | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        fetchProfile(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<{ error: string | null; profile: AdminProfile | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message, profile: null }

    const { data: prof } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!prof) {
      await supabase.auth.signOut()
      return { error: '프로필을 찾을 수 없습니다. 관리자에게 문의하세요.', profile: null }
    }

    if (prof.status === 'pending') {
      await supabase.auth.signOut()
      return { error: '계정 승인 대기 중입니다. 시스템 운영자에게 문의하세요.', profile: null }
    }

    if (prof.status === 'inactive') {
      await supabase.auth.signOut()
      return { error: '비활성화된 계정입니다. 시스템 운영자에게 문의하세요.', profile: null }
    }

    setProfile(prof)
    return { error: null, profile: prof }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return { user, profile, loading, signIn, signOut }
}
