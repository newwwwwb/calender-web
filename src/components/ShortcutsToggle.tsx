// 설정 "키보드 단축키" 섹션: 한 글자 단축키를 끌 수 있고(WCAG 2.1.4), 어떤 키가 있는지 알려준다
import { useState } from 'react'
import { areShortcutsEnabled, setShortcutsEnabled } from '../state/useKeyboardShortcuts'
import styles from './ShortcutsToggle.module.css'

function ShortcutsToggle() {
  const [enabled, setEnabled] = useState(areShortcutsEnabled)

  return (
    <div className={styles.group}>
      <label className={styles.row}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setShortcutsEnabled(e.target.checked)
            setEnabled(e.target.checked)
          }}
        />
        한 글자 단축키 사용
      </label>
      {/* 단축키는 눈에 보이는 곳이 한 군데도 없어 발견할 방법이 없었다(25단계 UX 감사) */}
      <p className={styles.hint}>T 오늘 · M 월 · W 주 · D 일 · A 목록 · N 새 일정 · / 검색 · ← → 이전·다음</p>
      {/* 끌어서 옮기기의 키보드 대안(30단계) — Alt 조합이라 위 한 글자 단축키 설정과 무관하게 동작한다 */}
      <p className={styles.hint}>일정에 포커스 + Alt+방향키로 이동(주·일은 ↑↓ 15분·←→ 하루, 월은 ←→ 하루·↑↓ 일주일) · Alt+Shift+↑↓ 길이 조절(주·일), Alt+Shift+←→ 끝 날 조절(월의 종일 일정)</p>
    </div>
  )
}

export default ShortcutsToggle
