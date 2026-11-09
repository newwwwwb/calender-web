// 통계 탭(SCR-02d, F-09): 월 선택, 선택한 달의 총합·종류별 합계, 최근 12개월 합계, 연비 변화. 계산은 domain/stats·fuelEconomy 결과를 받아 보여 준다
import { useMemo, useState } from 'react'
import { addMonths, today } from '../domain/dateKey'
import { MSG_04_LOAD_FAILED } from '../domain/messages'
import { monthTotals, recentMonthlyTotals } from '../domain/stats'
import type { CarRecord, EconomySegment } from '../domain/types'
import { KIND_LABEL } from './kindLabels'
import styles from './StatsTab.module.css'

interface StatsTabProps {
  records: CarRecord[] // 선택한 차량의 기록만(합계 함수는 차량을 거르지 않는다)
  economy: EconomySegment[]
  recordsState: 'loading' | 'ready' | 'error'
  onRetry: () => void
}

const won = (n: number) => `${n.toLocaleString('en-US')}원`
const shiftMonth = (month: string, delta: number) => addMonths(`${month}-01`, delta).slice(0, 7)
const MIN_MONTH = '1970-01' // 이보다 앞·너무 먼 미래로 가면 날짜 계산이 잘못된 값을 만들 수 있어 이동 범위를 둔다
const spoken = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`

export default function StatsTab({ records, economy, recordsState, onRetry }: StatsTabProps) {
  const [month, setMonth] = useState(() => today().slice(0, 7)) // 기본: 이번 달
  const maxMonth = shiftMonth(today().slice(0, 7), 12)
  // 합계·목록은 기록이 2,000건이어도 달 이동·포커스 때 다시 계산하지 않게 기억해 둔다
  const totals = useMemo(() => monthTotals(records, month), [records, month])
  const recent = useMemo(() => recentMonthlyTotals(records), [records]) // 선택한 달과 무관하게 오늘이 속한 달부터 12개월

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
          className={styles.btn}
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

  return (
    <div className={styles.stats}>
      <section aria-labelledby="stats-month">
        <h3 id="stats-month" className={styles.heading}>
          월 선택
        </h3>
        <div className={styles.monthPicker}>
          <button type="button" className={`${styles.btn} ${styles.step}`} aria-label="이전 달" aria-disabled={month <= MIN_MONTH} onClick={() => month > MIN_MONTH && setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <span className={styles.month}>{month}</span>
          <button type="button" className={`${styles.btn} ${styles.step}`} aria-label="다음 달" aria-disabled={month >= maxMonth} onClick={() => month < maxMonth && setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
        {/* 달이 바뀌면 어느 달의 값인지까지 읽히게 문장으로 알린다(숫자만 바뀌면 무슨 달인지 모른다) */}
        <p role="status" className="sr-only">
          {`${spoken(month)} 총 지출 ${won(totals.totalWon)}${totals.recordCount === 0 ? ', 이 달의 기록이 없습니다' : ''}`}
        </p>
        <div className={styles.total}>
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
