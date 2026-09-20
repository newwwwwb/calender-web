// MonthView: 그리드 렌더링, 오늘/선택일 표시, 이벤트 칩, 공휴일 표시, 날짜 선택을 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as useCalendarModule from '../state/useCalendar'
import { CalendarProvider, useCalendar } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import { stubMobileViewport } from '../test/mobile'
import type { CalendarEvent } from '../types'
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

  it('그리드 마지막 날짜(2026-10-10)의 시간대 일정도 칩으로 표시된다', async () => {
    // 회귀 테스트: expandEventsInRange에 grid[41](자정)을 그대로 넘기면 그날 09:00 시작 일정이
    // 범위(start<=rangeEnd) 밖으로 밀려 안 보이던 버그(보스 리뷰에서 발견)
    const repo = new FakeRepository()
    repo.events.push({
      id: 'e2',
      title: '마지막날 회의',
      allDay: false,
      start: '2026-10-10T09:00',
      end: '2026-10-10T10:00',
    })
    render(
      <CalendarProvider repository={repo}>
        <MonthView />
      </CalendarProvider>,
    )
    await flushLoad()
    expect(screen.getByText('마지막날 회의')).toBeInTheDocument()
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

  it('날짜를 클릭하면 그날의 일 보기로 전환된다', async () => {
    function ViewProbe() {
      const { view } = useCalendar()
      return <span data-testid="view">{view}</span>
    }
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <MonthView />
        <ViewProbe />
      </CalendarProvider>,
    )
    await flushLoad()
    fireEvent.click(screen.getByText('20').closest('button')!)
    expect(screen.getByTestId('view')).toHaveTextContent('day')
  })

  describe('19단계: 함께 일정 표시', () => {
    function mockCalendar(event: CalendarEvent) {
      vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
        currentDate: new Date(2026, 8, 15),
        selectedDate: new Date(2026, 8, 15),
        shownEvents: [event],
        categories: [],
        currentUserId: 'me',
        sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }],
        setSelectedDate: vi.fn(),
        setCurrentDate: vi.fn(),
        setView: vi.fn(),
      } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    }

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('내가 응답 대기 중인 함께 일정은 점선 칩 + 참여자 점으로 표시된다(제목 공간을 지키려고 텍스트 배지는 안 씀)', () => {
      mockCalendar({
        id: 'e1',
        title: '저녁 약속',
        ownerId: 'partner-1',
        allDay: true,
        start: '2026-09-15',
        end: '2026-09-15',
        participants: [{ userId: 'me', email: 'me@example.com', status: 'pending' }],
      })
      render(<MonthView />)

      expect(screen.getByTitle('함께하는 일정 · 응답 대기')).toBeInTheDocument()
      expect(screen.queryByText('대기')).not.toBeInTheDocument()
      expect(screen.getByText('저녁 약속')).toBeInTheDocument()
      expect(screen.getByText('저녁 약속').closest('span')?.className).toContain(styles.chipPending)
    })

    it('내가 수락한 함께 일정은 참여자 점으로 표시된다(텍스트 배지 없이도 제목이 온전히 보임)', () => {
      mockCalendar({
        id: 'e1',
        title: '저녁 약속',
        ownerId: 'partner-1',
        allDay: true,
        start: '2026-09-15',
        end: '2026-09-15',
        participants: [{ userId: 'me', email: 'me@example.com', status: 'accepted' }],
      })
      render(<MonthView />)

      expect(screen.getByTitle('함께하는 일정')).toBeInTheDocument()
      expect(screen.getByText('저녁 약속')).toBeInTheDocument()
      expect(screen.getByText('저녁 약속').closest('span')?.className).not.toContain(styles.chipPending)
    })
  })

  describe('20.9: 모바일 월 보기 (점 + 선택일 목록)', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    function renderMobile(repo: FakeRepository, onSelectEvent = vi.fn()) {
      stubMobileViewport()
      function ViewProbe() {
        const { view } = useCalendar()
        return <span data-testid="view">{view}</span>
      }
      render(
        <CalendarProvider repository={repo}>
          <MonthView onSelectEvent={onSelectEvent} />
          <ViewProbe />
        </CalendarProvider>,
      )
      return onSelectEvent
    }

    function repoWithEvents() {
      const repo = new FakeRepository()
      repo.events.push(
        { id: 'a', title: '팀 회의', allDay: false, start: '2026-09-20T10:00', end: '2026-09-20T11:00' },
        { id: 'b', title: '점심 약속', allDay: false, start: '2026-09-20T12:00', end: '2026-09-20T13:00' },
        { id: 'c', title: '운동', allDay: false, start: '2026-09-20T19:00', end: '2026-09-20T19:30' },
        { id: 'd', title: '스터디', allDay: false, start: '2026-09-20T20:00', end: '2026-09-20T21:00' },
        { id: 'e', title: '여행', allDay: true, start: '2026-09-21', end: '2026-09-21' },
      )
      return repo
    }

    it('날짜를 눌러도 일 보기로 넘어가지 않고 제자리에서 선택한다', async () => {
      renderMobile(new FakeRepository())
      await flushLoad()
      fireEvent.click(screen.getByLabelText('2026-09-20'))
      expect(screen.getByTestId('view')).toHaveTextContent('month')
      expect(screen.getByLabelText('2026-09-20')).toHaveAttribute('aria-current', 'date')
    })

    it('칸에는 일정 제목이 없고, 선택한 날의 일정만 아래 목록에 시간순으로 보인다', async () => {
      renderMobile(repoWithEvents())
      await flushLoad()
      expect(screen.queryByText('팀 회의')).not.toBeInTheDocument()

      fireEvent.click(screen.getByLabelText('2026-09-20'))
      const titles = ['팀 회의', '점심 약속', '운동', '스터디'].map((t) => screen.getByText(t))
      expect(titles).toHaveLength(4) // 점은 3개까지만이지만 목록에는 그날 일정이 전부 나온다
      expect(screen.queryByText('여행')).not.toBeInTheDocument() // 다른 날 일정은 안 나온다

      fireEvent.click(screen.getByLabelText('2026-09-21'))
      expect(screen.getByText('여행')).toBeInTheDocument()
      expect(screen.getByText('종일')).toBeInTheDocument()
    })

    it('일정이 없는 날은 "일정 없음"을 보여준다', async () => {
      renderMobile(new FakeRepository())
      await flushLoad()
      fireEvent.click(screen.getByLabelText('2026-09-22'))
      expect(screen.getByText('일정 없음')).toBeInTheDocument()
    })

    it('목록의 일정을 누르면 onSelectEvent가 호출된다', async () => {
      const onSelectEvent = renderMobile(repoWithEvents())
      await flushLoad()
      fireEvent.click(screen.getByLabelText('2026-09-20'))
      fireEvent.click(screen.getByText('점심 약속'))
      expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ id: 'b' }) }))
    })

    it('칸의 색 점은 최대 3개다', async () => {
      renderMobile(repoWithEvents())
      await flushLoad()
      const cell = screen.getByLabelText('2026-09-20')
      expect(cell.querySelectorAll('[class*="dot"]:not([class*="dots"])')).toHaveLength(3)
    })
  })
})
