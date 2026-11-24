// 계정 영역과 계정 메뉴(COMP-02, F-17·F-18): 사진·이름·이메일 버튼, 설정·로그아웃 메뉴, 로그아웃 확인창(DLG-08)
import { AnimatePresence } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useToast } from '../../state/useToast'
import { signOutAll } from '../data/auth'
import { accountDisplay, type AccountSource } from '../domain/account'
import { MSG_22_LOGOUT_CONFIRM, MSG_23_LOGOUT_FAILED } from '../domain/messages'
import styles from './AccountMenu.module.css'
import ConfirmDialog from './ConfirmDialog'

interface AccountMenuProps {
  user: AccountSource
  onOpenSettings: () => void // "설정" 항목: 설정 창은 별도 티켓(MPR-68)이 연결한다
}

// 사진 자리는 항상 같은 크기. 사진이 늦거나 실패해도 이니셜만 보이고 깨진 이미지는 지운다(BR-36)
function Avatar({ photoUrl, initial }: { photoUrl: string | null; initial: string }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  return (
    <span className={styles.avatar} aria-hidden="true">
      <span className={styles.initial}>{initial}</span>
      {photoUrl && !failed && (
        <img
          src={photoUrl}
          alt=""
          referrerPolicy="no-referrer"
          className={`${styles.photo} ${loaded ? styles.photoLoaded : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

export default function AccountMenu({ user, onOpenSettings }: AccountMenuProps) {
  const { name, email, photoUrl, initial, label } = accountDisplay(user)
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const items = () => [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

  // 열리면 첫 항목("설정")으로 포커스가 간다
  useEffect(() => {
    if (open) items()[0]?.focus()
  }, [open])

  // 메뉴 밖 클릭으로 닫고 포커스는 계정 버튼으로 돌아온다
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    } else if (event.key === 'Tab') {
      setOpen(false) // 포커스를 버튼에 두고 기본 Tab 이동을 이어 가게 한다
      buttonRef.current?.focus()
    } else {
      const next = { ArrowDown: Math.min(index + 1, list.length - 1), ArrowUp: Math.max(index - 1, 0), Home: 0, End: list.length - 1 }[event.key]
      if (next === undefined) return
      event.preventDefault()
      list[next]?.focus()
    }
  }

  // 메뉴 항목을 고르면 메뉴를 닫고 포커스를 계정 버튼에 둔 채 다음 창을 연다(그 창이 닫힐 때 돌아갈 자리, AC-18-5)
  function choose(action: () => void) {
    setOpen(false)
    buttonRef.current?.focus()
    action()
  }

  function focusMain() {
    const main = document.getElementById('main-content')
    main?.focus()
    requestAnimationFrame(() => {
      if (document.activeElement !== main) main?.focus() // 닫히는 창이 포커스를 다시 가져가도 main이 마지막이다
    })
  }

  // 성공하면 useAuth가 로그인 안내로 바꾸고 이 영역이 사라지므로 포커스를 main으로 옮긴다. 실패하면 창을 닫고 토스트(AC-18-6)
  async function signOut(): Promise<boolean> {
    try {
      await signOutAll()
    } catch (error) {
      console.error('[carbook] 로그아웃 오류:', error)
      showToast({ message: MSG_23_LOGOUT_FAILED, tone: 'error' })
      setConfirming(false)
      return false
    }
    focusMain()
    return true
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.button} ${open ? styles.open : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKeyDown}
      >
        <Avatar photoUrl={photoUrl} initial={initial} />
        <span className={styles.texts}>
          {name && <span className={styles.name}>{name}</span>}
          {email && <span className={name ? styles.email : styles.emailOnly}>{email}</span>}
        </span>
        <svg className={styles.chevron} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div id={menuId} role="menu" aria-label="계정 메뉴" className={styles.menu} onKeyDown={onMenuKeyDown}>
          <button type="button" role="menuitem" tabIndex={-1} className={styles.item} onClick={() => choose(onOpenSettings)}>
            설정
          </button>
          <button type="button" role="menuitem" tabIndex={-1} className={styles.item} onClick={() => choose(() => setConfirming(true))}>
            로그아웃
          </button>
        </div>
      )}

      <AnimatePresence>
        {confirming && (
          <ConfirmDialog
            key="logout"
            label="로그아웃 확인"
            title="로그아웃"
            message={MSG_22_LOGOUT_CONFIRM}
            confirmLabel="로그아웃"
            tone="primary"
            onConfirm={signOut}
            onClose={() => setConfirming(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
