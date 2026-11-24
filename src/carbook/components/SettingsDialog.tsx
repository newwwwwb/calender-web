// 설정 창(DLG-09, F-19·F-20)과 추천 주기 되돌리기 미리보기(DLG-10): 기본 차량 라디오(고르는 즉시 저장), 추천 교체 주기 되돌리기, 결과 한 줄
import { AnimatePresence } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import Overlay from '../../components/Overlay'
import { MSG_24_NO_RESET, MSG_25_RESET_CONFIRM, MSG_33_DEFAULT_LOAD_FAILED, MSG_34_RESET_DONE, MSG_35_RESET_CALENDAR_PARTIAL, MSG_36_DEFAULT_APPLY_NOTE } from '../domain/messages'
import type { ResetPlan, ResetResult, Vehicle } from '../domain/types'
import styles from './SettingsDialog.module.css'
import ui from './ui.module.css'

interface SettingsDialogProps {
  vehicles: Vehicle[]
  targetVehicle: Vehicle | null // 되돌리기 대상(지금 보는 차량)
  defaultVehicleId: string | null
  settingsFailed: boolean // 설정 읽기 실패: 선택 표시 없이 MSG-33(AC-19-13)
  resetPlan: ResetPlan
  onSetDefault: (id: string | null) => Promise<boolean> // false면 실패 토스트는 훅이 띄운다
  onReset: () => Promise<ResetResult | null> // null이면 실패(토스트는 훅)
  onClose: () => void
}

const NO_DEFAULT = '' // "지정 안 함"의 값
const km = (n: number) => `${n.toLocaleString('en-US')}km`
// 교체 알림 탭과 같은 주기 표기: "10,000km / 12개월"
const cycle = (c: { intervalKm: number | null; intervalMonths: number | null }) => [c.intervalKm !== null && km(c.intervalKm), c.intervalMonths !== null && `${c.intervalMonths}개월`].filter(Boolean).join(' / ')

type Result = { kind: 'none' } | { kind: 'done'; count: number; calendarFailed: boolean } | null

function InfoIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="8.5" width="2" height="6" fill="currentColor" />
      <circle cx="10" cy="5.8" r="1.2" fill="currentColor" />
    </svg>
  )
}

