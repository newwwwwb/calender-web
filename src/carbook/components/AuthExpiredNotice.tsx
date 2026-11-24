// 쓰기가 인증 만료로 실패했을 때 보이는 안내(NTC-01, MSG-30): 열린 대화상자 맨 아래 고정 영역에 붙고, 없으면 화면 안에 그린다
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MSG_30_AUTH_EXPIRED, MSG_37_RELOGIN_NOTE } from '../domain/messages'
import ui from './ui.module.css'
import styles from './AuthExpiredNotice.module.css'

type Props = {
  onLogin: () => Promise<void> // 돌아올 주소가 /car인 Google 로그인을 시작한다. 성공하면 페이지가 바뀐다
  onDismiss: () => void
}

// 가장 위에 열린 대화상자: 겹친 대화상자는 DOM 순서상 나중 것이 위다(확인창은 양식 안에 렌더된다)
function topDialog(): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>('[role="dialog"]')
  return all.length > 0 ? all[all.length - 1] : null
}

function Box({ onLogin, onClose }: { onLogin: Props['onLogin']; onClose?: () => void }) {
  const [busy, setBusy] = useState(false)

  function login() {
    if (busy) return
    setBusy(true)
    onLogin().catch((e) => {
      console.error('[auth] 로그인 에러:', e)
      setBusy(false) // 시작하지 못했으면 다시 누를 수 있다
    })
  }

  return (
    <div role="alert" className={styles.notice}>
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
      <div className={styles.actions}>
        {/* 눌려도 disabled로 바꾸지 않는다: 포커스가 body로 빠지지 않게 aria-disabled와 aria-busy만 쓴다 */}
        <button type="button" className={`${ui.btn} ${ui.primary}`} aria-busy={busy || undefined} aria-disabled={busy || undefined} onClick={login}>
          로그인
        </button>
        {onClose && (
          <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={onClose}>
            닫기
          </button>
        )}
      </div>
    </div>
  )
}

export default function AuthExpiredNotice({ onLogin, onDismiss }: Props) {
  // 만료가 알려진 순간 열려 있던 대화상자가 쓰기를 시도한 곳이다. 그 안(본문 스크롤 밖)에 붙여야 뒤쪽 inert와 스크림에 가려지지 않고 Tab으로 닿는다
  const [host] = useState(topDialog)

  // 안내는 그 대화상자를 닫으면 함께 사라진다(AC-27-11). 대화상자가 DOM에서 빠지면 만료 상태를 해제한다
  useEffect(() => {
    if (!host) return
    const observer = new MutationObserver(() => {
      if (!host.isConnected) onDismiss()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [host, onDismiss])

  return host ? createPortal(<Box onLogin={onLogin} />, host) : <Box onLogin={onLogin} onClose={onDismiss} />
}
