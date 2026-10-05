// 로그인 상태 버튼: 로그아웃 상태면 "로그인", 로그인 상태면 "로그아웃"
import { useAuth } from '../state/useAuth'
import styles from './Header.module.css'

function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()

  if (loading) return null

  if (!user) {
    return (
      <button type="button" className={styles.todayButton} onClick={() => signInWithGoogle()}>
        로그인
      </button>
    )
  }

  return (
    <button
      type="button"
      className={styles.todayButton}
      onClick={() => {
        // 로그아웃하면 화면이 이 기기의 로컬 일정으로 바뀌어 일정이 사라진 것처럼 보인다 — 미리 알려 준다
        if (window.confirm('로그아웃할까요? 계정에 저장된 일정은 다시 로그인하면 볼 수 있어요.')) signOut()
      }}
      title={user.email ?? ''}
    >
      로그아웃
    </button>
  )
}

export default AuthButton
