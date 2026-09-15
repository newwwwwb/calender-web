// Supabase 인증 상태(Google 로그인) 훅. supabase 클라이언트가 없으면(환경변수 미설정)
// 항상 로그아웃 상태로 동작한다 — 그럴 때 앱은 localStorage만 쓴다.
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface AuthState {
  user: User | null
  loading: boolean
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 공유 초대 수락 화면(/share/:id)처럼 로그인 후 원래 페이지로 돌아와야 할 때 redirectTo를 넘긴다
  async function signInWithGoogle(redirectTo?: string) {
    await supabase?.auth.signInWithOAuth({ provider: 'google', options: redirectTo ? { redirectTo } : undefined })
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  return { user, loading, signInWithGoogle, signOut }
}
