// 로그인하지 않았을 때 /car에 보이는 안내 화면(SCR-01): MSG-02 문구와 로그인 버튼, 로그인 실패·취소 때의 MSG-29
import styles from '../CarbookApp.module.css'
import { MSG_02_LOGIN_REQUIRED, MSG_29_LOGIN_FAILED } from '../domain/messages'
import local from './LoginGate.module.css'

export default function LoginGate({ failed, onLogin }: { failed: boolean; onLogin: () => void }) {
  return (
    <div className={styles.gate}>
      <p className={styles.gateText}>{MSG_02_LOGIN_REQUIRED}</p>
      {/* 나타날 때 알림으로 읽힌다(AC-27-9). 다시 시도하면 지워졌다가 실패하면 새로 생겨 다시 읽힌다 */}
      {failed && (
        <p role="alert" className={local.error}>
          <svg className={local.icon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="9" y="5" width="2" height="6" fill="currentColor" />
            <circle cx="10" cy="14.2" r="1.2" fill="currentColor" />
          </svg>
          <span>{MSG_29_LOGIN_FAILED}</span>
        </p>
      )}
      <button type="button" className={styles.primary} onClick={onLogin}>
        로그인
      </button>
    </div>
  )
}
