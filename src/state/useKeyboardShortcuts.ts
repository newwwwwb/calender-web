// 데스크탑 키보드 단축키: T 오늘, M/W/D/A 보기 전환, ←/→ 이동, N 새 일정, / 검색, Esc 닫기
import { useEffect } from 'react'
import { stepDate } from '../lib/date'
import type { CalendarView } from '../types'

interface ShortcutHandlers {
  view: CalendarView
  currentDate: Date
  setCurrentDate: (date: Date) => void
  setSelectedDate: (date: Date) => void
  changeView: (view: CalendarView) => void // 보기 전환(선택일 기준 이동까지 포함) - useCalendar 제공
  onNewEvent: () => void
  onSearch: () => void
  onEscape: () => void
  disabled: boolean // 모달이 열려 있으면 Esc 외의 단축키는 막는다 (입력 중 오작동 방지)
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Esc는 입력창에 포커스가 있어도(예: 일정 제목 입력 중) 항상 모달을 닫을 수 있어야 한다
      if (e.key === 'Escape') {
        if (handlers.disabled) handlers.onEscape()
        return
      }
      if (handlers.disabled) return

      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 't':
        case 'T': {
          const today = new Date()
          handlers.setCurrentDate(today)
          handlers.setSelectedDate(today)
          break
        }
        case 'm':
        case 'M':
          handlers.changeView('month')
          break
        case 'w':
        case 'W':
          handlers.changeView('week')
          break
        case 'd':
        case 'D':
          handlers.changeView('day')
          break
        case 'a':
        case 'A':
          handlers.changeView('agenda')
          break
        case 'ArrowLeft':
          handlers.setCurrentDate(stepDate(handlers.view, handlers.currentDate, -1))
          break
        case 'ArrowRight':
          handlers.setCurrentDate(stepDate(handlers.view, handlers.currentDate, 1))
          break
        case 'n':
        case 'N':
          handlers.onNewEvent()
          break
        case '/':
          e.preventDefault()
          handlers.onSearch()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}
