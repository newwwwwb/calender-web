// 기록 추가·수정 양식(DLG-03, F-04)과 주행거리 감소 확인(DLG-04): 입력 오류는 칸 아래에, 저장 실패는 훅의 토스트로 보이고 입력값은 그대로 남는다
import { useId, useRef, useState, type FormEvent, type ReactElement } from 'react'
import Overlay from '../../components/Overlay'
import { today } from '../domain/dateKey'
import { MSG_10_ODOMETER_DROP } from '../domain/messages'
import { isOdometerDecrease } from '../domain/odometer'
import { RECORD_KINDS, type CarRecord, type RecordInput } from '../domain/types'
import { validateRecord, type RecordField, type RecordRaw } from '../domain/validation'
import ConfirmDialog from './ConfirmDialog'
import { KIND_LABEL } from './kindLabels'
import styles from './RecordForm.module.css'
import ui from './ui.module.css'
import { useIgnoreScrimClick } from './useIgnoreScrimClick'
import base from './VehicleForm.module.css'

interface RecordFormProps {
  record?: CarRecord // 있으면 수정, 없으면 추가
  currentKm: number // BR-07 현재 주행거리(수정 중인 기록 자신은 뺀 값). 이보다 작은 주행거리는 MSG-10으로 확인한다(BR-08)
  onSave: (input: RecordInput, id?: string) => Promise<boolean> // false면 실패 토스트는 훅이 띄우고 양식은 그대로 둔다
  onDelete?: (id: string) => Promise<boolean> // 수정 양식의 "삭제"(F-11 확인 뒤)
  onClose: () => void
}

const toRaw = (r?: CarRecord): RecordRaw => ({
  kind: r?.kind ?? '',
  date: r?.date ?? today(), // 기본 오늘
  amount: r ? String(r.amountWon) : '',
  odometer: r?.odometerKm?.toString() ?? '',
  liters: r?.liters?.toString() ?? '',
  fullTank: r?.fullTank ?? false,
  memo: r?.memo ?? '',
})

export default function RecordForm({ record, currentKm, onSave, onDelete, onClose }: RecordFormProps) {
  const [raw, setRaw] = useState<RecordRaw>(() => toRaw(record))
  const [errors, setErrors] = useState<Partial<Record<RecordField, string>>>({})
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<RecordInput | null>(null) // DLG-04 확인을 기다리는 값
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inFlight = useRef(false)
  const closed = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const idPrefix = useId()
  const title = record ? '기록 수정' : '기록 추가'
  useIgnoreScrimClick(formRef)

  const set = (patch: Partial<RecordRaw>) => setRaw({ ...raw, ...patch })

  async function save(input: RecordInput) {
    if (inFlight.current) return // 중복 제출 방지(AC-10-2)
    inFlight.current = true
    setSaving(true)
    let done = false
    try {
      done = await onSave(input, record?.id)
    } catch (error) {
      console.error('[carbook] 기록 저장 오류:', error)
    }
    if (done && !closed.current) onClose()
    else if (!done) {
      inFlight.current = false
      setSaving(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    const result = validateRecord(raw)
    if (!result.ok) {
      setErrors(result.errors)
      const first = ['kind', 'date', 'amount', 'odometer', 'liters', 'memo'].find((f) => result.errors[f as RecordField])
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus() // 첫 오류 칸으로
      return
    }
    setErrors({})
    if (isOdometerDecrease(result.value.odometerKm, currentKm)) setPending(result.value) // 저장을 막지는 않고 확인만 한다(BR-08)
    else void save(result.value)
  }

  const requestClose = () => {
    closed.current = true
    onClose()
  }

  // 칸 하나: 이름표는 항상 칸 위, 오류는 칸 아래에 연결한다(components.md 3장)
  const field = (name: RecordField, label: string, control: (props: Record<string, unknown>) => ReactElement) => {
    const id = `${idPrefix}-${name}`
    const error = errors[name]
    return (
      <div className={base.field}>
        <label htmlFor={id} className={base.label}>
          {label}
        </label>
        {control({ id, name, className: base.input, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined })}
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
    <>
      <Overlay label={title} onClose={requestClose}>
        <form ref={formRef} className={`${ui.dialogBody} ${base.form}`} onSubmit={submit} noValidate>
          <h2 className={ui.dialogTitle}>{title}</h2>
          <div className={styles.fields}>
            {field('kind', '종류 (필수)', (p) => (
              <select {...p} autoFocus value={raw.kind} onChange={(e) => set({ kind: e.target.value })}>
                <option value="">선택</option>
                {RECORD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            ))}
            {field('date', '날짜 (필수)', (p) => (
              <input {...p} type="date" value={raw.date} onChange={(e) => set({ date: e.target.value })} />
            ))}
            {field('amount', '금액 (원) (필수)', (p) => (
              <input {...p} inputMode="numeric" value={raw.amount} onChange={(e) => set({ amount: e.target.value })} />
            ))}
            {field('odometer', '주행거리 (km)', (p) => (
              <input {...p} inputMode="numeric" value={raw.odometer} onChange={(e) => set({ odometer: e.target.value })} />
            ))}
            {raw.kind === 'fuel' && (
              <>
                {field('liters', '주유량 (L)', (p) => (
                  <input {...p} inputMode="decimal" value={raw.liters} onChange={(e) => set({ liters: e.target.value })} />
                ))}
                <label className={styles.check}>
                  <input type="checkbox" checked={raw.fullTank} onChange={(e) => set({ fullTank: e.target.checked })} />
                  가득 주유
                </label>
              </>
            )}
            {field('memo', '메모', (p) => (
              <textarea {...p} className={`${base.input} ${styles.memo}`} value={raw.memo} onChange={(e) => set({ memo: e.target.value })} />
            ))}
          </div>
          <div className={ui.buttonRow}>
            <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={saving}>
              저장
            </button>
            <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={requestClose}>
              취소
            </button>
            {record && onDelete && (
              <button type="button" className={`${ui.btn} ${ui.dangerOutline} ${styles.delete}`} onClick={() => setConfirmDelete(true)}>
                삭제
              </button>
            )}
          </div>
        </form>
      </Overlay>
      {pending && (
        <ConfirmDialog
          label="주행거리 확인"
          title="주행거리가 이전 기록보다 작습니다"
          message={MSG_10_ODOMETER_DROP(currentKm)}
          confirmLabel="저장"
          tone="primary"
          onConfirm={async () => {
            await save(pending)
            return true // 저장 결과와 무관하게 확인창은 닫는다(실패하면 양식으로 돌아가 입력값이 남아 있다)
          }}
          onClose={() => setPending(null)}
        />
      )}
      {confirmDelete && record && onDelete && (
        <ConfirmDialog
          target={`기록(${record.date}·${KIND_LABEL[record.kind]})`}
          onConfirm={async () => {
            const done = await onDelete(record.id)
            if (done) onClose()
            return done
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
