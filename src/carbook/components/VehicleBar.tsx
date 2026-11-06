// 차량 영역(SCR-02 위쪽·SCR-03): 차량 선택 상자, 차량 추가, 차량 정보 카드(수정·삭제), 차량이 없을 때의 빈 상태. 대화상자는 여기서 연다
import { AnimatePresence } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import type { Vehicle, VehicleInput } from '../domain/types'
import { MSG_14_VEHICLE_DELETE } from '../domain/messages'
import ConfirmDialog from './ConfirmDialog'
import ui from './ui.module.css'
import styles from './VehicleBar.module.css'
import VehicleForm from './VehicleForm'

interface VehicleBarProps {
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  currentOdometerKm: number // BR-07: 차량 주행거리와 기록 중 최댓값(없으면 0 → "-")
  onSelect: (id: string) => void
  onSave: (input: VehicleInput, id?: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}

type Dialog = 'add' | 'edit' | 'delete' | null

const dash = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '-' : String(value))

export default function VehicleBar({ vehicles, selectedVehicleId, currentOdometerKm, onSelect, onSave, onDelete }: VehicleBarProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const selectId = useId()
  const selected = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0]
  const close = () => setDialog(null)
  const areaRef = useRef<HTMLElement>(null)

  // 대화상자를 연 버튼이 닫힌 뒤 사라지는 경로(빈 상태에서 첫 차량 추가, 마지막 차량 삭제)는 Overlay가 포커스를 돌려줄 곳이 없어
  // 포커스가 body로 떨어진다(2.4.3). 퇴장 애니메이션과 목록 갱신이 끝난 뒤에도 포커스를 잃었으면 영역의 첫 조작 요소로 보낸다
  useEffect(() => {
    if (dialog) return
    const id = setTimeout(() => {
      if (areaRef.current && document.activeElement === document.body) areaRef.current.querySelector<HTMLElement>('select, button')?.focus()
    }, 350)
    return () => clearTimeout(id)
  }, [dialog, vehicles.length])

  return (
    <section ref={areaRef} aria-label="차량 영역">
      {vehicles.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>차량을 추가해 주세요</p>
          <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={() => setDialog('add')}>
            차량 추가
          </button>
        </div>
      ) : (
        <div className={styles.area}>
          <div className={styles.picker}>
            <label htmlFor={selectId} className={styles.label}>
              차량
            </label>
            <div className={styles.pickerRow}>
              <select id={selectId} className={styles.select} value={selected.id} onChange={(e) => onSelect(e.target.value)}>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={() => setDialog('add')}>
                차량 추가
              </button>
            </div>
          </div>
          <div className={styles.card}>
            <h2 className="sr-only">차량 정보</h2>
            <div className={styles.cardHead}>
              <p className={styles.name}>{selected.name}</p>
              <p className={styles.sub}>{[selected.model, selected.year].filter(Boolean).join(' · ') || '-'}</p>
            </div>
            <dl className={styles.facts}>
              <div>
                <dt>번호판</dt>
                <dd>{dash(selected.plate)}</dd>
              </div>
              <div>
                <dt>현재 주행거리</dt>
                <dd>{currentOdometerKm > 0 ? `${currentOdometerKm.toLocaleString('en-US')} km` : '-'}</dd>
              </div>
            </dl>
            <div className={styles.actions}>
              <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={() => setDialog('edit')}>
                수정
              </button>
              <button type="button" className={`${ui.btn} ${ui.dangerOutline}`} onClick={() => setDialog('delete')}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {dialog === 'add' && <VehicleForm key="add" onSave={(input) => onSave(input)} onClose={close} />}
        {dialog === 'edit' && selected && <VehicleForm key="edit" vehicle={selected} onSave={(input) => onSave(input, selected.id)} onClose={close} />}
        {dialog === 'delete' && selected && (
          <ConfirmDialog key="delete" target={`차량 ${selected.name}`} warning={MSG_14_VEHICLE_DELETE} onConfirm={() => onDelete(selected.id)} onClose={close} />
        )}
      </AnimatePresence>
    </section>
  )
}
