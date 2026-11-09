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
import ui from './ui.module.css'

interface DueDatesTabProps {
  dueDates: DueDateView[] // 선택한 차량의 만기일(종류당 최대 1개, BR-16)
  state: 'loading' | 'ready' | 'error'
  onRetry: () => void
  onSave: (kind: DueKind, dueDate: DateKey) => Promise<boolean>
  onDelete: (kind: DueKind) => Promise<boolean>
  onRetryCalendar: (id: string) => Promise<void>
}

// form.current: 열 때의 날짜를 고정해 저장 뒤 퇴장 중에 제목이 바뀌지 않게 한다
type Dialog = { type: 'form'; kind: DueKind; current?: DateKey } | { type: 'delete'; kind: DueKind } | null

export default function DueDatesTab({ dueDates, state, onRetry, onSave, onDelete, onRetryCalendar }: DueDatesTabProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const retryFocusId = useRef<string | null>(null)
  const lastKind = useRef<DueKind>('insurance') // 마지막으로 연 대화상자의 종류: 닫힌 뒤 그 행으로 포커스를 돌려준다

  useEffect(() => {
    if (dialog) lastKind.current = dialog.kind
  }, [dialog])

  // 대화상자의 퇴장 애니메이션이 끝난 뒤에 복구한다(퇴장이 길어도 맞는다, NFR-18). 취소처럼 Overlay가 이미 누른 버튼으로 돌려줬으면 포커스가 body가 아니라 건드리지 않는다(2.4.3)
  function restoreFocus() {
    // onExitComplete는 퇴장하는 노드가 DOM에서 빠지기 직전에 불린다 — 빠진 다음 프레임에 확인해야 포커스가 body로 떨어진 것을 볼 수 있다
    requestAnimationFrame(() => {
      if (areaRef.current && document.activeElement === document.body) areaRef.current.querySelector<HTMLElement>(`[data-kind="${lastKind.current}"] button`)?.focus()
    })
  }

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
            <li key={kind} className={styles.row} data-row={due?.id} data-kind={kind}>
              <span className={styles.kind}>{label}</span>
              {due ? <span className={styles.date}>{due.dueDate}</span> : <span className={styles.none}>날짜 없음</span>}
              <div className={styles.actions}>
                {due ? (
                  <>
                    <button type="button" className={`${ui.btn} ${ui.secondary}`} aria-label={`${label} 수정`} onClick={() => setDialog({ type: 'form', kind, current: due.dueDate })}>
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

      <AnimatePresence onExitComplete={restoreFocus}>
        {dialog?.type === 'form' && <DueDateForm key={`form-${dialog.kind}`} kind={dialog.kind} current={dialog.current} onSave={onSave} onClose={() => setDialog(null)} />}
        {dialog?.type === 'delete' && current && (
          <ConfirmDialog
            key={`delete-${dialog.kind}`}
            target={`만기일(${DUE_LABEL[dialog.kind]})`}
            onConfirm={() => onDelete(dialog.kind)}
            onClose={() => setDialog(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
