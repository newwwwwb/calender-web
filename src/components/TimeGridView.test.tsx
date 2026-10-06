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
  // 가짜 타이머에 예약된 motion 프레임을 비우고 돌아가야 다음 테스트에서 프레임 루프가 멈추지 않는다(24.10)
  vi.runOnlyPendingTimers()
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
    // whileTap이 자동으로 붙이는 tabIndex=0을 막아 Tab 순서에 들어가지 않게 한다(1차 보스 리뷰)
    // 종일 칩·시간 블록은 키보드로 열 수 있는 진짜 버튼이다(예전엔 tabIndex -1 span)
    expect(screen.getByText('종일 일정').closest('button')).not.toHaveAttribute('tabindex', '-1')
    expect(screen.getByText(/회의/).closest('button')).not.toHaveAttribute('tabindex', '-1')
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

    const blockA = screen.getByText(/일정A/).closest('button')!
    const blockB = screen.getByText(/일정B/).closest('button')!
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
      const blockA = screen.getByText(/일정A/).closest('button')!
      const blockB = screen.getByText(/일정B/).closest('button')!
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
        const width = parseFloat(screen.getByText(new RegExp(`겹침${i}`)).closest('button')!.style.width)
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

  describe('시간칸 키보드 조작(roving tabindex)', () => {
    const cellOf = (col: number, hour: number) => document.querySelector<HTMLElement>(`[data-col="${col}"][data-hour="${hour}"]`)!
    const tabStops = () => Array.from(document.querySelectorAll<HTMLElement>('[data-hour]')).filter((c) => c.tabIndex === 0)

    // 오늘(9/15, 마지막 열) 10:30 — 처음 탭 정지는 (2, 10)
    async function renderAt10(props: Partial<Parameters<typeof TimeGridView>[0]> = {}) {
      vi.setSystemTime(new Date(2026, 8, 15, 10, 30))
      renderGrid(new FakeRepository(), props)
      await flushLoad()
    }

    it('격자 전체에서 탭 정지는 하나뿐이고, 처음엔 선택한 날(오늘)의 현재 시각 칸이다', async () => {
      await renderAt10()
      expect(document.querySelectorAll('[data-hour]')).toHaveLength(72)
      expect(tabStops()).toEqual([cellOf(2, 10)])
    })

    it('오늘이 아니면 9시 칸이 탭 정지다', async () => {
      render(
        <CalendarProvider repository={new FakeRepository()}>
          <TimeGridView days={[new Date(2026, 9, 1)]} />
        </CalendarProvider>,
      )
      await flushLoad()
      expect(tabStops()).toEqual([cellOf(0, 9)])
    })

    it('칸마다 날짜·시각이 든 aria-label과 button 역할이 있다', async () => {
      await renderAt10()
      expect(cellOf(2, 15)).toHaveAttribute('aria-label', '9월 15일 화요일 오후 3시, 새 일정')
      expect(cellOf(0, 0)).toHaveAttribute('aria-label', '9월 13일 일요일 오전 12시, 새 일정')
      expect(cellOf(1, 12)).toHaveAttribute('aria-label', '9월 14일 월요일 오후 12시, 새 일정')
      expect(screen.getByRole('button', { name: '9월 15일 화요일 오전 10시, 새 일정' })).toBe(cellOf(2, 10))
    })

    it('화살표로 이웃 칸에 포커스가 옮겨가고 탭 정지도 따라간다', async () => {
      await renderAt10()
      cellOf(2, 10).focus()

      expect(fireEvent.keyDown(cellOf(2, 10), { key: 'ArrowLeft' })).toBe(false) // preventDefault = 스크롤 안 함
      expect(document.activeElement).toBe(cellOf(1, 10))
      fireEvent.keyDown(cellOf(1, 10), { key: 'ArrowDown' })
      expect(document.activeElement).toBe(cellOf(1, 11))
      fireEvent.keyDown(cellOf(1, 11), { key: 'ArrowRight' })
      expect(document.activeElement).toBe(cellOf(2, 11))
      fireEvent.keyDown(cellOf(2, 11), { key: 'ArrowUp' })
      expect(document.activeElement).toBe(cellOf(2, 10))
      fireEvent.keyDown(cellOf(2, 10), { key: 'ArrowLeft' })
      expect(tabStops()).toEqual([cellOf(1, 10)])
    })

    it('Home/End는 그 날의 0시/23시로 간다', async () => {
      await renderAt10()
      cellOf(2, 10).focus()
      fireEvent.keyDown(cellOf(2, 10), { key: 'Home' })
      expect(document.activeElement).toBe(cellOf(2, 0))
      fireEvent.keyDown(cellOf(2, 0), { key: 'End' })
      expect(document.activeElement).toBe(cellOf(2, 23))
      expect(tabStops()).toEqual([cellOf(2, 23)])
    })

    it('경계(첫·끝 날, 0·23시)에서 멈추되 스크롤은 막는다', async () => {
      await renderAt10()
      cellOf(2, 0).focus()
      expect(fireEvent.keyDown(cellOf(2, 0), { key: 'ArrowRight' })).toBe(false)
      expect(document.activeElement).toBe(cellOf(2, 0))
      fireEvent.keyDown(cellOf(2, 0), { key: 'ArrowUp' })
      expect(document.activeElement).toBe(cellOf(2, 0))

      cellOf(0, 23).focus()
      fireEvent.keyDown(cellOf(0, 23), { key: 'ArrowLeft' })
      fireEvent.keyDown(cellOf(0, 23), { key: 'ArrowDown' })
      expect(document.activeElement).toBe(cellOf(0, 23))
    })

    it('Enter와 Space는 그 칸의 날짜·시각으로 onCreateEvent를 부른다', async () => {
      const onCreateEvent = vi.fn()
      await renderAt10({ onCreateEvent })
      cellOf(1, 14).focus()
      expect(fireEvent.keyDown(cellOf(1, 14), { key: 'Enter' })).toBe(false)
      expect(fireEvent.keyDown(cellOf(1, 14), { key: ' ' })).toBe(false) // Space가 페이지를 내리지 않게
      expect(onCreateEvent).toHaveBeenCalledTimes(2)
      for (const [date, hour] of onCreateEvent.mock.calls) {
        expect(date.getDate()).toBe(14)
        expect(hour).toBe(14)
      }
    })

    it('칸 안의 화살표 키는 window 전역 단축키(←/→ 기간 이동)로 새어 나가지 않는다', async () => {
      await renderAt10()
      const onWindowKey = vi.fn()
      window.addEventListener('keydown', onWindowKey)
      fireEvent.keyDown(cellOf(2, 10), { key: 'ArrowLeft' })
      fireEvent.keyDown(cellOf(1, 10), { key: 'ArrowRight' })
      window.removeEventListener('keydown', onWindowKey)
      expect(onWindowKey).not.toHaveBeenCalled()
    })

    it('Tab·수정키 조합은 가로채지 않는다', async () => {
      const onCreateEvent = vi.fn()
      await renderAt10({ onCreateEvent })
      expect(fireEvent.keyDown(cellOf(2, 10), { key: 'Tab' })).toBe(true)
      expect(fireEvent.keyDown(cellOf(2, 10), { key: 'ArrowLeft', ctrlKey: true })).toBe(true)
      expect(fireEvent.keyDown(cellOf(2, 10), { key: 'Enter', metaKey: true })).toBe(true)
      expect(onCreateEvent).not.toHaveBeenCalled()
    })

    it('마우스 클릭은 그대로 동작한다', async () => {
      const onCreateEvent = vi.fn()
      await renderAt10({ onCreateEvent })
      fireEvent.click(cellOf(0, 5))
      expect(onCreateEvent).toHaveBeenCalledWith(expect.any(Date), 5)
    })
  })

  describe('위로 가려진 이른 일정 버튼', () => {
    const scrollArea = () => document.querySelector<HTMLElement>('[class*="scrollArea"]')!
    const earlierButton = () => screen.queryByRole('button', { name: /이른 일정/ })

    function scrollTo(top: number) {
      Object.defineProperty(scrollArea(), 'scrollTop', { configurable: true, value: top })
      fireEvent.scroll(scrollArea())
    }

    async function renderWithEvents() {
      const repo = new FakeRepository()
      repo.events.push(
        { id: 'a', title: '새벽', allDay: false, start: '2026-09-13T03:00', end: '2026-09-13T04:00' }, // 144~192px
        { id: 'b', title: '요가', allDay: false, start: '2026-09-14T07:00', end: '2026-09-14T08:00' }, // 336~384px
        { id: 'c', title: '회의', allDay: false, start: '2026-09-15T10:00', end: '2026-09-15T11:00' }, // 480~528px
        { id: 'd', title: '종일', allDay: true, start: '2026-09-14', end: '2026-09-14' }, // 종일은 대상이 아니다
      )
      renderGrid(repo)
      await flushLoad()
    }

    it('맨 위에서는 보이지 않는다', async () => {
      await renderWithEvents()
      expect(earlierButton()).not.toBeInTheDocument()
    })

    it('스크롤 위쪽에 완전히 가려진 시간 일정 수를 보여주고, 종일 일정은 세지 않는다', async () => {
      await renderWithEvents()
      scrollTo(400)
      expect(earlierButton()).toHaveTextContent('↑ 이른 일정 2개')
      scrollTo(200)
      expect(earlierButton()).toHaveTextContent('↑ 이른 일정 1개')
    })

    it('일부라도 보이는 일정은 가려진 것으로 세지 않고, 모두 보이면 사라진다', async () => {
      await renderWithEvents()
      scrollTo(370) // 요가(336~384)가 걸쳐 보인다 → 새벽만 가려짐
      expect(earlierButton()).toHaveTextContent('이른 일정 1개')
      scrollTo(100)
      expect(earlierButton()).not.toBeInTheDocument()
    })

    it('마운트 때 이미 스크롤돼 있으면 처음부터 보인다', async () => {
      const getter = vi.spyOn(Element.prototype, 'scrollTop', 'get').mockReturnValue(400)
      await renderWithEvents()
      expect(earlierButton()).toHaveTextContent('이른 일정 2개')
      getter.mockRestore()
    })

    it('누르면 가려진 일정 중 가장 이른 일정이 보이도록 부드럽게 스크롤한다', async () => {
      await renderWithEvents()
      const scrollToMock = vi.fn()
      Object.assign(scrollArea(), { scrollTo: scrollToMock })
      scrollTo(400)
      fireEvent.click(earlierButton()!)
      expect(scrollToMock).toHaveBeenCalledWith({ top: 144 - 8, behavior: 'smooth' })
    })

    it('동작 줄이기에서는 즉시 스크롤한다', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }))
      await renderWithEvents()
      const scrollToMock = vi.fn()
      Object.assign(scrollArea(), { scrollTo: scrollToMock })
      scrollTo(400)
      fireEvent.click(earlierButton()!)
      expect(scrollToMock).toHaveBeenCalledWith({ top: 136, behavior: 'auto' })
      vi.unstubAllGlobals()
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
      expect(screen.getByText(/저녁 약속/).closest('button')?.className).toContain(styles.chipPending)
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
      expect(screen.getByText(/저녁 약속/).closest('button')?.className).not.toContain(styles.chipPending)
    })
  })
})
