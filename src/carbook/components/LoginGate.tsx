// 로그인하지 않았을 때 /car에 보이는 안내 화면(SCR-01): MSG-02 문구와 로그인 버튼
import styles from '../CarbookApp.module.css'
import { MSG_02_LOGIN_REQUIRED } from '../domain/messages'

export default function LoginGate({ onLogin }: { onLogin: () => void }) {
  return (
    <div className={styles.gate}>
      <p className={styles.gateText}>{MSG_02_LOGIN_REQUIRED}</p>
      <button type="button" className={styles.primary} onClick={onLogin}>
        로그인
      </button>
    </div>
  )
}
