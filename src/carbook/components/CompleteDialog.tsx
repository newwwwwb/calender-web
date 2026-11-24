// 교체 완료 대화상자(DLG-05, F-06 BR-15): 마지막 교체일(기본 오늘)과 마지막 교체 주행거리(기본 현재 주행거리)를 확인해 항목에 반영한다. 정비 기록은 만들지 않는다
import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import Overlay from '../../components/Overlay'
import { isValidDateKey, today } from '../domain/dateKey'
import { MSG_19_LAST_ODOMETER, MSG_20_LAST_DATE_FUTURE, MSG_27_COMPLETE_HINT } from '../domain/messages'
import type { DateKey, MaintenanceItem } from '../domain/types'
import { parseDate, parseInteger } from '../domain/validation'
import { ActionDock } from './AuthExpiredNotice'
import { expiredProps, useAuthExpired } from './authExpired'
import styles from './CompleteDialog.module.css'
import ui from './ui.module.css'
import { useIgnoreScrimClick } from './useIgnoreScrimClick'
import base from './VehicleForm.module.css'

interface CompleteDialogProps {
  item: Pick<MaintenanceItem, 'id' | 'name' | 'intervalKm'> // intervalKm가 있으면 주행거리는 필수다(F-06 입력 표)
  currentKm: number // BR-07 현재 주행거리. 주행거리 칸의 기본값(0은 '정보 없음'이라 칸을 비운다, BR-06 취지)
  onComplete: (id: string, done: { date: DateKey; odometerKm: number | null }) => Promise<boolean> // false면 실패 토스트는 훅이 띄우고 창은 그대로 둔다
  onClose: () => void
}

type Field = 'date' | 'odometer'

export default function CompleteDialog({ item, currentKm, onComplete, onClose }: CompleteDialogProps) {
  const [date, setDate] = useState<string>(() => today())
  const [odometer, setOdometer] = useState(() => (currentKm > 0 ? String(currentKm) : ''))
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [saving, setSaving] = useState(false)
  const expired = useAuthExpired() // 만료 안내가 보이는 동안 저장은 잠긴다(NTC-01)
  const inFlight = useRef(false)
  const closed = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const idPrefix = useId()
  useIgnoreScrimClick(formRef)
  const hintId = `${idPrefix}-hint`
  // Overlay가 설명 연결을 받지 않으므로(공용 파일) 대화상자 요소에 직접 달아, 열 때 화면낭독기가 안내도 함께 읽게 한다(AC-25-4)
  useLayoutEffect(() => {
    formRef.current?.closest('[role="dialog"]')?.setAttribute('aria-describedby', hintId)
  }, [hintId])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return // 중복 제출 방지(AC-10-2)
    const t = today()
    const parsedDate = parseDate(date, '마지막 교체일', t)
    // 오늘보다 뒤인 날짜는 형식은 맞으므로 MSG-20으로 따로 알린다(양식과 같은 규칙)
    const future = !parsedDate.ok && isValidDateKey(date.trim()) && date.trim() > t
    const parsedKm = parseInteger(odometer, '마지막 교체 주행거리', { max: 9_999_999 })
    const next: Partial<Record<Field, string>> = {}
    if (!parsedDate.ok) next.date = future ? MSG_20_LAST_DATE_FUTURE : parsedDate.error
    if (!parsedKm.ok) next.odometer = parsedKm.error
    else if (parsedKm.value === null && item.intervalKm !== null) next.odometer = MSG_19_LAST_ODOMETER
    if (next.date || next.odometer || !parsedDate.ok || !parsedKm.ok) {
      setErrors(next)
      formRef.current?.querySelector<HTMLElement>(next.date ? '[name="date"]' : '[name="odometer"]')?.focus() // 첫 오류 칸으로
      return
    }
    setErrors({})
    inFlight.current = true
    setSaving(true)
    let done = false
    try {
      done = await onComplete(item.id, { date: parsedDate.value, odometerKm: parsedKm.value })
    } catch (error) {
      console.error('[carbook] 교체 완료 오류:', error)
    }
    if (done && !closed.current) onClose()
    else if (!done) {
      inFlight.current = false
      setSaving(false)
    }
  }

  const requestClose = () => {
    closed.current = true
    onClose()
  }

  const field = (name: Field, label: string, props: Record<string, unknown>) => {
    const id = `${idPrefix}-${name}`
    const error = errors[name]
    return (
      <div className={`${base.field} ${base.pair}`}>
        <label htmlFor={id} className={base.label}>
          {label}
        </label>
        <input id={id} name={name} className={base.input} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...props} />
        {error && (
          <p id={`${id}-error`} className={base.error}>
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <Overlay label="교체 완료" onClose={requestClose}>
      <form ref={formRef} className={`${ui.dialogBody} ${base.form}`} onSubmit={submit} noValidate>
        <h2 className={ui.dialogTitle}>교체 완료</h2>
        <p className={styles.itemName}>{item.name}</p>
        <div className={base.fields}>
          {field('date', '마지막 교체일 (필수)', { type: 'date', value: date, autoFocus: true, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value) })}
          {field('odometer', '마지막 교체 주행거리 (km)', { inputMode: 'numeric', value: odometer, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setOdometer(e.target.value) })}
        </div>
        <p id={hintId} className={styles.note}>
          <svg className={styles.noteIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="9" y="8.5" width="2" height="6" fill="currentColor" />
            <circle cx="10" cy="5.8" r="1.2" fill="currentColor" />
          </svg>
          <span>{MSG_27_COMPLETE_HINT}</span>
        </p>
        <ActionDock>
          <div className={ui.buttonRow}>
            <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={saving} {...expiredProps(expired)}>
              확인
            </button>
            <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={requestClose}>
              취소
            </button>
          </div>
        </ActionDock>
      </form>
    </Overlay>
  )
}
