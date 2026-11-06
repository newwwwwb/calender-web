// 차량 추가·수정 양식(DLG-01, F-03): 입력 검사 오류는 칸 아래에, 저장 실패는 훅의 토스트로 보이고 입력값은 그대로 남는다
import { useId, useRef, useState, type FormEvent } from 'react'
import Overlay from '../../components/Overlay'
import type { Vehicle, VehicleInput } from '../domain/types'
import { validateVehicle, type VehicleField, type VehicleRaw } from '../domain/validation'
import ui from './ui.module.css'
import { useIgnoreScrimClick } from './useIgnoreScrimClick'
import styles from './VehicleForm.module.css'

interface VehicleFormProps {
  vehicle?: Vehicle // 있으면 수정, 없으면 추가
  onSave: (input: VehicleInput) => Promise<boolean> // false면 실패 토스트는 훅이 띄우고 양식은 그대로 둔다
  onClose: () => void
}

const FIELDS: { name: VehicleField; label: string; required?: boolean; numeric?: boolean }[] = [
  { name: 'name', label: '별칭', required: true },
  { name: 'model', label: '차종' },
  { name: 'year', label: '연식', numeric: true },
  { name: 'plate', label: '번호판' },
  { name: 'odometer', label: '현재 주행거리 (km)', numeric: true },
]

function toRaw(vehicle?: Vehicle): VehicleRaw {
  return {
    name: vehicle?.name ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year?.toString() ?? '',
    plate: vehicle?.plate ?? '',
    odometer: vehicle?.odometerKm?.toString() ?? '',
  }
}

export default function VehicleForm({ vehicle, onSave, onClose }: VehicleFormProps) {
  const [raw, setRaw] = useState<VehicleRaw>(() => toRaw(vehicle))
  const [errors, setErrors] = useState<Partial<Record<VehicleField, string>>>({})
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const idPrefix = useId()
  const title = vehicle ? '차량 수정' : '차량 추가'
  useIgnoreScrimClick(formRef)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return // 중복 제출 방지(AC-10-2)
    const result = validateVehicle(raw)
    if (!result.ok) {
      setErrors(result.errors)
      const first = FIELDS.find((f) => result.errors[f.name])
      if (first) formRef.current?.querySelector<HTMLInputElement>(`[name="${first.name}"]`)?.focus() // 첫 오류 칸으로
      return
    }
    setErrors({})
    inFlight.current = true
    setSaving(true)
    const done = await onSave(result.value)
    if (done) onClose()
    else {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <Overlay label={title} onClose={onClose}>
      <form ref={formRef} className={`${ui.dialogBody} ${styles.form}`} onSubmit={submit} noValidate>
        <h2 className={ui.dialogTitle}>{title}</h2>
        <div className={styles.fields}>
          {FIELDS.map(({ name, label, required, numeric }) => {
            const id = `${idPrefix}-${name}`
            const error = errors[name]
            return (
              <div key={name} className={`${styles.field} ${name === 'year' || name === 'plate' ? styles.pair : ''}`}>
                <label htmlFor={id} className={styles.label}>
                  {label}
                  {required && ' (필수)'}
                </label>
                <input
                  id={id}
                  name={name}
                  className={styles.input}
                  value={raw[name]}
                  inputMode={numeric ? 'numeric' : undefined}
                  autoFocus={name === 'name'}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(e) => setRaw({ ...raw, [name]: e.target.value })}
                />
                {error && (
                  <p id={`${id}-error`} className={styles.error}>
                    <span aria-hidden="true">⚠ </span>
                    {error}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <div className={ui.buttonRow}>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={saving}>
            저장
          </button>
          <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={onClose}>
            취소
          </button>
        </div>
      </form>
    </Overlay>
  )
}
