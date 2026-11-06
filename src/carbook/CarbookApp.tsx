// /car 화면의 루트: 세션 확인·로그인 게이트, 불러오기 실패, 하위 탭 4개(기록·교체 알림·만기일·통계)의 뼈대
import { useEffect, useState, type KeyboardEvent } from 'react'
import { useAuth } from '../state/useAuth'
import styles from './CarbookApp.module.css'
import LoginGate from './components/LoginGate'
import { MSG_04_LOAD_FAILED } from './domain/messages'
import { useCarbook } from './state/useCarbook'

const SESSION_WAIT_MS = 5000 // NFR-05: 세션 복원이 이보다 오래 걸리면 로그인 안내로 바꾼다
const SUB_TABS = ['기록', '교체 알림', '만기일', '통계']

// 탭 목록 패턴: 활성 탭만 Tab 정지점, ←/→/Home/End로 이동하고 즉시 그 패널을 연다(screens.md SCR-02)
function SubTabs({ active, onChange }: { active: number; onChange: (index: number) => void }) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return // Alt+← 뒤로 가기, Ctrl+Home 등 브라우저 단축키는 막지 않는다
    const last = SUB_TABS.length - 1
    const next = { ArrowRight: active === last ? 0 : active + 1, ArrowLeft: active === 0 ? last : active - 1, Home: 0, End: last }[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(next)
    document.getElementById(`car-tab-${next}`)?.focus()
  }

  return (
    <>
      <div role="tablist" aria-label="차계부 보기" className={styles.tabList} onKeyDown={onKeyDown}>
        {SUB_TABS.map((name, i) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`car-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`car-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(i)}
          >
            {name}
          </button>
        ))}
      </div>
      {SUB_TABS.map((name, i) => (
        <div key={name} role="tabpanel" id={`car-panel-${i}`} aria-labelledby={`car-tab-${i}`} hidden={i !== active}>
          <h2 className="sr-only">{name}</h2>
        </div>
      ))}
    </>
  )
}

// 로그인한 뒤에만 렌더링한다: 비로그인이면 useCarbook 호출 자체가 없어 요청이 0건이다(AC-02-1)
function CarbookData({ userId }: { userId: string }) {
  const { loadState, retryLoad, vehicles } = useCarbook(userId)
  const [tab, setTab] = useState(0) // 차량을 바꿔도 유지되고 새로고침하면 "기록"이다(AC-03-9)

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
  // 차량 0대 빈 상태(SCR-03)와 차량 영역은 MPR-32가 채운다
  return vehicles.length > 0 ? <SubTabs active={tab} onChange={setTab} /> : null
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
        <CarbookData key={user.id} userId={user.id} /> /* 계정을 바꿔 로그인하면 이전 계정의 탭·데이터 상태를 넘기지 않는다 */
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
