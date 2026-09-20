// TimeGridView: 헤더, 종일 줄, 시간대 겹침 배치, 클릭으로 생성/수정을 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as useCalendarModule from '../state/useCalendar'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import { stubMobileViewport } from '../test/mobile'
import type { CalendarEvent } from '../types'
import TimeGridView from './TimeGridView'
import styles from './TimeGridView.module.css'

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

  describe('20.10: 모바일 주 보기 블록', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('모바일에서 여러 날을 보여줄 때만 narrow(제목 줄바꿈) 모드가 켜진다', async () => {
      stubMobileViewport()
      const { container } = renderGrid(new FakeRepository())
      await flushLoad()
      expect((container.firstChild as HTMLElement).className).toContain('narrow')
    })

    it('모바일이라도 하루만 보여주는 일 보기는 narrow가 아니다', async () => {
      stubMobileViewport()
      const { container } = renderGrid(new FakeRepository(), { days: [new Date(2026, 8, 15)] })
      await flushLoad()
      expect((container.firstChild as HTMLElement).className).not.toContain('narrow')
    })

    it('모바일 7일에서 겹치는 일정은 폭을 쪼개지 않고 계단식으로 겹친다(24px 폭으로 글자가 깨지던 문제)', async () => {
      stubMobileViewport()
      const repo = new FakeRepository()
      repo.events.push(
        { id: 'a', title: '일정A', allDay: false, start: '2026-09-14T09:00', end: '2026-09-14T10:00' },
        { id: 'b', title: '일정B', allDay: false, start: '2026-09-14T09:30', end: '2026-09-14T10:30' },
      )
      renderGrid(repo)
      await flushLoad()
      const blockA = screen.getByText(/일정A/).closest('span')!
      const blockB = screen.getByText(/일정B/).closest('span')!
      expect(blockA.style.width).toBe('100%')
      expect(blockB.style.left).toBe('22%')
      expect(blockB.style.width).toBe('78%')
      expect(Number(blockB.style.zIndex)).toBeGreaterThan(Number(blockA.style.zIndex))
    })

    it('겹침이 5개 이상이어도 계단식 폭이 음수가 되지 않는다', async () => {
      stubMobileViewport()
      const repo = new FakeRepository()
      for (let i = 0; i < 6; i++) {
        repo.events.push({ id: `e${i}`, title: `겹침${i}`, allDay: false, start: `2026-09-14T09:00`, end: `2026-09-14T1${i}:30` })
      }
      renderGrid(repo)
      await flushLoad()
      for (let i = 0; i < 6; i++) {
        const width = parseFloat(screen.getByText(new RegExp(`겹침${i}`)).closest('span')!.style.width)
        expect(width).toBeGreaterThanOrEqual(30)
      }
    })

    it('데스크톱에서는 narrow가 아니다', async () => {
      const { container } = renderGrid(new FakeRepository())
      await flushLoad()
      expect((container.firstChild as HTMLElement).className).not.toContain('narrow')
    })
  })

  describe('20.2: 현재 시각에서 시작 + 현재 시각 선', () => {
    it('오늘 칸에 현재 시각 선을 지금 위치에 그린다', async () => {
      vi.setSystemTime(new Date(2026, 8, 15, 10, 30))
      renderGrid(new FakeRepository())
      await flushLoad()
      expect(screen.getByLabelText('현재 시각')).toHaveStyle({ top: '504px' })
    })

    it('오늘이 포함되면 지금 시각 한 시간 전으로, 아니면 8시로 스크롤해 연다', async () => {
      const scrollSetter = vi.spyOn(HTMLElement.prototype, 'scrollTop', 'set')
      vi.setSystemTime(new Date(2026, 8, 15, 14, 0))
      const { unmount } = renderGrid(new FakeRepository())
      await flushLoad()
      expect(scrollSetter).toHaveBeenCalledWith(13 * 48 - 8)
      unmount()

      scrollSetter.mockClear()
      render(
        <CalendarProvider repository={new FakeRepository()}>
          <TimeGridView days={[new Date(2026, 9, 1)]} />
        </CalendarProvider>,
      )
      await flushLoad()
      expect(scrollSetter).toHaveBeenCalledWith(8 * 48 - 8)
      expect(screen.queryByLabelText('현재 시각')).not.toBeInTheDocument()
      scrollSetter.mockRestore()
    })
  })

  describe('19단계: 함께 일정 표시', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('내가 응답 대기 중인 함께 일정(시간대)은 "대기" 배지와 점선으로 표시된다', async () => {
      const event: CalendarEvent = {
        id: 'e1',
        title: '저녁 약속',
        ownerId: 'partner-1',
        allDay: false,
        start: '2026-09-14T19:00',
        end: '2026-09-14T21:00',
        participants: [{ userId: 'me', email: 'me@example.com', status: 'pending' }],
      }
      vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
        selectedDate: new Date(2026, 8, 15),
        shownEvents: [event],
        categories: [],
        currentUserId: 'me',
        sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }],
        setSelectedDate: vi.fn(),
      } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)

      render(<TimeGridView days={DAYS} />)

      expect(screen.getByText('대기')).toBeInTheDocument()
      expect(screen.getByText(/저녁 약속/).closest('span')?.className).toContain(styles.chipPending)
    })

    it('내가 수락한 함께 일정(시간대)은 "함께" 배지로 표시되고 점선이 아니다', async () => {
      const event: CalendarEvent = {
        id: 'e1',
        title: '저녁 약속',
        ownerId: 'partner-1',
        allDay: false,
        start: '2026-09-14T19:00',
        end: '2026-09-14T21:00',
        participants: [{ userId: 'me', email: 'me@example.com', status: 'accepted' }],
      }
      vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
        selectedDate: new Date(2026, 8, 15),
        shownEvents: [event],
        categories: [],
        currentUserId: 'me',
        sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }],
        setSelectedDate: vi.fn(),
      } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)

      render(<TimeGridView days={DAYS} />)

      expect(screen.getByText('함께')).toBeInTheDocument()
      expect(screen.getByText(/저녁 약속/).closest('span')?.className).not.toContain(styles.chipPending)
    })
  })
})
