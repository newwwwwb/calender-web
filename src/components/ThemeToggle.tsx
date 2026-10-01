// 설정 "화면" 섹션: 디자인 테마(기본/ZIGZAG)와 모양(시스템/라이트/다크)을 고르는 셀렉트 두 개
import { useTheme, type SchemePref, type Theme } from '../state/useTheme'
import styles from './ThemeToggle.module.css'

function ThemeToggle() {
  const { theme, scheme, setTheme, setScheme } = useTheme()

  return (
    <div className={styles.group}>
      <select
        className={styles.select}
        value={scheme}
        onChange={(e) => setScheme(e.target.value as SchemePref)}
        aria-label="화면 모양"
      >
        <option value="system">시스템 설정 따르기</option>
        <option value="light">라이트</option>
        <option value="dark">다크</option>
      </select>
      <select
        className={styles.select}
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
        aria-label="디자인 테마"
      >
        <option value="default">기본</option>
        <option value="zigzag">ZIGZAG</option>
      </select>
    </div>
  )
}

export default ThemeToggle
