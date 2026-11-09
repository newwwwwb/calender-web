// 만기일 탭(SCR-02c, F-07·F-08): 보험·자동차세·정기검사 세 행 고정. 값 없음 → "입력", 값 있음 → "수정"·"삭제", 일정 쓰기 실패면 MSG-11 버튼. 임박·지남 배지는 없다
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { MSG_04_LOAD_FAILED } from '../domain/messages'
import { DUE_KINDS, type DateKey, type DueDateView, type DueKind } from '../domain/types'
import CalendarRetryButton from './CalendarRetryButton'
import ConfirmDialog from './ConfirmDialog'
import DueDateForm from './DueDateForm'
import styles from './DueDatesTab.module.css'
import { DUE_LABEL } from './dueLabels'
import { OVERLAY_EXIT_MS } from './overlayTiming'
import ui from './ui.module.css'

interface DueDatesTabProps {
  dueDates: DueDateView[] // 선택한 차량의 만기일(종류당 최대 1개, BR-16)
  state: 'loading' | 'ready' | 'error'
  onRetry: () => void
  onSave: (kind: DueKind, dueDate: DateKey) => Promise<boolean>
  onDelete: (kind: DueKind) => Promise<boolean>
  onRetryCalendar: (id: string) => Promise<void>
}

type Dialog = { type: 'form'; kind: DueKind } | { type: 'delete'; kind: DueKind } | null

export default function DueDatesTab({ dueDates, state, onRetry, onSave, onDelete, onRetryCalendar }: DueDatesTabProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const dialogWasOpen = useRef(false)
  const retryFocusId = useRef<string | null>(null)

  // 대화상자를 닫은 직후에만, 포커스가 body면 첫 버튼으로 보낸다(삭제·입력으로 누른 버튼이 사라지거나 바뀔 때, 2.4.3)
  useEffect(() => {
    if (dialog) {
      dialogWasOpen.current = true
      return
    }
    if (!dialogWasOpen.current) return
    const id = setTimeout(() => {
      dialogWasOpen.current = false
      if (areaRef.current && document.activeElement === document.body) areaRef.current.querySelector<HTMLElement>('button')?.focus()
    }, OVERLAY_EXIT_MS)
    return () => clearTimeout(id)
  }, [dialog, dueDates])

  // 재시도에 성공하면 누른 버튼이 사라져 포커스가 body로 떨어진다 — 항목이 갱신된 뒤 같은 행의 첫 버튼으로 돌려준다
  useEffect(() => {
    const id = retryFocusId.current
    if (!id || dueDates.find((d) => d.id === id)?.calendarFailed) return
    retryFocusId.current = null
    if (document.activeElement === document.body) areaRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"] button`)?.focus()
  }, [dueDates])

  if (state === 'loading') {
    return (
      <div role="status" className={styles.loading}>
        <span className="sr-only">불러오는 중</span>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div role="alert" className={styles.error}>
        <p>{MSG_04_LOAD_FAILED}</p>
        <button
          type="button"
          className={`${ui.btn} ${ui.secondary}`}
          onClick={() => {
            onRetry()
            document.getElementById('main-content')?.focus() // 버튼이 사라지면 포커스가 body로 떨어지므로 main으로(2.4.3)
          }}
        >
          다시 시도
        </button>
      </div>
    )
  }

  const byKind = new Map(dueDates.map((d) => [d.kind, d]))
  const current = dialog ? byKind.get(dialog.kind) : undefined

  return (
    <div ref={areaRef} className={styles.tab}>
      <ul className={styles.rows}>
        {DUE_KINDS.map((kind) => {
          const due = byKind.get(kind)
          const label = DUE_LABEL[kind]
          return (
            <li key={kind} className={styles.row} data-row={due?.id}>
              <span className={styles.kind}>{label}</span>
              {due ? <span className={styles.date}>{due.dueDate}</span> : <span className={styles.none}>날짜 없음</span>}
              <div className={styles.actions}>
                {due ? (
                  <>
                    <button type="button" className={`${ui.btn} ${ui.secondary}`} aria-label={`${label} 수정`} onClick={() => setDialog({ type: 'form', kind })}>
                      수정
                    </button>
                    <button type="button" className={`${ui.btn} ${ui.dangerOutline}`} aria-label={`${label} 삭제`} onClick={() => setDialog({ type: 'delete', kind })}>
                      삭제
                    </button>
                  </>
                ) : (
                  // 값이 있는데 "입력"은 없다(AC-07-6)
                  <button type="button" className={`${ui.btn} ${ui.secondary}`} aria-label={`${label} 입력`} onClick={() => setDialog({ type: 'form', kind })}>
                    입력
                  </button>
                )}
                {due?.calendarFailed && (
                  <CalendarRetryButton
                    target={label}
                    onRetry={() => {
                      retryFocusId.current = due.id
                      return onRetryCalendar(due.id)
                    }}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <AnimatePresence>
        {dialog?.type === 'form' && <DueDateForm key={`form-${dialog.kind}`} kind={dialog.kind} current={current?.dueDate} onSave={onSave} onClose={() => setDialog(null)} />}
        {dialog?.type === 'delete' && current && (
          <ConfirmDialog
            key={`delete-${dialog.kind}`}
            target={DUE_LABEL[dialog.kind]}
            onConfirm={() => onDelete(dialog.kind)}
            onClose={() => setDialog(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
