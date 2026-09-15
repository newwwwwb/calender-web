// AgendaView: 날짜별 그룹핑, 정렬, 공휴일 표시, 빈 상태, 클릭 동작을 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import AgendaView from './AgendaView'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15)) // 오늘 = 2026-09-15, 표시 달 = 2026년 9월
})

afterEach(() => {
  vi.useRealTimers()
})

async function flushLoad() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

function renderAgenda(repo: FakeRepository, props: Partial<Parameters<typeof AgendaView>[0]> = {}) {
  return render(
    <CalendarProvider repository={repo}>
      <AgendaView {...props} />
    </CalendarProvider>,
  )
}

describe('AgendaView', () => {
  it('이 달에 일정이 없으면 빈 상태 문구를 보여준다', async () => {
    renderAgenda(new FakeRepository())
    await flushLoad()
    expect(screen.getByText('이 달에는 일정이 없어요.')).toBeInTheDocument()
  })

  it('날짜별로 묶고, 같은 날 안에서는 종일 일정을 먼저 시간순으로 보여준다', async () => {
    const repo = new FakeRepository()
    repo.events.push(
      { id: 'c', title: '오후 회의', allDay: false, start: '2026-09-10T14:00', end: '2026-09-10T15:00' },
      { id: 'a', title: '오전 회의', allDay: false, start: '2026-09-10T09:00', end: '2026-09-10T10:00' },
      { id: 'b', title: '생일', allDay: true, start: '2026-09-10', end: '2026-09-10' },
    )
    renderAgenda(repo)
    await flushLoad()

    const titles = screen.getAllByText(/회의|생일/).map((el) => el.textContent)
    expect(titles).toEqual(['생일', '오전 회의', '오후 회의'])
  })

  it('여러 날에 걸친 종일 일정은 각 날짜에 모두 나타난다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'trip', title: '여행', allDay: true, start: '2026-09-05', end: '2026-09-07' })
    renderAgenda(repo)
    await flushLoad()

    expect(screen.getAllByText('여행')).toHaveLength(3)
  })

  it('공휴일이 있는 날짜에는 이름을 함께 보여준다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'a', title: '연휴 일정', allDay: true, start: '2026-09-25', end: '2026-09-25' })
    renderAgenda(repo)
    await flushLoad()

    expect(screen.getByText('추석')).toBeInTheDocument()
  })

  it('일정을 클릭하면 onSelectEvent가 호출된다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'a', title: '점심 약속', allDay: false, start: '2026-09-10T12:00', end: '2026-09-10T13:00' })
    const onSelectEvent = vi.fn()
    renderAgenda(repo, { onSelectEvent })
    await flushLoad()

    fireEvent.click(screen.getByText('점심 약속'))
    expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ id: 'a' }) }))
  })
})
