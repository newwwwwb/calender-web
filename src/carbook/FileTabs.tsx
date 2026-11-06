// 화면 오른쪽 가장자리에 붙는 파일철 탭("캘린더"·"차계부"): 링크이며 위젯 모드에서는 그리지 않는다
import type { MouseEvent } from 'react'
import { isWidgetMode } from '../state/widgetMode'
import styles from './FileTabs.module.css'
import { isCarPath, navigate, usePathname } from './navigation'

const TABS = [
  { href: '/', label: '캘린더' },
  { href: '/car', label: '차계부' },
]

// 보조키·가운데 클릭은 브라우저(새 탭 열기)에 맡긴다(AC-01-4)
function handleClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigate(href)
}

export default function FileTabs() {
  const onCar = isCarPath(usePathname())
  if (isWidgetMode()) return null // BR-30: 위젯 판정은 기존 방식

  return (
    <nav aria-label="화면 전환" className={styles.nav}>
      {TABS.map(({ href, label }) => {
        const current = (href === '/car') === onCar
        return (
          <a
            key={href}
            href={href}
            className={`${styles.tab} ${current ? styles.current : ''}`}
            aria-current={current ? 'page' : undefined}
            onClick={(event) => handleClick(event, href)}
          >
            <span className={styles.label}>{label}</span>
          </a>
        )
      })}
    </nav>
  )
}
