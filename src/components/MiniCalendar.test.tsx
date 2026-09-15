// MiniCalendar: 월 이동, 날짜 클릭 시 선택/이동(뷰 유지), 일정 있는 날짜 점 표시를 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider, useCalendar } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import MiniCalendar from './MiniCalendar'

function Probe() {
  const cal = useCalendar()
  return (
    <div>
      <span data-testid="current-date">{cal.currentDate.toDateString()}</span>
      <span data-testid="selected-date">{cal.selectedDate.toDateString()}</span>
      <span data-testid="view">{cal.view}</span>
    </div>
  )
}

function renderMini(repo: FakeRepository) {
  return render(
    <CalendarProvider repository={repo}>
      <MiniCalendar />
      <Probe />
    </CalendarProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15)) // 오늘 = 2026-09-15
})

afterEach(() => {
  vi.useRealTimers()
})

describe('MiniCalendar', () => {
  it('현재 달 제목을 보여준다', () => {
    const repo = new FakeRepository()
    renderMini(repo)
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
  })

  it('다음/이전 달 버튼으로 currentDate를 한 달씩 옮긴다', () => {
    const repo = new FakeRepository()
    renderMini(repo)

    fireEvent.click(screen.getByLabelText('다음 달'))
    expect(screen.getByText('2026년 10월')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('이전 달'))
    fireEvent.click(screen.getByLabelText('이전 달'))
    expect(screen.getByText('2026년 8월')).toBeInTheDocument()
  })

  it('날짜를 클릭하면 selectedDate/currentDate만 바뀌고 view는 그대로 유지된다', () => {
    const repo = new FakeRepository()
    renderMini(repo)

    fireEvent.click(screen.getByLabelText('2026-09-20'))

    expect(screen.getByTestId('selected-date')).toHaveTextContent(new Date(2026, 8, 20).toDateString())
    expect(screen.getByTestId('current-date')).toHaveTextContent(new Date(2026, 8, 20).toDateString())
    expect(screen.getByTestId('view')).toHaveTextContent('month')
  })

  it('일정이 있는 날짜에는 점을 표시하고, 없는 날짜는 빈 점을 표시한다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    renderMini(repo)
    await act(async () => {}) // FakeRepository의 비동기 초기 로드를 플러시(가짜 타이머라 waitFor 폴링은 못 씀)

    const cell10 = screen.getByLabelText('2026-09-10')
    const cell11 = screen.getByLabelText('2026-09-11')

    expect(cell10.querySelector('span:last-child')?.className).not.toMatch(/dotEmpty/)
    expect(cell11.querySelector('span:last-child')?.className).toMatch(/dotEmpty/)
  })

  it('그리드 마지막 날짜(2026-10-10)의 시간대 일정도 점으로 표시된다', async () => {
    // MonthView와 같은 이유의 회귀 테스트(grid[41] 자정 경계 버그)
    const repo = new FakeRepository()
    repo.events.push({ id: 'e2', title: '마지막날 회의', allDay: false, start: '2026-10-10T09:00', end: '2026-10-10T10:00' })
    renderMini(repo)
    await act(async () => {})

    const lastCell = screen.getByLabelText('2026-10-10')
    expect(lastCell.querySelector('span:last-child')?.className).not.toMatch(/dotEmpty/)
  })
})
