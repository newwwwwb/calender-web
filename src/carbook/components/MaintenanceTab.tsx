// 교체 알림 탭(SCR-02b, F-06·F-12): 안내 문구, 항목 추가, 항목 목록(상태 배지·교체 완료·캘린더 재시도), 빈·로딩·오류 상태. 양식은 MaintenanceForm, 교체 완료는 CompleteDialog가 연다
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { MSG_04_LOAD_FAILED, MSG_18_NO_ODOMETER_DATA } from '../domain/messages'
import type { DateKey, ItemInput, ItemView } from '../domain/types'
import CalendarRetryButton from './CalendarRetryButton'
import CompleteDialog from './CompleteDialog'
import IntervalHint from './IntervalHint'
import MaintenanceForm from './MaintenanceForm'
import styles from './MaintenanceTab.module.css'
import { OVERLAY_EXIT_MS } from './overlayTiming'
import StatusBadge, { BADGE_LABEL } from './StatusBadge'
import ui from './ui.module.css'

interface MaintenanceTabProps {
  items: ItemView[] // 선택한 차량의 항목. 정렬(지남 → 곧 교체 → 정상, 같은 상태는 다음 교체일 순, UA-8)과 계산은 훅이 끝낸 값이다
  currentKm: number // BR-07 현재 주행거리. 교체 완료의 주행거리 기본값
  recordsState: 'loading' | 'ready' | 'error' // 다음 교체일 계산이 기록에 기대므로 기록을 읽는 동안은 뼈대를 보인다
  onRetry: () => void
  onSave: (input: ItemInput, id?: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onComplete: (id: string, done: { date: DateKey; odometerKm: number | null }) => Promise<boolean>
  onRetryCalendar: (id: string) => Promise<void>
}

type Dialog = { type: 'add' } | { type: 'edit'; id: string } | { type: 'complete'; id: string } | null

const km = (n: number) => `${n.toLocaleString('en-US')}km`

function cycleText(i: ItemView) {
  return [i.intervalKm !== null && km(i.intervalKm), i.intervalMonths !== null && `${i.intervalMonths}개월`].filter(Boolean).join(' / ')
}

export default function MaintenanceTab({ items, currentKm, recordsState, onRetry, onSave, onDelete, onComplete, onRetryCalendar }: MaintenanceTabProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const dialogWasOpen = useRef(false)

  // 수정 양식에서 삭제하면 눌렀던 행이 사라져 Overlay가 포커스를 돌려줄 곳이 없다 — 닫힌 직후에만, 포커스가 body면 첫 버튼으로 보낸다(2.4.3)
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
  }, [dialog, items.length])

  // 재시도에 성공하면 누른 버튼이 사라져 포커스가 body로 떨어진다 — 항목이 갱신된 뒤 같은 행의 "교체 완료"로 돌려준다(2.4.3)
  const retryFocusId = useRef<string | null>(null)
  useEffect(() => {
    const id = retryFocusId.current
    if (!id || items.find((i) => i.id === id)?.calendarFailed) return // 아직 실패 상태면 버튼이 남아 포커스도 그대로다
    retryFocusId.current = null
    if (document.activeElement === document.body) areaRef.current?.querySelector<HTMLElement>(`[data-complete="${CSS.escape(id)}"]`)?.focus()
  }, [items])

  async function retryCalendar(id: string) {
    retryFocusId.current = id
    await onRetryCalendar(id)
  }

  if (recordsState === 'loading') {
    return (
      <div role="status" className={styles.loading}>
        <span className="sr-only">불러오는 중</span>
      </div>
    )
  }
  if (recordsState === 'error') {
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

  const editing = dialog?.type === 'edit' ? items.find((i) => i.id === dialog.id) : undefined
  const completing = dialog?.type === 'complete' ? items.find((i) => i.id === dialog.id) : undefined
  const add = (
    <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={() => setDialog({ type: 'add' })}>
      항목 추가
    </button>
  )

  return (
    <div ref={areaRef} className={styles.tab}>
      <IntervalHint />

      {items.length === 0 ? (
        // 빈 상태: 상단 "항목 추가"는 숨기고 이 버튼 하나만 기본 강조로 둔다(UA-11). 안내 문구는 그대로 보인다(AC-12-3)
        <div className={styles.empty}>
          <p className={styles.emptyText}>교체 항목이 없습니다</p>
          {add}
        </div>
      ) : (
        <section aria-labelledby="maintenance-list">
          <div className={styles.listHead}>
            <h3 id="maintenance-list" className={styles.heading}>
              교체 항목
            </h3>
            {add}
          </div>
          <div className={styles.columns} aria-hidden="true">
            <span>이름</span>
            <span>주기</span>
            <span>마지막 교체</span>
            <span>다음 교체일</span>
            <span className={styles.endText}>남은 거리</span>
            <span>상태</span>
          </div>
          <ul className={styles.rows}>
            {items.map((i) => {
              const remaining = i.remainingKm
              return (
                <li key={i.id} className={styles.card}>
                  <button
                    type="button"
                    className={styles.nameButton}
                    aria-label={`${i.name}${i.status !== 'ok' ? `, ${BADGE_LABEL[i.status]}` : ''}, 수정`}
                    onClick={() => setDialog({ type: 'edit', id: i.id })}
                  >
                    <span className={styles.name}>{i.name}</span>
                    <span className={styles.chevron} aria-hidden="true">
                      ›
                    </span>
                  </button>
                  {i.status !== 'ok' && (
                    <span className={styles.badgeSlot} aria-hidden="true">
                      <StatusBadge status={i.status} />
                    </span>
                  )}
                  <p className={styles.cycle}>
                    <span className={styles.caption}>주기 </span>
                    {cycleText(i)}
                  </p>
                  <p className={styles.last}>
                    <span className={styles.caption}>마지막 교체 </span>
                    <span className={styles.value}>{i.lastDate}</span>
                    {i.lastOdometerKm !== null && <span className={styles.value}> · {km(i.lastOdometerKm)}</span>}
                  </p>
                  <div className={styles.nextLine}>
                  <p className={styles.next}>
                    <span className={styles.caption}>다음 교체일 </span>
                    {i.nextDate ? <span className={i.status === 'overdue' ? styles.overdueDate : styles.value}>{i.nextDate}</span> : <span className={styles.noData}>{MSG_18_NO_ODOMETER_DATA}</span>}
                  </p>
                  <p className={styles.remaining}>
                    {remaining !== null && (
                      <>
                        <span className={styles.caption}>남은 거리 </span>
                        <span className={styles.value}>{remaining < 0 ? `${km(-remaining)} 초과` : km(remaining)}</span>
                      </>
                    )}
                  </p>
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={`${ui.btn} ${ui.secondary}`} data-complete={i.id} aria-label={`교체 완료, ${i.name}`} onClick={() => setDialog({ type: 'complete', id: i.id })}>
                      교체 완료
                    </button>
                    {i.calendarFailed && <CalendarRetryButton target={`교체 항목 ${i.name}`} onRetry={() => retryCalendar(i.id)} />}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <AnimatePresence>
        {dialog?.type === 'add' && <MaintenanceForm key="add" onSave={onSave} onClose={() => setDialog(null)} />}
        {editing && <MaintenanceForm key={`edit-${editing.id}`} item={editing} onSave={onSave} onDelete={onDelete} onClose={() => setDialog(null)} />}
        {completing && <CompleteDialog key={`complete-${completing.id}`} item={completing} currentKm={currentKm} onComplete={onComplete} onClose={() => setDialog(null)} />}
      </AnimatePresence>
    </div>
  )
}
