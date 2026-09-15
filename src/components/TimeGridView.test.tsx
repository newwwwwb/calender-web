// TimeGridView: 헤더, 종일 줄, 시간대 겹침 배치, 클릭으로 생성/수정을 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import TimeGridView from './TimeGridView'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15)) // 오늘 = 2026-09-15(화)
})

afterEach(() => {
  vi.useRealTimers()
})

// CalendarProvider의 초기 로드(Promise 체인)를 흘려보낸다.
// 가짜 타이머가 켜진 상태에서는 RTL의 findBy/waitFor(실제 setTimeout 폴링)가 동작하지 않는다.
async function flushLoad() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

const DAYS = [new Date(2026, 8, 13), new Date(2026, 8, 14), new Date(2026, 8, 15)] // 일,월,화

function renderGrid(repo: FakeRepository, props: Partial<Parameters<typeof TimeGridView>[0]> = {}) {
  return render(
    <CalendarProvider repository={repo}>
      <TimeGridView days={DAYS} {...props} />
    </CalendarProvider>,
  )
}

describe('TimeGridView', () => {
  it('날짜 수만큼 헤더를 렌더링하고 오늘에 today 표시를 한다', async () => {
    renderGrid(new FakeRepository())
    await flushLoad()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    const today = screen.getByText('15')
    expect(today.className).toContain('dayHeaderNumberToday')
  })

  it('종일 일정은 종일 줄에, 시간대 일정은 그리드에 표시된다', async () => {
    const repo = new FakeRepository()
    repo.events.push(
      { id: 'a', title: '종일 일정', allDay: true, start: '2026-09-14', end: '2026-09-14' },
      { id: 'b', title: '회의', allDay: false, start: '2026-09-14T10:00', end: '2026-09-14T11:00' },
    )
    renderGrid(repo)
    await flushLoad()
    expect(screen.getByText('종일 일정')).toBeInTheDocument()
    expect(screen.getByText(/회의/)).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument()
  })

  it('빈 시간 칸을 클릭하면 onCreateEvent가 날짜와 시각과 함께 호출된다', async () => {
    const onCreateEvent = vi.fn()
    renderGrid(new FakeRepository(), { onCreateEvent })
    await flushLoad()

    const cells = document.querySelectorAll('[class*="hourCell"]')
    // 두 번째 날(9/14) 그리드의 10번째(인덱스 9) 셀 = 9시
    fireEvent.click(cells[24 + 9])

    expect(onCreateEvent).toHaveBeenCalledTimes(1)
    const [date, hour] = onCreateEvent.mock.calls[0]
    expect(date.getDate()).toBe(14)
    expect(hour).toBe(9)
  })

  it('일정을 클릭하면 onSelectEvent가 호출된다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'b', title: '회의', allDay: false, start: '2026-09-14T10:00', end: '2026-09-14T11:00' })
    const onSelectEvent = vi.fn()
    renderGrid(repo, { onSelectEvent })
    await flushLoad()

    fireEvent.click(screen.getByText(/회의/))
    expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ id: 'b' }) }))
  })

  it('겹치는 시간대 일정은 서로 다른 칸에 나란히 배치된다', async () => {
    const repo = new FakeRepository()
    repo.events.push(
      { id: 'a', title: '일정A', allDay: false, start: '2026-09-14T09:00', end: '2026-09-14T10:00' },
      { id: 'b', title: '일정B', allDay: false, start: '2026-09-14T09:30', end: '2026-09-14T10:30' },
    )
    renderGrid(repo)
    await flushLoad()

    const blockA = screen.getByText(/일정A/).closest('span')!
    const blockB = screen.getByText(/일정B/).closest('span')!
    expect(blockA.style.left).not.toBe(blockB.style.left)
    expect(blockA.style.width).toBe('50%')
    expect(blockB.style.width).toBe('50%')
  })
})
