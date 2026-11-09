// 교체 항목 추가·수정 양식(DLG-06, F-06·F-12): 입력 오류는 칸 아래(MSG-09는 두 주기 칸 아래 한 곳)에, 저장 실패는 훅의 토스트로 보이고 입력값은 그대로 남는다
import { useId, useRef, useState, type FormEvent } from 'react'
import Overlay from '../../components/Overlay'
import { today } from '../domain/dateKey'
import type { ItemInput, MaintenanceItem } from '../domain/types'
import { validateItem, type ItemField, type ItemRaw } from '../domain/validation'
import ConfirmDialog from './ConfirmDialog'
import IntervalHint from './IntervalHint'
import styles from './MaintenanceForm.module.css'
import ui from './ui.module.css'
import { useIgnoreScrimClick } from './useIgnoreScrimClick'
import base from './VehicleForm.module.css'

interface MaintenanceFormProps {
  item?: MaintenanceItem // 있으면 수정, 없으면 추가
  onSave: (input: ItemInput, id?: string) => Promise<boolean> // false면 실패 토스트는 훅이 띄우고 양식은 그대로 둔다
  onDelete?: (id: string) => Promise<boolean> // 수정 양식의 "삭제"(F-11 확인 뒤)
  onClose: () => void
}

const toRaw = (i?: MaintenanceItem): ItemRaw => ({
  name: i?.name ?? '',
  intervalKm: i?.intervalKm?.toString() ?? '',
  intervalMonths: i?.intervalMonths?.toString() ?? '',
  lastDate: i?.lastDate ?? today(), // 추가의 기본값은 오늘
  lastOdometer: i?.lastOdometerKm?.toString() ?? '',
})

// 오류가 있을 때 포커스를 보낼 순서. 'interval'(MSG-09)은 첫 주기 칸으로 간다
const ORDER: ItemField[] = ['name', 'intervalKm', 'intervalMonths', 'interval', 'lastDate', 'lastOdometer']

export default function MaintenanceForm({ item, onSave, onDelete, onClose }: MaintenanceFormProps) {
  const [raw, setRaw] = useState<ItemRaw>(() => toRaw(item))
  const [errors, setErrors] = useState<Partial<Record<ItemField, string>>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inFlight = useRef(false)
  const closed = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const idPrefix = useId()
  const title = item ? '교체 항목 수정' : '교체 항목 추가'
  useIgnoreScrimClick(formRef)

  const set = (patch: Partial<ItemRaw>) => setRaw({ ...raw, ...patch })

  async function save(input: ItemInput) {
    if (inFlight.current) return // 중복 제출 방지(AC-10-2)
    inFlight.current = true
    setSaving(true)
    let done = false
    try {
      done = await onSave(input, item?.id)
    } catch (error) {
      console.error('[carbook] 교체 항목 저장 오류:', error)
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
    const result = validateItem(raw)
    if (!result.ok) {
      setErrors(result.errors)
      const first = ORDER.find((f) => result.errors[f])
      const target = first === 'interval' ? 'intervalKm' : first
      if (target) formRef.current?.querySelector<HTMLElement>(`[name="${target}"]`)?.focus() // 첫 오류 칸으로
      return
    }
    setErrors({})
    void save(result.value)
  }

  const requestClose = () => {
    closed.current = true
    onClose()
  }

  const errorId = (name: ItemField) => `${idPrefix}-${name}-error`
  const errorLine = (name: ItemField) =>
    errors[name] && (
      <p id={errorId(name)} className={base.error}>
        <span aria-hidden="true">⚠ </span>
        {errors[name]}
      </p>
    )

  // 칸 하나: 이름표는 항상 칸 위, 오류는 칸 아래에 연결한다(components.md 3장). MSG-09(interval)는 두 주기 칸이 함께 가리킨다
  const field = (name: Exclude<ItemField, 'interval'>, label: string, value: string, opts: { pair?: boolean; inputMode?: 'numeric'; type?: string; autoFocus?: boolean } = {}) => {
    const id = `${idPrefix}-${name}`
    const intervalError = (name === 'intervalKm' || name === 'intervalMonths') && errors.interval
    const describedBy = [errors[name] && errorId(name), intervalError && errorId('interval')].filter(Boolean).join(' ')
    const invalid = Boolean(errors[name] || intervalError)
    return (
      <div className={`${base.field} ${opts.pair ? base.pair : ''}`}>
        <label htmlFor={id} className={base.label}>
          {label}
        </label>
        <input
          id={id}
          name={name}
          className={base.input}
          type={opts.type}
          inputMode={opts.inputMode}
          autoFocus={opts.autoFocus}
          value={value}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => set({ [name]: e.target.value } as Partial<ItemRaw>)}
        />
        {errorLine(name)}
      </div>
    )
  }

  return (
    <>
      <Overlay label={title} onClose={requestClose}>
        <form ref={formRef} className={`${ui.dialogBody} ${base.form}`} onSubmit={submit} noValidate>
          <h2 className={ui.dialogTitle}>{title}</h2>
          <div className={base.fields}>
            {field('name', '이름 (필수)', raw.name, { autoFocus: true })}
            <div className={styles.hint}>
              <IntervalHint />
            </div>
            {field('intervalKm', 'km 주기', raw.intervalKm, { pair: true, inputMode: 'numeric' })}
            {field('intervalMonths', '개월 주기', raw.intervalMonths, { pair: true, inputMode: 'numeric' })}
            {errors.interval && <div className={styles.intervalError}>{errorLine('interval')}</div>}
            {field('lastDate', '마지막 교체일 (필수)', raw.lastDate, { pair: true, type: 'date' })}
            {field('lastOdometer', '마지막 교체 주행거리 (km, km 주기가 있으면 필수)', raw.lastOdometer, { pair: true, inputMode: 'numeric' })}
          </div>
          <div className={ui.buttonRow}>
            <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={saving}>
              저장
            </button>
            <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={requestClose}>
              취소
            </button>
            {item && onDelete && (
              <button type="button" className={`${ui.btn} ${ui.dangerOutline} ${styles.delete}`} onClick={() => setConfirmDelete(true)}>
                삭제
              </button>
            )}
          </div>
        </form>
      </Overlay>
      {confirmDelete && item && onDelete && (
        <ConfirmDialog
          target={`교체 항목 ${item.name}`}
          onConfirm={async () => {
            const done = await onDelete(item.id)
            if (done) onClose()
            return done
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
