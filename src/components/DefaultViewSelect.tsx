// 설정 모달: 기본으로 열릴 보기(월/주/일/목록) 선택. 지금 화면에도 바로 반영한다
import { useCalendar } from '../state/useCalendar'
import { useDefaultView } from '../state/useDefaultView'
import type { CalendarView } from '../types'
import styles from './DefaultViewSelect.module.css'

const VIEW_OPTIONS: { label: string; value: CalendarView }[] = [
  { label: '월', value: 'month' },
  { label: '주', value: 'week' },
  { label: '일', value: 'day' },
  { label: '목록', value: 'agenda' },
]

function DefaultViewSelect() {
  const { defaultView, setDefaultView } = useDefaultView()
  const { changeView } = useCalendar()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as CalendarView
    setDefaultView(next)
    changeView(next)
  }

  return (
    <select className={styles.select} value={defaultView} onChange={handleChange} aria-label="기본 보기">
      {VIEW_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default DefaultViewSelect
