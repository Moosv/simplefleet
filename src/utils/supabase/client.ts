import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

interface MockSupabaseClient {
  auth: {
    getUser: () => Promise<{ data: { user: null }, error: null }>
    signOut: () => Promise<{ error: null }>
    signInWithPassword: () => Promise<{ error: Error }>
    signUp: () => Promise<{ error: Error }>
    exchangeCodeForSession: () => Promise<{ error: Error }>
    onAuthStateChange: () => { data: { subscription: { unsubscribe: () => void } } }
  }
  from: () => {
    select: () => {
      eq: () => {
        single: () => Promise<{ data: null, error: Error }>
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Development mode fallback - skip Supabase if not configured
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({ error: new Error('Supabase not configured') }),
        signUp: async () => ({ error: new Error('Supabase not configured') }),
        exchangeCodeForSession: async () => ({ error: new Error('Supabase not configured') }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: new Error('Supabase not configured') })
          })
        })
      })
    } as MockSupabaseClient
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseKey
  )
}