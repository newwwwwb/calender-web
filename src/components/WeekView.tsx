// 주 보기: currentDate가 속한 주(일~토)를 TimeGridView로 렌더링
import { useMemo } from 'react'
import { getWeekDays } from '../lib/date'
import { useCalendar } from '../state/useCalendar'
import type { CalendarEvent } from '../types'
import TimeGridView from './TimeGridView'

interface WeekViewProps {
  onSelectEvent?: (event: CalendarEvent) => void
  onCreateEvent?: (date: Date, hour: number) => void
}

function WeekView({ onSelectEvent, onCreateEvent }: WeekViewProps) {
  const { currentDate } = useCalendar()
  const days = useMemo(() => getWeekDays(currentDate), [currentDate])
  return <TimeGridView days={days} onSelectEvent={onSelectEvent} onCreateEvent={onCreateEvent} />
}

export default WeekView
