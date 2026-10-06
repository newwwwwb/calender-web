// MiniCalendar: 월 이동, 날짜 클릭 시 선택/이동(뷰 유지), 일정 있는 날짜 점 표시, 격자 키보드 이동(roving tabindex), 자정 갱신을 검증
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
      <button type="button" onClick={() => cal.changeView('week')}>
        주 보기로
      </button>
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
  // 가짜 타이머에 예약된 motion 프레임을 비우고 돌아가야 다음 테스트에서 프레임 루프가 멈추지 않는다(24.10)
  vi.runOnlyPendingTimers()
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

    fireEvent.click(screen.getByLabelText(/^9월 20일 /))

    expect(screen.getByTestId('selected-date')).toHaveTextContent(new Date(2026, 8, 20).toDateString())
    expect(screen.getByTestId('current-date')).toHaveTextContent(new Date(2026, 8, 20).toDateString())
    expect(screen.getByTestId('view')).toHaveTextContent('month')
  })

  it('일정이 있는 날짜에는 점을 표시하고, 없는 날짜는 빈 점을 표시한다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    renderMini(repo)
    await act(async () => {}) // FakeRepository의 비동기 초기 로드를 플러시(가짜 타이머라 waitFor 폴링은 못 씀)

    const cell10 = screen.getByLabelText(/^9월 10일 /)
    const cell11 = screen.getByLabelText(/^9월 11일 /)

    // 숫자를 감싸는 numberWrap이 생겨 span:last-child가 그 안의 숫자와도 매치되므로 cell의 실제 마지막 자식으로 찾는다
    expect((cell10.lastElementChild as HTMLElement).className).not.toMatch(/dotEmpty/)
    expect((cell11.lastElementChild as HTMLElement).className).toMatch(/dotEmpty/)
  })

  it('그리드 마지막 날짜(2026-10-10)의 시간대 일정도 점으로 표시된다', async () => {
    // MonthView와 같은 이유의 회귀 테스트(grid[41] 자정 경계 버그)
    const repo = new FakeRepository()
    repo.events.push({ id: 'e2', title: '마지막날 회의', allDay: false, start: '2026-10-10T09:00', end: '2026-10-10T10:00' })
    renderMini(repo)
    await act(async () => {})

    const lastCell = screen.getByLabelText(/^10월 10일 /)
    expect((lastCell.lastElementChild as HTMLElement).className).not.toMatch(/dotEmpty/)
  })
})

// ── 격자 키보드 이동(roving tabindex) ──
// 슬라이드 중에는 지난 달 격자가 퇴장하며 남아 있어(가짜 타이머라 끝나지 않는다) 같은 날짜 버튼이 둘일 수 있으므로 월 키로 좁혀 찾는다.
function cell(dayKey: string): HTMLButtonElement {
  return document.querySelector(`[data-month="${dayKey.slice(0, 7)}"] [data-day="${dayKey}"]`) as HTMLButtonElement
}

function focusedDay(): string | undefined {
  return (document.activeElement as HTMLElement).dataset.day
}

function press(key: string, init: KeyboardEventInit = {}) {
  return fireEvent.keyDown(document.activeElement as HTMLElement, { key, ...init }) // false면 preventDefault된 것
}

