// 초대 링크 수락 화면: /share/:id 로 접속했을 때 App.tsx가 대신 렌더링한다
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../state/useAuth'
import { SupabaseShareRepository } from '../storage/supabaseShareRepository'
import type { ShareLink } from '../types'
import styles from './AcceptSharePage.module.css'

interface AcceptSharePageProps {
  shareId: string
}

// 하얀 화면 가운데 문장 한 줄과 버튼뿐이라 무슨 앱의 어떤 요청인지 알 수 없었다(25단계 비주얼 감사) — 앱 아이콘과 카드로 맥락을 준다
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <svg className={styles.mark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
        </svg>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
    </main>
  )
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
      setError('공유를 수락하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
    } finally {
      setAccepting(false)
    }
  }

  if (authLoading) return null

  if (!user) {
    return (
      <Card title="캘린더 공유 초대">
        <p className={styles.text}>캘린더 공유를 수락하려면 먼저 로그인해 주세요.</p>
        <button type="button" className={styles.button} onClick={() => signInWithGoogle(window.location.href)}>
          Google로 로그인
        </button>
      </Card>
    )
  }

  if (accepted) {
    return (
      <Card title="공유를 수락했어요.">
        <a className={styles.button} href="/">
          캘린더로 이동
        </a>
      </Card>
    )
  }

  // 조회 중: 빈 화면 대신 자리 표시를 보여 준다(링크가 느리게 열려도 멈춘 게 아니라는 걸 알 수 있게)
  if (link === undefined) {
    return (
      <Card title="캘린더 공유 초대">
        <div className={styles.skeleton} aria-hidden="true" />
      </Card>
    )
  }

  if (link === null) {
    return (
      <Card title="유효하지 않은 공유 링크예요.">
        <a className={styles.button} href="/">
          캘린더로 이동
        </a>
      </Card>
    )
  }

  return (
    <Card title="캘린더 공유 초대">
      <p className={styles.text}>{link.ownerEmail}님이 캘린더를 공유했어요.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="button" className={styles.button} onClick={accept} disabled={accepting}>
        {accepting ? '수락 중…' : '수락'}
      </button>
    </Card>
  )
}

export default AcceptSharePage
