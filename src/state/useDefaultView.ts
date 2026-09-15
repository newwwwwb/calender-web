// 기본으로 열릴 보기(월/주/일/목록) 선택 상태. localStorage에 저장한다.
import { useState } from 'react'
import type { CalendarView } from '../types'

const DEFAULT_VIEW_KEY = 'calendar.defaultView'
const VALID_VIEWS: CalendarView[] = ['month', 'week', 'day', 'agenda']

export function readDefaultView(): CalendarView {
  const saved = localStorage.getItem(DEFAULT_VIEW_KEY)
  return (VALID_VIEWS as string[]).includes(saved ?? '') ? (saved as CalendarView) : 'month'
}

interface DefaultViewState {
  defaultView: CalendarView
  setDefaultView: (view: CalendarView) => void
}

export function useDefaultView(): DefaultViewState {
  const [defaultView, setDefaultViewState] = useState<CalendarView>(readDefaultView)

  function setDefaultView(view: CalendarView) {
    setDefaultViewState(view)
    localStorage.setItem(DEFAULT_VIEW_KEY, view)
  }

  return { defaultView, setDefaultView }
}
