// 오버레이 4종(EventEditor/SettingsModal/TodoSheet/SearchDialog)이 공유하는 스크림+다이얼로그 애니메이션 셸.
// 데스크톱은 살짝 커지며 페이드인, 모바일은 들어온 길(아래)로 그대로 나가는 바텀시트로 움직이고
// 손잡이·고정 헤더를 끌어서 닫을 수 있다(손을 놓는 순간의 속도를 그대로 이어받아 닫히거나 되돌아간다).
// 손잡이와 헤더는 고정하고 본문만 스크롤하며, 열려 있는 동안 뒤 페이지 스크롤을 잠근다.
// 접근성: 열리면 포커스를 안으로 옮기고, Tab이 밖으로 빠지지 않게 가두고, 뒤쪽 화면은 inert로 막고, 닫히면 열었던 요소로 돌려보낸다.
import { animate, motion, useDragControls, useIsPresent, useMotionValue, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { exitFast, fadeDefault, project, springDefault, springRelease, springReturn } from '../lib/motion'
import { MOBILE_QUERY, useMediaQuery } from '../state/useMediaQuery'
import styles from './Overlay.module.css'

interface OverlayProps {
  onClose: () => void
  variant?: 'sheet' | 'fullscreen'
  label: string // 대화상자의 접근 가능한 이름(스크린리더가 "설정 대화상자"처럼 읽는다)
  header?: ReactNode // 스크롤되지 않고 위에 고정되는 영역(제목 줄·상단 바)
  children: ReactNode
}

// 시트가 여러 개 겹쳐도 마지막 하나가 닫힐 때만 스크롤 잠금을 푼다
let scrollLocks = 0

// tabindex=-1은 Tab으로 닿지 않는 요소(roving tabindex 격자의 비활성 칸 등)라 트랩의 처음·끝에서 뺀다 — 세면 끝 칸이 "마지막"이 되어
// 실제 마지막 탭 정지에서 Tab을 눌러도 트랩이 끼어들지 못하고 포커스가 대화상자 밖으로 빠진다(26단계)
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]',
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(', ')

// 스크림이 놓인 자리에서 문서 맨 위까지 올라가며 "자기 계열이 아닌" 형제를 전부 inert로 만든다 — 뒤쪽 화면이 Tab·스크린리더로
// 닿지 않게 한다. 이미 inert였던 것은 건드리지 않고, 되돌릴 때는 우리가 건 것만 푼다.
function inertEverythingElse(from: HTMLElement): () => void {
  const marked: Element[] = []
  let node: HTMLElement | null = from
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const sibling of Array.from(parent.children)) {
      // data-keep-active: 오버레이가 열려 있어도 눌리고 읽혀야 하는 영역(토스트)
      if (sibling !== node && !sibling.hasAttribute('inert') && !sibling.hasAttribute('data-keep-active') && sibling.tagName !== 'SCRIPT') {
        sibling.setAttribute('inert', '')
        marked.push(sibling)
      }
    }
    node = parent
  }
  return () => marked.forEach((el) => el.removeAttribute('inert'))
}

