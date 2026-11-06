// 통계 탭(SCR-02d, F-09): 월 선택, 선택한 달의 총합·종류별 합계, 최근 12개월 합계, 연비 변화. 계산은 domain/stats·fuelEconomy 결과를 받아 보여 준다
import { useState } from 'react'
import { addMonths, today } from '../domain/dateKey'
import { MSG_04_LOAD_FAILED } from '../domain/messages'
import { monthTotals, recentMonthlyTotals } from '../domain/stats'
import type { CarRecord, EconomySegment, RecordKind } from '../domain/types'
import styles from './StatsTab.module.css'

interface StatsTabProps {
  records: CarRecord[] // 선택한 차량의 기록만(합계 함수는 차량을 거르지 않는다)
  economy: EconomySegment[]
  recordsState: 'loading' | 'ready' | 'error'
  onRetry: () => void
}

const KIND_LABEL: Record<RecordKind, string> = { fuel: '주유', maintenance: '정비', wash: '세차', insurance: '보험', tax: '세금', parking: '주차', other: '기타' }
const won = (n: number) => `${n.toLocaleString('en-US')}원`
const shiftMonth = (month: string, delta: number) => addMonths(`${month}-01`, delta).slice(0, 7)

export default function StatsTab({ records, economy, recordsState, onRetry }: StatsTabProps) {
  const [month, setMonth] = useState(() => today().slice(0, 7)) // 기본: 이번 달

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
        <button type="button" className={styles.btn} onClick={onRetry}>
          다시 시도
        </button>
      </div>
    )
  }

  const totals = monthTotals(records, month)
  const recent = recentMonthlyTotals(records) // 선택한 달과 무관하게 오늘이 속한 달부터 12개월

  return (
    <div className={styles.stats}>
      <section aria-labelledby="stats-month">
        <h3 id="stats-month" className={styles.heading}>
          월 선택
        </h3>
        <div className={styles.monthPicker}>
          <button type="button" className={`${styles.btn} ${styles.step}`} aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <span className={styles.month}>{month}</span>
          <button type="button" className={`${styles.btn} ${styles.step}`} aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
        <div aria-live="polite" className={styles.total}>
          <p className={styles.totalLabel}>총 지출</p>
          <p className={styles.totalValue}>{won(totals.totalWon)}</p>
          {totals.recordCount === 0 && <p className={styles.muted}>이 달의 기록이 없습니다</p>}
        </div>
      </section>

      {totals.byKind.length > 0 && (
        <section aria-labelledby="stats-kinds">
          <h3 id="stats-kinds" className={styles.heading}>
            종류별 합계
          </h3>
          <ul className={styles.rows}>
            {totals.byKind.map(({ kind, amountWon }) => (
              <li key={kind} className={styles.row}>
                <span>{KIND_LABEL[kind]}</span>
                <span className={amountWon === 0 ? styles.zero : styles.amount}>{won(amountWon)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="stats-monthly">
        <h3 id="stats-monthly" className={styles.heading}>
          월별 합계
        </h3>
        <ul className={styles.rows}>
          {recent.map(({ month: m, amountWon }) => (
            <li key={m} className={styles.row}>
              <span>{m}</span>
              <span className={amountWon === 0 ? styles.zero : styles.amount}>{won(amountWon)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stats-economy">
        <h3 id="stats-economy" className={styles.heading}>
          연비 변화
        </h3>
        {economy.length === 0 ? (
          <p className={styles.muted}>가득 주유 기록이 2건 이상 필요합니다</p>
        ) : (
          <ul className={styles.rows}>
            {economy.map(({ endRecordId, endDate, kmPerL }) => (
              <li key={endRecordId} className={styles.row}>
                {endDate} — {kmPerL.toFixed(1)}km/L
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
