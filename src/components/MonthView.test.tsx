// MonthView: 그리드 렌더링, 오늘/선택일 표시, 이벤트 칩, 공휴일 표시, 날짜 선택을 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import MonthView from './MonthView'
import styles from './MonthView.module.css'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15)) // 오늘 = 2026-09-15
})

afterEach(() => {
  vi.useRealTimers()
})

// CalendarProvider의 초기 로드(repository의 Promise 체인)를 흘려보낸다.
// 가짜 타이머가 켜진 상태에서는 RTL의 waitFor(실제 setTimeout 폴링)가 동작하지 않는다.
async function flushLoad() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('MonthView', () => {
  it('요일 헤더 7개와 날짜 셀 42개를 렌더링한다', async () => {
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <MonthView />
      </CalendarProvider>,
    )
    await flushLoad()
    expect(screen.getByText('일')).toBeInTheDocument()
    expect(screen.getByText('토')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(42)
  })

  it('오늘 날짜 셀에 today 스타일이 적용된다', async () => {
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <MonthView />
      </CalendarProvider>,
    )
    await flushLoad()
    const today = screen.getByText('15')
    expect(today.className).toContain(styles.dayNumberToday)
  })

  it('공휴일이 있는 날짜에 공휴일 이름을 표시한다', async () => {
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <MonthView />
      </CalendarProvider>,
    )
    await flushLoad()
    // 그리드는 2026-08-30~2026-10-10을 포함하므로 추석 연휴(9/24)가 보인다
    expect(screen.getAllByText('추석 연휴').length).toBeGreaterThan(0)
  })

  it('이벤트가 해당 날짜 칸에 칩으로 표시된다', async () => {
    const repo = new FakeRepository()
    repo.categories.push({ id: 'c1', name: '업무', color: '#0066ff' })
    repo.events.push({
      id: 'e1',
      title: '팀 회의',
      allDay: true,
      start: '2026-09-15',
      end: '2026-09-15',
      categoryId: 'c1',
    })
    render(
      <CalendarProvider repository={repo}>
        <MonthView />
      </CalendarProvider>,
    )
    await flushLoad()
    expect(screen.getByText('팀 회의')).toBeInTheDocument()
  })

  it('날짜를 클릭하면 선택 상태가 바뀐다', async () => {
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <MonthView />
      </CalendarProvider>,
    )
    await flushLoad()
    const target = screen.getByText('20').closest('button')!
    fireEvent.click(target)
    expect(target.className).toContain(styles.cellSelected)
  })
})
