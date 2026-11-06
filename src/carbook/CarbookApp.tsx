// /car 화면의 루트: 세션 확인·로그인 게이트, 불러오기 중·실패 상태
import { useEffect, useState } from 'react'
import { useAuth } from '../state/useAuth'
import styles from './CarbookApp.module.css'
import LoginGate from './components/LoginGate'
import { MSG_04_LOAD_FAILED } from './domain/messages'
import { useCarbook } from './state/useCarbook'

const SESSION_WAIT_MS = 5000 // NFR-05: 세션 복원이 이보다 오래 걸리면 로그인 안내로 바꾼다
// 로그인한 뒤에만 렌더링한다: 비로그인이면 useCarbook 호출 자체가 없어 요청이 0건이다(AC-02-1)
function CarbookData({ userId }: { userId: string }) {
  const { loadState, retryLoad } = useCarbook(userId)

  if (loadState === 'loading') {
    return (
      <div className={styles.loading}>
        <span className={styles.spinner} aria-hidden="true" />
        <span className="sr-only">불러오는 중</span>
      </div>
    )
  }
  if (loadState === 'error') {
    return (
      <div className={styles.gate} role="alert">
        <p className={styles.gateText}>{MSG_04_LOAD_FAILED}</p>
        <button type="button" className={styles.primary} onClick={retryLoad}>
          다시 시도
        </button>
      </div>
    )
  }
  // 차량 영역·하위 탭(MPR-31 2/2)과 차량 0대 빈 상태(MPR-32)가 여기에 들어온다
  return null
}

export default function CarbookApp() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [waitedTooLong, setWaitedTooLong] = useState(false)

  useEffect(() => {
    if (!loading) return
    const id = setTimeout(() => setWaitedTooLong(true), SESSION_WAIT_MS)
    return () => clearTimeout(id)
  }, [loading])

  const checking = !user && loading && !waitedTooLong // 세션 확인 중(SCR-01a): 요청 없이 로딩 표시만

  return (
    <main id="main-content" tabIndex={-1} className={styles.main} aria-busy={checking}>
      <h1 className="sr-only">차계부</h1>
      {user ? (
        <CarbookData userId={user.id} />
      ) : checking ? (
        <div className={styles.loading}>
          <span className={styles.spinner} aria-hidden="true" />
          <span className="sr-only">세션을 확인하는 중</span>
        </div>
      ) : (
        // 로그인이 끝나면 같은 주소(/car)로 돌아온다(BR-04, AC-02-2). 취소·실패는 이 화면에 그대로 머문다(AC-02-3)
        <LoginGate onLogin={() => signInWithGoogle(window.location.href).catch((e) => console.error('[auth] 로그인 에러:', e))} />
      )}
    </main>
  )
}
