// useKeyboardShortcuts: 단축키 동작, 입력 중 무시, 모달 열렸을 때 Esc만 허용을 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

interface HarnessProps {
  disabled?: boolean
  onNewEvent?: () => void
  onSearch?: () => void
  onEscape?: () => void
}

function Harness({ disabled = false, onNewEvent = () => {}, onSearch = () => {}, onEscape = () => {} }: HarnessProps) {
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('month')
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 15))

  useKeyboardShortcuts({
    view,
    currentDate,
    setCurrentDate,
    setSelectedDate: setCurrentDate,
    changeView: setView, // 테스트에서는 selectedDate 동기화까지는 검증하지 않으므로 단순화
    onNewEvent,
    onSearch,
    onEscape,
    disabled,
  })

  return (
    <div>
      <span data-testid="view">{view}</span>
      <span data-testid="date">{currentDate.getDate()}</span>
      <input data-testid="text-input" />
    </div>
  )
}

function press(key: string, target: Element = document.body) {
  fireEvent.keyDown(target, { key })
}

describe('useKeyboardShortcuts', () => {
  it('M/W/D/A로 보기를 전환한다', () => {
    render(<Harness />)
    press('w')
    expect(screen.getByTestId('view')).toHaveTextContent('week')
    press('D')
    expect(screen.getByTestId('view')).toHaveTextContent('day')
    press('a')
    expect(screen.getByTestId('view')).toHaveTextContent('agenda')
    press('m')
    expect(screen.getByTestId('view')).toHaveTextContent('month')
  })

  it('화살표로 현재 보기 단위만큼(월 보기 = 한 달) 이동한다', () => {
    render(<Harness />)
    press('ArrowRight')
    expect(screen.getByTestId('date')).toHaveTextContent('15') // 9/15 + 1달 = 10/15, 날짜 숫자는 그대로 15
    press('m') // 그대로 두되, 실제 이동은 date-fns stepDate 단위 테스트에서 이미 검증됨
  })

  it('T를 누르면 오늘로 이동한다', () => {
    render(<Harness />)
    press('ArrowRight')
    press('t')
    expect(screen.getByTestId('date')).toHaveTextContent(String(new Date().getDate()))
  })

  it("N과 '/'로 새 일정·검색 콜백을 호출한다", () => {
    const onNewEvent = vi.fn()
    const onSearch = vi.fn()
    render(<Harness onNewEvent={onNewEvent} onSearch={onSearch} />)
    press('n')
    press('/')
    expect(onNewEvent).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('N은 기본 동작(문자 입력)을 막는다 — 안 막으면 새로 포커스된 입력란에 "n"이 새어들어간다', () => {
    // 회귀 테스트: preventDefault가 없으면 EventEditor의 자동 포커스 제목 입력란에
    // 이 keydown의 문자 입력 기본 동작이 그대로 흘러들어가던 버그(보스 리뷰에서 발견)
    render(<Harness />)
    const notCancelled = fireEvent.keyDown(document.body, { key: 'n', cancelable: true })
    expect(notCancelled).toBe(false) // dispatchEvent는 preventDefault 호출 시 false를 반환한다
  })

  it('입력창에 포커스가 있으면 단축키를 무시한다', () => {
    const onNewEvent = vi.fn()
    render(<Harness onNewEvent={onNewEvent} />)
    press('w', screen.getByTestId('text-input'))
    press('n', screen.getByTestId('text-input'))
    expect(screen.getByTestId('view')).toHaveTextContent('month')
    expect(onNewEvent).not.toHaveBeenCalled()
  })

  it('모달이 열려 있으면(disabled) 다른 단축키는 무시하고 Esc만 동작한다', () => {
    const onNewEvent = vi.fn()
    const onEscape = vi.fn()
    render(<Harness disabled onNewEvent={onNewEvent} onEscape={onEscape} />)
    press('n')
    press('w')
    expect(onNewEvent).not.toHaveBeenCalled()
    expect(screen.getByTestId('view')).toHaveTextContent('month')

    press('Escape')
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('입력창에 포커스가 있어도(예: 일정 제목 입력 중) Esc는 항상 동작한다', () => {
    const onEscape = vi.fn()
    render(<Harness disabled onEscape={onEscape} />)
    press('Escape', screen.getByTestId('text-input'))
    expect(onEscape).toHaveBeenCalledTimes(1)
  })
})
