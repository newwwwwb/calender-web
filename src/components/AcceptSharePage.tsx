// 초대 링크 수락 화면: /share/:id 로 접속했을 때 App.tsx가 대신 렌더링한다
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../state/useAuth'
import { SupabaseShareRepository } from '../storage/supabaseShareRepository'
import type { ShareLink } from '../types'
import styles from './AcceptSharePage.module.css'

interface AcceptSharePageProps {
  shareId: string
}

function AcceptSharePage({ shareId }: AcceptSharePageProps) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth()
  const [link, setLink] = useState<ShareLink | null | undefined>(undefined) // undefined: 조회 중, null: 없음
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !supabase) return
    new SupabaseShareRepository(supabase, user.id, user.email ?? '').getShareLink(shareId).then(setLink)
  }, [user, shareId])

  async function accept() {
    if (!user || !supabase) return
    setAccepting(true)
    setError(null)
    try {
      await new SupabaseShareRepository(supabase, user.id, user.email ?? '').acceptShareLink(shareId)
      setAccepted(true)
    } catch {
      setError('공유 수락에 실패했어요. 다시 시도해주세요.')
    } finally {
      setAccepting(false)
    }
  }

  if (authLoading) return null

  if (!user) {
    return (
      <div className={styles.page}>
        <p>캘린더 공유를 수락하려면 먼저 로그인해주세요.</p>
        <button type="button" className={styles.button} onClick={() => signInWithGoogle(window.location.href)}>
          Google로 로그인
        </button>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className={styles.page}>
        <p>공유를 수락했어요.</p>
        <a className={styles.button} href="/">
          캘린더로 이동
        </a>
      </div>
    )
  }

  if (link === undefined) return null

  if (link === null) {
    return (
      <div className={styles.page}>
        <p>유효하지 않은 공유 링크예요.</p>
        <a className={styles.button} href="/">
          캘린더로 이동
        </a>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <p>{link.ownerEmail}님이 캘린더를 공유했어요.</p>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.button} onClick={accept} disabled={accepting}>
        {accepting ? '수락 중…' : '수락하기'}
      </button>
    </div>
  )
}

export default AcceptSharePage
