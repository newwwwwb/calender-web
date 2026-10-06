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
  // 가짜 타이머에 예약된 motion 프레임을 비우고 돌아가야 다음 테스트에서 프레임 루프가 멈추지 않는다(24.10)
  vi.runOnlyPendingTimers()
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

  it('대체공휴일은 원래 공휴일과 구분되게 "대체"를 붙여 표시한다', async () => {
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <MonthView />
      </CalendarProvider>,
    )
    await flushLoad()
    // 그리드에 2026-10-03(개천절)과 10-05(대체공휴일)가 함께 보인다
    expect(screen.getByText('개천절')).toBeInTheDocument()
    expect(screen.getByText('개천절 대체')).toBeInTheDocument()
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
    // whileTap이 자동으로 붙이는 tabIndex=0을 막아 Tab 순서에 들어가지 않게 한다(1차 보스 리뷰)
    // 칩은 키보드로 열 수 있는 진짜 버튼이다(예전엔 tabIndex -1 span이라 키보드로는 기존 일정을 열 수 없었다)
    const chip = screen.getByText('팀 회의').closest('button')!
    expect(chip).toBeInTheDocument()
    expect(chip).not.toHaveAttribute('tabindex', '-1')
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
    const dayButton = screen.getByText('20').closest('button')!
    fireEvent.click(dayButton)
    // 선택 표시는 날짜 버튼이 아니라 그것을 감싼 칸(div)에 붙는다
    expect(dayButton.parentElement!.className).toContain(styles.cellSelected)
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
      expect(screen.getByText('저녁 약속').closest('button')?.className).toContain(styles.chipPending)
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
      expect(screen.getByText('저녁 약속').closest('button')?.className).not.toContain(styles.chipPending)
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
      fireEvent.click(screen.getByLabelText(/^9월 20일 /))
      expect(screen.getByTestId('view')).toHaveTextContent('month')
      // 선택은 aria-pressed, aria-current="date"는 오늘에만(예전엔 선택에 current를 써서 스크린리더가 20일을 "오늘"로 읽었다)
      expect(screen.getByLabelText(/^9월 20일 /)).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByLabelText(/^9월 20일 /)).not.toHaveAttribute('aria-current')
      expect(screen.getByLabelText(/^9월 15일 /)).toHaveAttribute('aria-current', 'date')
    })

    it('칸에는 일정 제목이 없고, 선택한 날의 일정만 아래 목록에 시간순으로 보인다', async () => {
      renderMobile(repoWithEvents())
      await flushLoad()
      expect(screen.queryByText('팀 회의')).not.toBeInTheDocument()

      fireEvent.click(screen.getByLabelText(/^9월 20일 /))
      // 점은 3개까지만이지만 목록에는 그날 일정이 전부, 시간순으로 나온다
      const rows = screen.getAllByText(/^(팀 회의|점심 약속|운동|스터디)$/).map((el) => el.textContent)
      expect(rows).toEqual(['팀 회의', '점심 약속', '운동', '스터디'])
      expect(screen.queryByText('여행')).not.toBeInTheDocument() // 다른 날 일정은 안 나온다

      fireEvent.click(screen.getByLabelText(/^9월 21일 /))
      expect(screen.getByText('여행')).toBeInTheDocument()
      expect(screen.getByText('종일')).toBeInTheDocument()
    })

    it('일정이 없는 날은 "일정이 없어요."를 보여준다', async () => {
      renderMobile(new FakeRepository())
      await flushLoad()
      fireEvent.click(screen.getByLabelText(/^9월 22일 /))
      expect(screen.getByText('일정이 없어요.')).toBeInTheDocument()
    })

    it('목록의 일정을 누르면 onSelectEvent가 호출된다', async () => {
      const onSelectEvent = renderMobile(repoWithEvents())
      await flushLoad()
      fireEvent.click(screen.getByLabelText(/^9월 20일 /))
      fireEvent.click(screen.getByText('점심 약속'))
      expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ id: 'b' }) }))
    })

    it('칸의 색 점은 최대 3개다', async () => {
      renderMobile(repoWithEvents())
      await flushLoad()
      const cell = screen.getByLabelText(/^9월 20일 /)
      expect(cell.querySelectorAll('[class*="dot"]:not([class*="dots"])')).toHaveLength(3)
    })

    it('오늘은 파란 글자, 선택한 날만 채운 원이다(오늘을 선택하면 파란 채움)', async () => {
      renderMobile(new FakeRepository())
      await flushLoad()
      // 숫자 앞에 선택됐을 때만 채운 원(motion.span)이 하나 더 들어온다 — 원은 layoutId로 미끄러지는 별도 레이어
      // key는 'YYYY-MM-DD' — 날짜 버튼의 이름은 "9월 20일 일요일…"이라 월·일로 찾는다
      const wrapOf = (key: string) => {
        const [, mo, d] = key.split('-')
        return screen.getByLabelText(new RegExp(`^${Number(mo)}월 ${Number(d)}일 `)).firstElementChild as HTMLElement
      }
      const circleOf = (key: string) => (wrapOf(key).children.length === 2 ? wrapOf(key).children[0] : null)
      const textOf = (key: string) => wrapOf(key).children[wrapOf(key).children.length - 1] as HTMLElement

      // 처음엔 오늘이 곧 선택일이라 파란 채움
      expect(circleOf('2026-09-15')?.className).toContain(styles.selectedCircleToday)
      // 오늘이 선택되면 강조색 원 위 글자 클래스(다크에서 선택 원 위 글자와 색이 달라서 나눔)
      expect(textOf('2026-09-15').className).toContain(styles.dayNumberSelectedTodayText)

      // 다른 날을 선택하면: 선택일은 어두운 채움, 오늘은 파란 글자로 물러난다(원이 없어진다)
      fireEvent.click(screen.getByLabelText(/^9월 20일 /))
      expect(circleOf('2026-09-20')?.className).toContain(styles.selectedCircle)
      expect(circleOf('2026-09-15')).toBeNull()
      expect(textOf('2026-09-15').className).toContain(styles.dayNumberTodayText)
    })

    it('2026-02처럼 일요일에 시작하는 28일짜리 달은 4주만 그린다(5주째도 통째로 다음 달)', async () => {
      vi.setSystemTime(new Date(2026, 1, 10))
      renderMobile(new FakeRepository())
      await flushLoad()
      expect(screen.getByLabelText(/^2월 28일 /)).toBeInTheDocument()
      expect(screen.queryByLabelText(/^3월 1일 /)).not.toBeInTheDocument()
    })

    it('마지막 주가 통째로 다음 달이면 그 주는 그리지 않는다(2026-09: 5주)', async () => {
      renderMobile(new FakeRepository())
      await flushLoad()
      expect(screen.getByLabelText(/^10월 3일 /)).toBeInTheDocument() // 5주째 안의 다음 달 날짜는 남는다
      expect(screen.queryByLabelText(/^10월 4일 /)).not.toBeInTheDocument() // 6주째(10/4~10/10)는 통째로 뺀다
    })
  })

  // 회귀(25단계 4차 심사): 겹치는 여러 날 종일 일정의 막대가 칸마다 다른 줄에 떠서 끊겨 보였다.
  it('겹치는 여러 날 종일 일정은 걸친 모든 칸에서 같은 줄에 그려진다(끝난 일정 자리는 빈 자리로 유지)', async () => {
    const repo = new FakeRepository()
    const allDay = (id: string, title: string, start: string, end: string): CalendarEvent => ({ id, title, allDay: true, start, end })
    // 2026-09 월 보기: 출장 9/14~15, 휴가 9/15~17(출장과 하루 겹침)
    repo.events.push(allDay('a', '출장', '2026-09-14', '2026-09-15'), allDay('b', '휴가', '2026-09-15', '2026-09-17'))
    const { container } = render(
      <CalendarProvider repository={repo}>
        <MonthView />
      </CalendarProvider>,
    )
    await flushLoad()

    // 칸(날짜 버튼의 부모)의 자식 중 칩·빈 자리만 순서대로 읽는다: 칩은 제목, 빈 자리는 '·'
    function rowsOf(day: number): string[] {
      const button = container.querySelector(`button[aria-label^="9월 ${day}일 "]`) as HTMLElement
      return [...(button.parentElement as HTMLElement).children]
        .filter((el) => el !== button && el.tagName !== 'BUTTON' ? el.className.includes('chipSpacer') : el !== button && el.className.includes('chip'))
        .map((el) => (el.className.includes('chipSpacer') ? '·' : (el.textContent ?? '').trim()))
    }

    expect(rowsOf(14)).toEqual(['출장'])
    expect(rowsOf(15)).toEqual(['출장', '휴가']) // 겹치는 날: 출장 윗줄, 휴가 아랫줄
    expect(rowsOf(16)).toEqual(['·', '휴가']) // 출장이 끝나도 휴가는 같은 아랫줄 — 윗줄로 올라가면 막대가 끊겨 보인다
    expect(rowsOf(17)).toEqual(['·', '휴가'])
  })
})
