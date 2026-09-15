// 로그인 상태 버튼: 로그아웃 상태면 "로그인", 로그인 상태면 "로그아웃"
import { useAuth } from '../state/useAuth'
import styles from './Header.module.css'

function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()

  if (loading) return null

  if (!user) {
    return (
      <button type="button" className={styles.todayButton} onClick={signInWithGoogle}>
        로그인
      </button>
    )
  }

  return (
    <button type="button" className={styles.todayButton} onClick={signOut} title={user.email ?? ''}>
      로그아웃
    </button>
  )
}

export default AuthButton