describe('MiniCalendar 키보드 이동', () => {
  it('날짜 버튼 중 탭 정지는 선택일 하나뿐이다', () => {
    renderMini(new FakeRepository())

    const days = Array.from(document.querySelectorAll<HTMLElement>('[data-day]'))
    expect(days).toHaveLength(42)
    const stops = days.filter((d) => d.getAttribute('tabindex') === '0')
    expect(stops).toHaveLength(1)
    expect(stops[0].dataset.day).toBe('2026-09-15')
  })

  // 26단계 승인 심사: 방향키로 옮긴 칸이 tabindex=-1로 남아 Shift+Tab이 격자 안의 선택일로 돌아가고(탭 정지 2개처럼 동작),
  // Overlay 트랩이 실제 탭 정지가 아닌 칸에서 끼어들지 못했다
  it('방향키로 옮기면 탭 정지도 포커스된 칸을 따라가고, 격자를 벗어나면 선택일로 돌아온다', () => {
    renderMini(new FakeRepository())
    cell('2026-09-15').focus()
    press('ArrowDown')
    press('ArrowDown')

    expect(focusedDay()).toBe('2026-09-29')
    const stops = Array.from(document.querySelectorAll<HTMLElement>('[data-day][tabindex="0"]'))
    expect(stops.map((d) => d.dataset.day)).toEqual(['2026-09-29'])

    act(() => (document.activeElement as HTMLElement).blur())
    expect(Array.from(document.querySelectorAll<HTMLElement>('[data-day][tabindex="0"]')).map((d) => d.dataset.day)).toEqual(['2026-09-15'])
  })

  it('달 경계를 넘어도 탭 정지는 새 격자의 포커스된 칸 하나다', () => {
    renderMini(new FakeRepository())
    cell('2026-09-30').focus()
    press('ArrowRight') // 10월 1일 — 달이 넘어간다
    act(() => void vi.advanceTimersByTime(1000))

    expect(focusedDay()).toBe('2026-10-01')
    const stops = Array.from(document.querySelectorAll<HTMLElement>('[data-month="2026-10"] [data-day][tabindex="0"]'))
    expect(stops.map((d) => d.dataset.day)).toEqual(['2026-10-01'])
  })

  it('선택일이 보이는 격자 밖이면 그 달 1일이 탭 정지가 된다', () => {
    renderMini(new FakeRepository())
    // 월 보기가 아니면 달을 넘겨도 선택일이 따라오지 않는다
    fireEvent.click(screen.getByText('주 보기로'))
    fireEvent.click(screen.getByLabelText('다음 달'))
    fireEvent.click(screen.getByLabelText('다음 달'))
    expect(screen.getByText('2026년 11월')).toBeInTheDocument()

    const stops = Array.from(document.querySelectorAll<HTMLElement>('[data-month="2026-11"] [data-day][tabindex="0"]'))
    expect(stops.map((d) => d.dataset.day)).toEqual(['2026-11-01'])
  })

  it.each([
    ['ArrowLeft', '2026-09-14'],
    ['ArrowRight', '2026-09-16'],
    ['ArrowUp', '2026-09-08'],
    ['ArrowDown', '2026-09-22'],
    ['Home', '2026-09-13'], // 9/15(화)의 주 일요일
    ['End', '2026-09-19'], // 같은 주 토요일
  ])('%s는 같은 달 안에서 포커스를 %s로 옮기고 스크롤을 막는다', (key, expected) => {
    renderMini(new FakeRepository())
    cell('2026-09-15').focus()

    const notPrevented = press(key)

    expect(notPrevented).toBe(false)
    expect(focusedDay()).toBe(expected)
    expect(screen.getByText('2026년 9월')).toBeInTheDocument() // 같은 달이면 표시 달은 그대로
  })

  it('방향키는 window의 전역 단축키(←/→ 기간 이동)까지 전달되지 않는다', () => {
    renderMini(new FakeRepository())
    const onWindowKeyDown = vi.fn()
    window.addEventListener('keydown', onWindowKeyDown)
    cell('2026-09-15').focus()

    press('ArrowRight')

    window.removeEventListener('keydown', onWindowKeyDown)
    expect(onWindowKeyDown).not.toHaveBeenCalled()
  })

  it('Alt·Ctrl·Meta 조합은 건드리지 않는다(브라우저 뒤로 가기 등)', () => {
    renderMini(new FakeRepository())
    cell('2026-09-15').focus()

    expect(press('ArrowLeft', { altKey: true })).toBe(true)
    expect(press('ArrowLeft', { ctrlKey: true })).toBe(true)
    expect(focusedDay()).toBe('2026-09-15')
  })

  it('말일에서 →를 누르면 다음 달로 넘어가고 포커스가 새 격자의 1일에 남는다', () => {
    renderMini(new FakeRepository())
    cell('2026-09-30').focus()

    press('ArrowRight')

    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
    expect(focusedDay()).toBe('2026-10-01')
    // 퇴장 중인 지난 달 격자가 아니라 새 달 격자 안의 버튼이어야 한다
    expect(document.activeElement?.closest('[data-month]')).toHaveAttribute('data-month', '2026-10')
    expect(document.activeElement).toBe(cell('2026-10-01'))
  })

  it('1일에서 ←를 누르면 이전 달 말일로 넘어간다', () => {
    renderMini(new FakeRepository())
    cell('2026-09-01').focus()

    press('ArrowLeft')

    expect(screen.getByText('2026년 8월')).toBeInTheDocument()
    expect(focusedDay()).toBe('2026-08-31')
    expect(document.activeElement?.closest('[data-month]')).toHaveAttribute('data-month', '2026-08')
  })

  it('PageDown/PageUp은 달을 넘기고, 그 달에 같은 일자가 없으면 말일로 보정한다', () => {
    renderMini(new FakeRepository())
    fireEvent.click(screen.getByLabelText('다음 달')) // 10월
    cell('2026-10-31').focus()

    press('PageDown')
    expect(screen.getByText('2026년 11월')).toBeInTheDocument()
    expect(focusedDay()).toBe('2026-11-30') // 11월은 30일까지

    cell('2026-11-30').focus()
    press('PageUp')
    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
    expect(focusedDay()).toBe('2026-10-30')
  })

  it('방향키로 다른 달 칸(격자 안의 이웃 달 날짜)에 닿아도 그 달로 넘어간다', () => {
    renderMini(new FakeRepository())
    cell('2026-09-27').focus() // 9월 격자의 마지막 주(9/27~10/3)

    press('ArrowDown') // 10/4 — 격자에는 보이지만 다른 달이다

    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
    expect(focusedDay()).toBe('2026-10-04')
  })

  it('Enter는 가로채지 않아 버튼 기본 동작(클릭)으로 그 날짜가 선택된다', () => {
    renderMini(new FakeRepository())
    cell('2026-09-15').focus()
    press('ArrowRight')

    // Enter/Space를 preventDefault하면 브라우저가 click을 만들지 않는다 — 막지 않는지 확인한 뒤 그 click을 직접 보낸다(jsdom은 만들어 주지 않는다)
    expect(press('Enter')).toBe(true)
    expect(press(' ')).toBe(true)
    fireEvent.click(document.activeElement as HTMLElement)

    expect(screen.getByTestId('selected-date')).toHaveTextContent(new Date(2026, 8, 16).toDateString())
  })
})

describe('MiniCalendar 자정 갱신', () => {
  it('자정이 지나면 오늘 표시가 다음 날로 넘어간다', () => {
    vi.setSystemTime(new Date(2026, 8, 15, 23, 59, 30))
    renderMini(new FakeRepository())
    expect(cell('2026-09-15')).toHaveAttribute('aria-current', 'date')
    expect(cell('2026-09-16')).not.toHaveAttribute('aria-current')

    act(() => {
      vi.advanceTimersByTime(60_000) // useTodayKey의 1분 간격 확인이 자정(00:00:30)을 지나며 돈다
    })

    expect(cell('2026-09-16')).toHaveAttribute('aria-current', 'date')
    expect(cell('2026-09-16').getAttribute('aria-label')).toMatch(/오늘/)
    expect(cell('2026-09-15')).not.toHaveAttribute('aria-current')
  })
})
