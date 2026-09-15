// 반복 규칙 입력 UI: 빈도/간격/요일/종료조건 (EventEditor에서 분리)
import type { RecurrenceFreq } from '../types'
import styles from './EventEditor.module.css'

const FREQ_OPTIONS: { value: RecurrenceFreq | 'none'; label: string }[] = [
  { value: 'none', label: '반복 안 함' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
]
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
export type EndCondition = 'never' | 'until' | 'count'

interface RecurrenceFieldsProps {
  freq: RecurrenceFreq | 'none'
  onFreqChange: (freq: RecurrenceFreq | 'none') => void
  interval: number
  onIntervalChange: (interval: number) => void
  byWeekday: number[]
  onToggleWeekday: (day: number) => void
  endCondition: EndCondition
  onEndConditionChange: (endCondition: EndCondition) => void
  until: string
  onUntilChange: (until: string) => void
  count: number
  onCountChange: (count: number) => void
  showChangeHint: boolean // 기존 반복 일정을 수정 중일 때만: 규칙 변경은 '전체' 범위에서만 반영된다는 안내
}

function RecurrenceFields({
  freq,
  onFreqChange,
  interval,
  onIntervalChange,
  byWeekday,
  onToggleWeekday,
  endCondition,
  onEndConditionChange,
  until,
  onUntilChange,
  count,
  onCountChange,
  showChangeHint,
}: RecurrenceFieldsProps) {
  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>반복</span>
        <select className={styles.select} value={freq} onChange={(e) => onFreqChange(e.target.value as RecurrenceFreq | 'none')}>
          {FREQ_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {showChangeHint && <span className={styles.hint}>반복 규칙 변경은 저장 시 '전체 일정'을 선택해야 적용돼요.</span>}

      {freq !== 'none' && (
        <>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>간격</span>
              <input
                type="number"
                min={1}
                className={styles.input}
                value={interval}
                onChange={(e) => onIntervalChange(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>반복 종료</span>
              <select
                className={styles.select}
                value={endCondition}
                onChange={(e) => onEndConditionChange(e.target.value as EndCondition)}
              >
                <option value="never">없음</option>
                <option value="until">날짜까지</option>
                <option value="count">횟수</option>
              </select>
            </label>
          </div>

          {freq === 'weekly' && (
            <div className={styles.weekdayGroup}>
              {WEEKDAY_LABELS.map((label, day) => (
                <label key={label} className={styles.weekdayOption}>
                  <input type="checkbox" checked={byWeekday.includes(day)} onChange={() => onToggleWeekday(day)} />
                  {label}
                </label>
              ))}
            </div>
          )}

          {endCondition === 'until' && (
            <label className={styles.field}>
              <span className={styles.label}>반복 종료일</span>
              <input type="date" className={styles.input} value={until} onChange={(e) => onUntilChange(e.target.value)} />
            </label>
          )}
          {endCondition === 'count' && (
            <label className={styles.field}>
              <span className={styles.label}>반복 횟수</span>
              <input
                type="number"
                min={1}
                className={styles.input}
                value={count}
                onChange={(e) => onCountChange(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
          )}
        </>
      )}
    </>
  )
}

export default RecurrenceFields
