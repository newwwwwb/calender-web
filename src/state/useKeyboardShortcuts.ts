// 데스크탑 키보드 단축키: T 오늘, M/W/D/A 보기 전환, ←/→ 이동, N 새 일정, / 검색, Esc 닫기
import { useEffect } from 'react'
import { stepDate } from '../lib/date'
import type { CalendarView } from '../types'

interface ShortcutHandlers {
  view: CalendarView
  currentDate: Date
  selectedDate: Date
  setCurrentDate: (date: Date) => void
  setSelectedDate: (date: Date) => void
  setView: (view: CalendarView) => void
  onNewEvent: () => void
  onSearch: () => void
  onEscape: () => void
  disabled: boolean // 모달이 열려 있으면 Esc 외의 단축키는 막는다 (입력 중 오작동 방지)
}

function changeView(handlers: ShortcutHandlers, view: CalendarView) {
  handlers.setView(view)
  handlers.setCurrentDate(handlers.selectedDate) // Header의 보기 전환과 동일하게 선택일을 기준으로 삼는다
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (handlers.disabled) {
        if (e.key === 'Escape') handlers.onEscape()
        return
      }

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
          changeView(handlers, 'month')
          break
        case 'w':
        case 'W':
          changeView(handlers, 'week')
          break
        case 'd':
        case 'D':
          changeView(handlers, 'day')
          break
        case 'a':
        case 'A':
          changeView(handlers, 'agenda')
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
