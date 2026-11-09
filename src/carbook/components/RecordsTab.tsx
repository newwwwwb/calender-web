// 기록 탭(SCR-02a, F-04·F-05): 연비 요약, 기록 추가, 기록 목록(행을 누르면 수정 양식), 빈·로딩·오류 상태. 양식은 RecordForm이 연다
import { AnimatePresence } from 'motion/react'
import { useRef, useState } from 'react'
import { MSG_04_LOAD_FAILED } from '../domain/messages'
import { currentOdometerKm } from '../domain/odometer'
import type { CarRecord, EconomySegment, RecordInput } from '../domain/types'
import { KIND_LABEL } from './kindLabels'
import RecordForm from './RecordForm'
import styles from './RecordsTab.module.css'
import ui from './ui.module.css'

interface RecordsTabProps {
  records: CarRecord[] // 선택한 차량의 기록, BR-09 정렬(날짜 내림차순, 같은 날은 나중에 만든 것이 위)
  economy: EconomySegment[] // 구간 끝 날짜 오름차순
  vehicleOdometerKm: number | null // 차량 자체의 주행거리(현재 주행거리 BR-07 계산용)
  recordsState: 'loading' | 'ready' | 'error'
  onRetry: () => void
  onSave: (input: RecordInput, id?: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}

type Dialog = { type: 'add' } | { type: 'edit'; id: string } | null

const won = (n: number) => `${n.toLocaleString('en-US')}원`
const km = (n: number) => `${n.toLocaleString('en-US')}km`

export default function RecordsTab({ records, economy, vehicleOdometerKm, recordsState, onRetry, onSave, onDelete }: RecordsTabProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  // 대화상자의 퇴장 애니메이션이 끝난 뒤에 복구한다(퇴장이 길어도 맞는다, NFR-18). 취소처럼 Overlay가 이미 누른 버튼으로 돌려줬으면 포커스가 body가 아니라 건드리지 않는다(2.4.3)
  function restoreFocus() {
    // onExitComplete는 퇴장하는 노드가 DOM에서 빠지기 직전에 불린다 — 빠진 다음 프레임에 확인해야 포커스가 body로 떨어진 것을 볼 수 있다
    requestAnimationFrame(() => {
      if (areaRef.current && document.activeElement === document.body) areaRef.current.querySelector<HTMLElement>('button')?.focus()
    })
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

  const latest = economy[economy.length - 1] // 가장 최근 구간
  const ecoByRecord = new Map(economy.map((s) => [s.endRecordId, s.kmPerL]))
  const editing = dialog?.type === 'edit' ? records.find((r) => r.id === dialog.id) : undefined
  const add = (
    <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={() => setDialog({ type: 'add' })}>
      기록 추가
    </button>
  )

  return (
    <div ref={areaRef} className={styles.tab}>
      <section aria-labelledby="records-economy" className={styles.economy}>
        <h3 id="records-economy" className="sr-only">
          연비
        </h3>
        {latest ? (
          <p className={styles.economyValue}>
            연비 <strong>{latest.kmPerL.toFixed(1)}km/L</strong>
          </p>
        ) : (
          <p className={styles.muted}>연비: 가득 주유 기록이 2건 이상 필요합니다</p>
        )}
      </section>

      {records.length === 0 ? (
        // 빈 상태: 상단 "기록 추가"는 숨기고 이 버튼 하나만 기본 강조로 둔다(UA-11)
        <div className={styles.empty}>
          <p className={styles.emptyText}>기록이 없습니다</p>
          {add}
        </div>
      ) : (
        <section aria-labelledby="records-list">
          <div className={styles.listHead}>
            <h3 id="records-list" className={styles.heading}>
              기록
            </h3>
            {add}
          </div>
          <ul className={styles.rows}>
            {records.map((r) => {
              const eco = ecoByRecord.get(r.id)
              const detail = [r.odometerKm !== null && km(r.odometerKm), r.kind === 'fuel' && r.liters !== null && `${r.liters}L`, eco !== undefined && `연비 ${eco.toFixed(1)}km/L`].filter(Boolean)
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={styles.row}
                    aria-label={`${r.date} ${KIND_LABEL[r.kind]} ${won(r.amountWon)}${detail.length ? `, ${detail.join(', ')}` : ''}${r.memo ? `, 메모 ${r.memo}` : ''}, 수정`}
                    onClick={() => setDialog({ type: 'edit', id: r.id })}
                  >
                    <span className={styles.main}>
                      <span className={styles.date}>{r.date}</span> · <span className={styles.kind}>{KIND_LABEL[r.kind]}</span>
                    </span>
                    <span className={styles.amount}>{won(r.amountWon)}</span>
                    {detail.length > 0 && <span className={styles.detail}>{detail.join(' · ')}</span>}
                    {r.memo && <span className={styles.memo}>{r.memo}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <AnimatePresence onExitComplete={restoreFocus}>
        {dialog?.type === 'add' && (
          <RecordForm key="add" currentKm={currentOdometerKm(vehicleOdometerKm, records)} onSave={onSave} onClose={() => setDialog(null)} />
        )}
        {editing && (
          <RecordForm
            key={`edit-${editing.id}`}
            record={editing}
            currentKm={currentOdometerKm(vehicleOdometerKm, records, editing.id)}
            onSave={onSave}
            onDelete={onDelete}
            onClose={() => setDialog(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
