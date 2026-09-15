// 일 보기: currentDate 하루를 TimeGridView로 렌더링
import { useMemo } from 'react'
import { useCalendar } from '../state/useCalendar'
import type { EventInstance } from '../types'
import TimeGridView from './TimeGridView'

interface DayViewProps {
  onSelectEvent?: (instance: EventInstance) => void
  onCreateEvent?: (date: Date, hour: number) => void
}

function DayView({ onSelectEvent, onCreateEvent }: DayViewProps) {
  const { currentDate } = useCalendar()
  const days = useMemo(() => [currentDate], [currentDate])
  return <TimeGridView days={days} onSelectEvent={onSelectEvent} onCreateEvent={onCreateEvent} />
}

export default DayView
