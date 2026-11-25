// 쓰기가 인증 만료로 실패했을 때의 안내(NTC-01, MSG-30·37): 각 대화상자가 ActionDock으로 버튼 줄 위 고정 영역에 그리고 저장·확정 버튼을 잠근다
import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MSG_30_AUTH_EXPIRED, MSG_37_RELOGIN_NOTE } from '../domain/messages'
import { AuthExpiredContext, useAuthExpired, type AuthExpiredValue } from './authExpired'
import ui from './ui.module.css'
import styles from './AuthExpiredNotice.module.css'

// authExpired를 대화상자들에게 내려준다. 만료가 알려졌는데 열린 대화상자가 없으면(요청 중에 닫은 경우) 보일 곳이 없으니 바로 해제한다(UA-15)
export function AuthExpiredProvider({ expired, onLogin, onDismiss, children }: AuthExpiredValue & { children: ReactNode }) {
  useEffect(() => {
    if (expired && !document.querySelector('[role="dialog"]')) onDismiss()
  }, [expired, onDismiss])
  return <AuthExpiredContext.Provider value={{ expired, onLogin, onDismiss }}>{children}</AuthExpiredContext.Provider>
}

function Notice() {
  const { onLogin, onDismiss } = useContext(AuthExpiredContext)
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // 안내는 그 대화상자를 닫으면 함께 사라진다(AC-27-11). 대화상자가 빠지면 이 요소도 DOM에서 빠지므로 그때 만료 상태를 해제한다.
  // 개발 모드의 effect 재실행처럼 요소가 그대로면 해제하지 않는다
  useEffect(() => {
    const el = root.current
    return () => {
      setTimeout(() => {
        if (!el?.isConnected) onDismiss()
      }, 0)
    }
  }, [onDismiss])

  function login() {
    if (busy) return
    setBusy(true)
    onLogin().catch((e) => {
      console.error('[auth] 로그인 에러:', e)
      setBusy(false) // 시작하지 못했으면 다시 누를 수 있다
    })
  }

  return (
    <div ref={root} role="alert" className={styles.notice}>
      <div className={styles.head}>
        <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M10 2.5l8 14H2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <rect x="9" y="7.5" width="2" height="4.5" fill="currentColor" />
          <circle cx="10" cy="14.3" r="1.1" fill="currentColor" />
        </svg>
        <div className={styles.text}>
          <p className={styles.message}>{MSG_30_AUTH_EXPIRED}</p>
          <p className={styles.note}>{MSG_37_RELOGIN_NOTE}</p>
        </div>
      </div>
      {/* 눌려도 disabled로 바꾸지 않는다: 포커스가 body로 빠지지 않게 aria-disabled와 aria-busy만 쓴다 */}
      <button type="button" className={`${ui.btn} ${ui.primary} ${styles.login}`} aria-busy={busy || undefined} aria-disabled={busy || undefined} onClick={login}>
        로그인
      </button>
    </div>
  )
}

// 스크롤하는 가장 가까운 조상(대화상자 본문)
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node
  }
  return null
}

// 버튼 줄(children)과 그 바로 위 안내를 한 덩어리로 묶는다. 만료일 때만 본문이 스크롤돼도 밀려나지 않게 아래에 붙고, 안의 비활성 버튼은 흐리게 보인다
export function ActionDock({ children }: { children: ReactNode }) {
  const expired = useAuthExpired()
  const dock = useRef<HTMLDivElement>(null)

  // 좁고 낮은 화면에서는 붙은 영역이 본문 절반을 덮는다. 포커스를 받은 입력이 그 뒤에 가려지지 않게(WCAG 2.4.11) 영역 높이만큼 스크롤 여백을 둔다
  useLayoutEffect(() => {
    const el = dock.current
    const scroller = expired && el ? scrollParent(el) : null
    if (!el || !scroller) return
    const apply = () => (scroller.style.scrollPaddingBottom = `${el.offsetHeight}px`)
    apply()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      scroller.style.scrollPaddingBottom = ''
    }
  }, [expired])

  return (
    <div ref={dock} className={expired ? `${styles.dock} ${styles.docked}` : styles.dock}>
      {expired && <Notice />}
      <div className={styles.row}>{children}</div>
    </div>
  )
}
