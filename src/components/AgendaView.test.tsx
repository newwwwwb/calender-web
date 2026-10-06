// AgendaView: 날짜별 그룹핑, 정렬, 공휴일 표시, 빈 상태, 클릭 동작을 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as useCalendarModule from '../state/useCalendar'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import type { CalendarEvent } from '../types'
import AgendaView from './AgendaView'
import styles from './AgendaView.module.css'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15)) // 오늘 = 2026-09-15, 표시 달 = 2026년 9월
})

afterEach(() => {
  // 가짜 타이머에 예약된 motion 프레임을 비우고 돌아가야 다음 테스트에서 프레임 루프가 멈추지 않는다(24.10)
  vi.restoreAllMocks() // 어떤 테스트가 중간에 실패해도 useCalendar 목이 다음 테스트로 새지 않게
  vi.runOnlyPendingTimers()
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

function ViewProbe() {
  const { view, currentDate, selectedDate } = useCalendarModule.useCalendar()
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return (
    <span data-testid="probe">
      {view}|{key(currentDate)}|{key(selectedDate)}
    </span>
  )
}

describe('AgendaView', () => {
  it('이 달에 일정도 공휴일도 없으면 빈 상태 문구와 일정 추가 버튼을 보여준다', async () => {
    vi.setSystemTime(new Date(2026, 10, 15)) // 2026년 11월은 공휴일이 없다
    const onNewEvent = vi.fn()
    renderAgenda(new FakeRepository(), { onNewEvent })
    await flushLoad()
    expect(screen.getByText('이 달에는 일정이 없어요.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '일정 추가' }))
    expect(onNewEvent).toHaveBeenCalledTimes(1)
  })

  it('일정이 없어도 공휴일은 날짜로 보여주고, 맨 위에 빈 상태 문구도 함께 보여준다', async () => {
    renderAgenda(new FakeRepository())
    await flushLoad()
    // 공휴일만 남으면 빈 머리줄처럼 보여 고장 난 것 같았다 — 빈 상태 안내가 함께 있어야 한다(25단계)
    expect(screen.getByText('이 달에는 일정이 없어요.')).toBeInTheDocument()
    expect(screen.getByText('추석')).toBeInTheDocument()
    expect(screen.getByText(/9월 25일/)).toBeInTheDocument()
  })

  it('첫 로딩 중에는 빈 상태 문구를 그리지 않는다', () => {
    vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
      currentDate: new Date(2026, 10, 15),
      shownEvents: [],
      categories: [],
      sharedCalendars: [],
      loading: true,
    } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    render(<AgendaView />)
    expect(screen.queryByText('이 달에는 일정이 없어요.')).not.toBeInTheDocument()
  })

  it('여러 날 종일 일정은 며칠째인지, 시간대 일정은 끝나는 시각을 함께 보여준다', async () => {
    const repo = new FakeRepository()
    repo.events.push(
      {
        id: 'trip',
        title: '여행',
        allDay: true,
        start: '2026-09-05',
        end: '2026-09-07',
      },
      {
        id: 'm',
        title: '회의',
        allDay: false,
        start: '2026-09-10T09:00',
        end: '2026-09-10T10:30',
      },
      {
        id: 'n',
        title: '야간 작업',
        allDay: false,
        start: '2026-09-11T23:00',
        end: '2026-09-12T01:00',
      },
    )
    renderAgenda(repo)
    await flushLoad()

    expect(screen.getByText('1/3일')).toBeInTheDocument()
    expect(screen.getByText('2/3일')).toBeInTheDocument()
    expect(screen.getByText('3/3일')).toBeInTheDocument()
    expect(screen.getByText('10:30')).toBeInTheDocument()
    expect(screen.getByText('9/12 01:00')).toBeInTheDocument()
  })

  it('오늘 날짜 제목에 "오늘" 표시가 붙고, 지난 날 구역은 지난 날 클래스를 가진다', async () => {
    const repo = new FakeRepository()
    repo.events.push(
      {
        id: 'a',
        title: '어제 일정',
        allDay: true,
        start: '2026-09-14',
        end: '2026-09-14',
      },
      {
        id: 'b',
        title: '오늘 일정',
        allDay: true,
        start: '2026-09-15',
        end: '2026-09-15',
      },
    )
    renderAgenda(repo)
    await flushLoad()

    expect(screen.getAllByText('오늘')).toHaveLength(1)
    expect(screen.getByText('오늘').closest('section')).toHaveAttribute('data-day', '2026-09-15')
    expect(screen.getByText('어제 일정').closest('section')?.className).toContain(styles.daySectionPast)
    expect(screen.getByText('오늘 일정').closest('section')?.className).not.toContain(styles.daySectionPast)
  })

  it('날짜 제목을 누르면 그날의 일 보기로 이동한다', async () => {
    const repo = new FakeRepository()
    repo.events.push({
      id: 'a',
      title: '점심',
      allDay: true,
      start: '2026-09-10',
      end: '2026-09-10',
    })
    render(
      <CalendarProvider repository={repo}>
        <AgendaView />
        <ViewProbe />
      </CalendarProvider>,
    )
    await flushLoad()

    fireEvent.click(screen.getByRole('button', { name: /2026년 9월 10일/ }))
    expect(screen.getByTestId('probe')).toHaveTextContent('day|2026-09-10|2026-09-10')
  })

  it('날짜별로 묶고, 같은 날 안에서는 종일 일정을 먼저 시간순으로 보여준다', async () => {
    const repo = new FakeRepository()
    repo.events.push(
      {
        id: 'c',
        title: '오후 회의',
        allDay: false,
        start: '2026-09-10T14:00',
        end: '2026-09-10T15:00',
      },
      {
        id: 'a',
        title: '오전 회의',
        allDay: false,
        start: '2026-09-10T09:00',
        end: '2026-09-10T10:00',
      },
      {
        id: 'b',
        title: '생일',
        allDay: true,
        start: '2026-09-10',
        end: '2026-09-10',
      },
    )
    renderAgenda(repo)
    await flushLoad()

    const titles = screen.getAllByText(/회의|생일/).map((el) => el.textContent)
    expect(titles).toEqual(['생일', '오전 회의', '오후 회의'])
  })

  it('여러 날에 걸친 종일 일정은 각 날짜에 모두 나타난다', async () => {
    const repo = new FakeRepository()
    repo.events.push({
      id: 'trip',
      title: '여행',
      allDay: true,
      start: '2026-09-05',
      end: '2026-09-07',
    })
    renderAgenda(repo)
    await flushLoad()

    expect(screen.getAllByText('여행')).toHaveLength(3)
  })

  it('공휴일이 있는 날짜에는 이름을 함께 보여준다', async () => {
    const repo = new FakeRepository()
    repo.events.push({
      id: 'a',
      title: '연휴 일정',
      allDay: true,
      start: '2026-09-25',
      end: '2026-09-25',
    })
    renderAgenda(repo)
    await flushLoad()

    expect(screen.getByText('추석')).toBeInTheDocument()
  })

  it('일정을 클릭하면 onSelectEvent가 호출된다', async () => {
    const repo = new FakeRepository()
    repo.events.push({
      id: 'a',
      title: '점심 약속',
      allDay: false,
      start: '2026-09-10T12:00',
      end: '2026-09-10T13:00',
    })
    const onSelectEvent = vi.fn()
    renderAgenda(repo, { onSelectEvent })
    await flushLoad()

    fireEvent.click(screen.getByText('점심 약속'))
    expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ id: 'a' }) }))
  })

  describe('19단계: 함께 일정 표시', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('내가 응답 대기 중인 함께 일정은 "대기" 배지와 점선 행으로 표시된다', () => {
      const event: CalendarEvent = {
        id: 'e1',
        title: '저녁 약속',
        ownerId: 'partner-1',
        allDay: true,
        start: '2026-09-18',
        end: '2026-09-18',
        participants: [{ userId: 'me', email: 'me@example.com', status: 'pending' }],
      }
      vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
        currentDate: new Date(2026, 8, 15),
        shownEvents: [event],
        categories: [],
        currentUserId: 'me',
        sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }],
      } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)

      render(<AgendaView />)

      expect(screen.getByText('대기')).toBeInTheDocument()
      expect(screen.getByText('저녁 약속').closest('button')?.className).toContain(styles.eventRowPending)
    })

    it('내가 수락한 함께 일정은 "함께" 배지로 표시되고 점선 행이 아니다', () => {
      const event: CalendarEvent = {
        id: 'e1',
        title: '저녁 약속',
        ownerId: 'partner-1',
        allDay: true,
        start: '2026-09-18',
        end: '2026-09-18',
        participants: [{ userId: 'me', email: 'me@example.com', status: 'accepted' }],
      }
      vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
        currentDate: new Date(2026, 8, 15),
        shownEvents: [event],
        categories: [],
        currentUserId: 'me',
        sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }],
      } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)

      render(<AgendaView />)

      expect(screen.getByText('함께')).toBeInTheDocument()
      expect(screen.getByText('저녁 약속').closest('button')?.className).not.toContain(styles.eventRowPending)
    })
  })

  // 26단계: 창을 켜 둔 채 자정이 지나면 "오늘" 칩이 다음 날로 옮겨 간다(렌더 시점에만 읽던 오늘 날짜가 어제 기준으로 남던 것)
  it('자정이 지나면 오늘 칩이 다음 날로 옮겨 간다', async () => {
    vi.setSystemTime(new Date(2026, 8, 25, 23, 59, 30))
    const repo = new FakeRepository()
    repo.events.push(
      { id: 'a', title: '25일 일정', allDay: true, start: '2026-09-25', end: '2026-09-25' },
      { id: 'b', title: '26일 일정', allDay: true, start: '2026-09-26', end: '2026-09-26' },
    )
    const { container } = renderAgenda(repo)
    await flushLoad()
    const todayChipDay = () => container.querySelector('[class*=todayChip]')?.closest('section')?.getAttribute('data-day')
    expect(todayChipDay()).toBe('2026-09-25')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000) // 00:00:30 — useTodayKey의 1분 확인
    })
    expect(todayChipDay()).toBe('2026-09-26')
  })
})