function Overlay({ onClose, variant = 'sheet', label, header, children }: OverlayProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const reduceMotion = useReducedMotion()
  const isPresent = useIsPresent()
  const dragControls = useDragControls()
  const y = useMotionValue(0)
  // 열기 전에 포커스가 있던 요소(닫을 때 돌려준다). 렌더 중에 읽어야 한다 — 입력칸의 autoFocus가 커밋 시점에 포커스를 먼저 가져가
  // 버려서, 효과 안에서 읽으면 대화상자 안의 입력칸이 "열기 전 요소"로 잡혔다(실측: Esc 뒤 포커스가 엉뚱한 곳으로)
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))
  const rootRef = useRef<HTMLDivElement>(null) // 스크림(시트) 또는 전체 화면 루트
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollLocks++ === 0) document.body.style.overflow = 'hidden'
    return () => {
      if (--scrollLocks === 0) document.body.style.overflow = ''
    }
  }, [])

  // 데스크톱 모달은 눌린 버튼(트리거)에서 커져 나온다 — 화면 한가운데서 갑자기 생기지 않고 "여기서 열렸다"는 공간 연속성을 준다(M-N12).
  // 키보드 단축키로 열어 트리거가 없으면(포커스가 body) 가운데 그대로. 첫 페인트 전에 정해야 해서 layout effect다.
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || isMobile || reduceMotion || !opener || opener === document.body) return
    const from = opener.getBoundingClientRect()
    const box = dialog.getBoundingClientRect()
    dialog.style.transformOrigin = `${from.left + from.width / 2 - box.left}px ${from.top + from.height / 2 - box.top}px`
  }, [isMobile, reduceMotion, opener])

  // 포커스 관리: 열릴 때 안으로, 닫히기 시작할 때(isPresent=false) 원래 요소로. 퇴장 애니메이션이 끝나기를 기다리면
  // 그동안 포커스가 사라진 뒤쪽(inert) 화면에 걸려 BODY로 떨어진다.
  useEffect(() => {
    const root = rootRef.current
    if (!isPresent || !root) return
    const restoreInert = inertEverythingElse(root)
    const container = dialogRef.current ?? root
    if (!container.contains(document.activeElement)) {
      // 입력칸이 이미 autoFocus로 포커스를 잡았으면 그대로 두고, 아니면 첫 요소(없으면 대화상자 자체)로
      ;(container.querySelector<HTMLElement>(FOCUSABLE) ?? container).focus({ preventScroll: true })
    }
    return () => {
      restoreInert()
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [isPresent, opener])

  // Esc로 닫는다(키보드가 있는 환경: iPad·데스크톱). Tab은 대화상자 안에서만 돈다.
  // App의 단축키 훅은 자기가 아는 시트만 닫아서, 헤더 안 날짜 이동 시트 같은 것은 Esc가 안 먹었다(보스 리뷰에서 발견).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && variant !== 'fullscreen') {
        // 검색은 입력창에서 Esc를 직접 처리한다
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const container = dialogRef.current ?? rootRef.current
      if (!container) return
      // offsetParent로 "보이는지"를 재면 position:fixed 요소가 항상 null이고 jsdom에선 전부 null이라 쓰지 않는다 —
      // 이 대화상자 안에서는 CSS로만 숨긴 포커스 요소가 없다(모바일/데스크톱 변형은 조건부 렌더)
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest('[hidden], [aria-hidden="true"], [inert]'),
      )
      if (items.length === 0) {
        e.preventDefault()
        container.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !container.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, variant])

  if (variant === 'fullscreen') {
    // 루트(스크림) 안에 패널을 둔다: 모바일은 패널이 화면 전체를 덮고, 데스크톱은 위쪽에 뜨는 팝오버가 되고 바깥을 누르면 닫힌다
    return (
      <motion.div
        ref={rootRef}
        className={styles.searchRoot}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, pointerEvents: 'none', transition: exitFast }}
        transition={fadeDefault}
      >
        <motion.div
          ref={dialogRef}
          className={styles.fullscreen}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          initial={{ opacity: 0, y: reduceMotion ? 0 : -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -12, transition: exitFast }}
          transition={springDefault}
        >
          {children}
        </motion.div>
      </motion.div>
    )
  }

  // 동작 줄이기: 이동(y·scale)은 쓰지 않고 페이드만. 예전엔 transform만 꺼서 모바일 시트가 툭 나타났다 사라졌다.
  const dialogMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: exitFast }, transition: { duration: 0.2 } }
    : isMobile
      ? // 들어올 때는 손가락 모멘텀이 없으므로 튕기지 않는다(바운스는 던진 뒤에만). 나갈 때는 진입보다 훨씬 빠르게.
        {
          initial: { y: '100%' },
          animate: { y: 0 },
          // 퇴장도 속도를 존중하는 스프링이어야 한다 — visualDuration 스프링은 velocity를 무시해, 끌어 닫을 때 onDragEnd의 animate를
          // 이 퇴장이 덮어쓰며 놓은 직후 ~30ms 감속 구간이 생겼다(25단계 2차 심사). 속도를 안 주면 현재 모션 값의 속도를 이어받는다.
          exit: { y: '100%', transition: springRelease() },
          transition: springDefault,
        }
      : {
          initial: { opacity: 0, scale: 0.92 }, // 트리거에서 커져 나오므로 조금 더 작게 시작한다
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.96, transition: exitFast },
          transition: springDefault,
        }

  return (
    <motion.div
      ref={rootRef}
      className={styles.scrim}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // 닫히는 중에도 클릭을 받아 "삭제"를 두 번 누르면 확인창이 또 떴다(2차 보스 실측) — 퇴장 중엔 통과시킨다.
      // pointer-events는 상속되므로 안의 다이얼로그도 함께 막힌다. 스크림이 다이얼로그보다 오래 남아
      // "유령 다이얼로그"가 400ms 떠 있던 것(실측)을 없애려고 퇴장 길이를 맞춘다.
      exit={{ opacity: 0, pointerEvents: 'none', transition: exitFast }}
      transition={fadeDefault}
    >
      <motion.div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ y }}
        drag={isMobile ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.15 }}
        dragMomentum={false}
        // dragSnapToOrigin을 쓰면 놓는 순간 반대 방향 복귀 애니메이션이 먼저 시작돼, 던지듯 닫아도 ~50ms 멈칫한 뒤 0에서
        // 다시 가속했다(25단계 실측: 1000px/s → 190px/s). 대신 놓는 속도를 직접 이어받아 닫거나 되돌린다.
        onDragEnd={(_event, info) => {
          const height = dialogRef.current?.getBoundingClientRect().height ?? 0
          const projected = info.offset.y + project(info.velocity.y)
          if (height > 0 && projected > height / 2) {
            animate(y, height, springRelease(info.velocity.y))
            onClose()
          } else {
            animate(y, 0, springReturn(info.velocity.y))
          }
        }}
        {...dialogMotion}
      >
        {(isMobile || header) && (
          <div className={styles.top} onPointerDown={isMobile ? (e) => dragControls.start(e) : undefined}>
            {isMobile && (
              <div className={styles.grabber} aria-hidden="true">
                <span />
              </div>
            )}
            {header && <div className={styles.header}>{header}</div>}
          </div>
        )}
        <div className={header ? styles.bodyWithHeader : styles.body}>{children}</div>
      </motion.div>
    </motion.div>
  )
}

export default Overlay
