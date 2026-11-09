// 만기일 입력·수정 양식(DLG-07, F-07): 종류는 행으로 정해져 읽기 전용으로 보이고, 날짜 오류는 칸 아래에, 저장 실패는 훅의 토스트로 보이며 입력값은 남는다
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import Overlay from '../../components/Overlay'
import { nextCarTaxDate, type CarTaxQuickPick } from '../domain/dueDates'
import type { DateKey, DueKind } from '../domain/types'
import { validateDueDate } from '../domain/validation'
import { DUE_LABEL } from './dueLabels'
import styles from './DueDateForm.module.css'
import ui from './ui.module.css'
import { useIgnoreScrimClick } from './useIgnoreScrimClick'
import base from './VehicleForm.module.css'

interface DueDateFormProps {
  kind: DueKind
  current?: DateKey // 있으면 수정, 없으면 입력
  onSave: (kind: DueKind, dueDate: DateKey) => Promise<boolean> // false면 실패 토스트는 훅이 띄우고 양식은 그대로 둔다
  onClose: () => void
}

export default function DueDateForm({ kind, current, onSave, onClose }: DueDateFormProps) {
  const [date, setDate] = useState<string>(current ?? '') // 자동으로 추정하거나 채우지 않는다(BR-17)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('') // 빠른 선택으로 날짜 칸이 바뀐 것을 화면낭독기에 알린다
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(noticeTimer.current), [])
  const inFlight = useRef(false)
  const closed = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  const title = current ? '만기일 수정' : '만기일 입력'
  useIgnoreScrimClick(formRef)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return // 중복 제출 방지(AC-10-2)
    const result = validateDueDate(date)
    if (!result.ok) {
      setError(result.error)
      formRef.current?.querySelector<HTMLElement>('input')?.focus() // 오류 칸으로
      return
    }
    setError(null)
    inFlight.current = true
    setSaving(true)
    let done = false
    try {
      done = await onSave(kind, result.value)
    } catch (e) {
      console.error('[carbook] 만기일 저장 오류:', e)
    }
    if (done && !closed.current) onClose()
    else if (!done) {
      inFlight.current = false
      setSaving(false)
    }
  }

  // 자동차세 빠른 선택(F-15): 칸만 채운다. 저장·일정 생성은 하지 않고, 이후 직접 고친 값이 쓰인다(BR-18)
  function quickPick(pick: CarTaxQuickPick) {
    const value = nextCarTaxDate(pick)
    setDate(value)
    setError(null)
    // 같은 문구를 다시 넣으면 role=status가 변하지 않아 낭독되지 않는다 — 비웠다가 잠시 뒤 다시 채워 누를 때마다 변화가 생기게 한다(4.1.3)
    setNotice('')
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(`만기일 칸 값: ${value}`), 80)
  }

  const requestClose = () => {
    closed.current = true
    onClose()
  }

  return (
    <Overlay label={`${DUE_LABEL[kind]} ${title}`} onClose={requestClose}>
      <form ref={formRef} className={`${ui.dialogBody} ${base.form}`} onSubmit={submit} noValidate>
        <h2 className={ui.dialogTitle}>{title}</h2>
        <div className={base.fields}>
          <div className={base.field}>
            <span className={base.label}>종류</span>
            <p className={styles.kind}>{DUE_LABEL[kind]}</p>
          </div>
          <div className={base.field}>
            <label htmlFor={`${id}-date`} className={base.label}>
              만기일 (필수)
            </label>
            <input
              id={`${id}-date`}
              name="dueDate"
              type="date"
              className={base.input}
              autoFocus
              value={date}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(e) => setDate(e.target.value)}
            />
            {error && (
              <p id={`${id}-error`} className={base.error}>
                <span aria-hidden="true">⚠ </span>
                {error}
              </p>
            )}
            {kind === 'car_tax' && (
              <div className={styles.chips} role="group" aria-label="빠른 선택">
                <button type="button" className={styles.chip} onClick={() => quickPick('jun30')}>
                  6월 30일
                </button>
                <button type="button" className={styles.chip} onClick={() => quickPick('dec31')}>
                  12월 31일
                </button>
              </div>
            )}
            <p role="status" className="sr-only">
              {notice}
            </p>
          </div>
        </div>
        <div className={ui.buttonRow}>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={saving}>
            저장
          </button>
          <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={requestClose}>
            취소
          </button>
        </div>
      </form>
    </Overlay>
  )
}