// DLG-10: 바뀌는 항목을 "지금 → 추천"으로 보여 주고, 확인해야만 쓴다. 포커스는 "취소"에서 시작한다(되돌릴 수 없는 일괄 변경)
function ResetPreview({ vehicleName, plan, onConfirm, onClose }: { vehicleName: string; plan: ResetPlan; onConfirm: () => Promise<boolean>; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const closed = useRef(false)

  async function confirm() {
    if (inFlight.current) return // 중복 요청 방지(AC-20-9)
    inFlight.current = true
    setBusy(true)
    let done = false
    try {
      done = await onConfirm()
    } catch (error) {
      console.error('[carbook] 추천 주기 되돌리기 오류:', error)
    }
    if (done && !closed.current) onClose()
    else if (!done) {
      inFlight.current = false
      setBusy(false)
    }
  }

  const requestClose = () => {
    closed.current = true
    onClose()
  }

  return (
    <Overlay label="추천 교체 주기 되돌리기" onClose={requestClose}>
      <div className={ui.dialogBody}>
        <h2 className={ui.dialogTitle}>추천 교체 주기 되돌리기</h2>
        <p className={styles.targetLine}>{vehicleName}</p>
        <p className={styles.confirmText}>{MSG_25_RESET_CONFIRM(plan.changes.length)}</p>
        <ul className={styles.changes}>
          {plan.changes.map((c) => (
            <li key={c.itemId} className={styles.change}>
              <span className={styles.changeName}>{c.name}</span>
              <span className={styles.changeCycles}>
                <span className={styles.from}>
                  <span className="sr-only">지금 </span>
                  {cycle(c.from)}
                </span>{' '}
                <span className={styles.to}>
                  <span aria-hidden="true">→ </span>
                  <span className="sr-only">추천 </span>
                  {cycle(c.to)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className={ui.buttonRow}>
          {/* disabled 대신 aria-disabled: 눌린 버튼이 disabled가 되면 포커스를 잃고 body로 떨어진다 */}
          <button type="button" className={`${ui.btn} ${ui.primary}`} aria-disabled={busy || undefined} onClick={confirm}>
            되돌리기
          </button>
          <button type="button" className={`${ui.btn} ${ui.secondary}`} autoFocus onClick={requestClose}>
            취소
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default function SettingsDialog({ vehicles, targetVehicle, defaultVehicleId, settingsFailed, resetPlan, onSetDefault, onReset, onClose }: SettingsDialogProps) {
  const [pending, setPending] = useState<string | null>(null) // 저장 중인 선택(실패하면 이전 값으로 돌아간다)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const resetButton = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inFlight = useRef(false)
  const groupName = useId()
  const hasVehicles = vehicles.length > 0

  // 열면 포커스는 선택된 라디오로(차량 0대면 "닫기", 선택 표시가 없으면 첫 라디오). Overlay의 첫 요소 포커스보다 먼저 잡는다
  useLayoutEffect(() => {
    const root = dialogRef.current
    const radio = root?.querySelector<HTMLElement>('input[type="radio"]:checked') ?? root?.querySelector<HTMLElement>('input[type="radio"]')
    radio?.focus({ preventScroll: true })
    if (!root?.contains(document.activeElement)) root?.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true })
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const selected = saving ? pending : settingsFailed ? undefined : defaultVehicleId // undefined: 선택 표시 없음(읽기 실패)

  async function choose(id: string | null) {
    if (inFlight.current || (!settingsFailed && id === defaultVehicleId)) return // 저장 중·같은 값은 요청하지 않는다(읽기 실패 땐 선택 표시가 없으므로 어느 쪽이든 저장한다)
    inFlight.current = true
    setPending(id)
    setSaving(true)
    try {
      await onSetDefault(id) // 실패하면 훅이 토스트를 띄우고 defaultVehicleId가 그대로라 선택이 이전 값으로 돌아간다
    } catch (error) {
      console.error('[carbook] 기본 차량 저장 오류:', error)
    }
    inFlight.current = false
    setSaving(false)
  }

  // 같은 문구가 다시 나와도 화면낭독기가 다시 읽도록 비웠다가 채운다
  function showResult(next: Exclude<Result, null>) {
    clearTimeout(timer.current)
    setResult(null)
    timer.current = setTimeout(() => setResult(next), 80)
  }

  function startReset() {
    if (!targetVehicle) return // 차량 0대: aria-disabled라 눌러도 아무 일도 없다
    if (resetPlan.changes.length === 0) {
      showResult({ kind: 'none' }) // 확인창 없이 MSG-24, 쓰기 없음(AC-20-4)
      return
    }
    setResult(null)
    setPreviewing(true)
  }

  async function confirmReset(): Promise<boolean> {
    const res = await onReset()
    if (!res) return false // 실패: 창은 열린 채 버튼이 다시 활성(토스트는 훅)
    showResult({ kind: 'done', count: res.count, calendarFailed: res.calendarFailed })
    return true
  }

  return (
    <>
      <Overlay label="설정" onClose={onClose}>
        <div ref={dialogRef} className={`${ui.dialogBody} ${styles.root}`}>
          <h2 className={ui.dialogTitle}>설정</h2>

          <section className={styles.section} aria-labelledby={`${groupName}-default`}>
            <h3 id={`${groupName}-default`} className={styles.sectionTitle}>
              기본 차량
            </h3>
            {!hasVehicles ? (
              <p className={styles.plain}>차량을 추가해 주세요</p>
            ) : (
              <>
                {settingsFailed && (
                  <p className={styles.error}>
                    <InfoIcon className={styles.noteIcon} />
                    <span>{MSG_33_DEFAULT_LOAD_FAILED}</span>
                  </p>
                )}
                <div role="radiogroup" aria-labelledby={`${groupName}-default`} aria-busy={saving || undefined} className={`${styles.radios} ${saving ? styles.saving : ''}`}>
                  {[{ id: NO_DEFAULT, name: '지정 안 함', model: null as string | null }, ...vehicles.map((v) => ({ id: v.id, name: v.name, model: v.model }))].map((o) => (
                    <label key={o.id} className={styles.radio}>
                      <input
                        type="radio"
                        name={groupName}
                        className={styles.radioInput}
                        checked={selected === undefined ? false : (selected ?? NO_DEFAULT) === o.id}
                        onChange={() => choose(o.id === NO_DEFAULT ? null : o.id)}
                      />
                      <span className={styles.radioText}>
                        <span className={styles.radioName}>{o.name}</span>
                        {o.model && <span className={styles.radioModel}>{o.model}</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <p className={styles.note}>{MSG_36_DEFAULT_APPLY_NOTE}</p>
              </>
            )}
            <span role="status" className="sr-only">
              {saving ? '저장 중' : ''}
            </span>
          </section>

          <section className={`${styles.section} ${styles.divided}`} aria-labelledby={`${groupName}-reset`}>
            <h3 id={`${groupName}-reset`} className={styles.sectionTitle}>
              추천 교체 주기 되돌리기
            </h3>
            {targetVehicle && (
              <p className={styles.targetLine}>
                <span className={styles.targetLabel}>대상 차량: </span>
                {targetVehicle.name}
              </p>
            )}
            <p className={styles.note}>마지막 교체일·주행거리와 직접 추가한 항목은 그대로 두고, 주기만 추천 값으로 되돌립니다</p>
            <button ref={resetButton} type="button" className={`${ui.btn} ${ui.secondary} ${styles.resetButton}`} aria-disabled={!targetVehicle || undefined} onClick={startReset}>
              되돌리기
            </button>
            {!targetVehicle && <p className={styles.plain}>차량을 추가해 주세요</p>}
            <div role="status" className={styles.result}>
              {result?.kind === 'none' && (
                <p className={styles.info}>
                  <InfoIcon className={styles.noteIcon} />
                  <span>{MSG_24_NO_RESET}</span>
                </p>
              )}
              {result?.kind === 'done' && (
                <>
                  <p className={styles.success}>
                    <svg className={styles.noteIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{MSG_34_RESET_DONE(result.count)}</span>
                  </p>
                  {result.calendarFailed && (
                    <p className={styles.warning}>
                      <InfoIcon className={styles.noteIcon} />
                      <span>{MSG_35_RESET_CALENDAR_PARTIAL}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          <div className={ui.buttonRow}>
            <button type="button" className={`${ui.btn} ${ui.secondary}`} data-close onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </Overlay>

      <AnimatePresence>
        {previewing && targetVehicle && <ResetPreview key="preview" vehicleName={targetVehicle.name} plan={resetPlan} onConfirm={confirmReset} onClose={() => setPreviewing(false)} />}
      </AnimatePresence>
    </>
  )
}
