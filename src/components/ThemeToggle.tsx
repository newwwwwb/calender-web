// 사이드바 "디자인" 섹션: 기본/ZIGZAG 참고 테마를 고르는 셀렉트
import { useTheme, type Theme } from '../state/useTheme'
import styles from './ThemeToggle.module.css'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <select
      className={styles.select}
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      aria-label="디자인 테마"
    >
      <option value="default">기본</option>
      <option value="zigzag">ZIGZAG 참고</option>
    </select>
  )
}

export default ThemeToggle
