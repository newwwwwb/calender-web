// Header: 보기 전환, 보기별 이전/다음 이동, 오늘 버튼, 타이틀 표시를 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as useCalendarModule from '../state/useCalendar'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import Header from './Header'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15)) // 오늘 = 2026-09-15
})

afterEach(() => {
  vi.useRealTimers()
})

function renderHeader() {
  return render(
    <CalendarProvider repository={new FakeRepository()}>
      <Header />
    </CalendarProvider>,
  )
}

describe('Header - 월 보기 (기본값)', () => {
  it('현재 달 제목을 보여준다', () => {
    renderHeader()
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
  })

  it('다음/이전 버튼으로 달을 이동한다', () => {
    renderHeader()
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('이전'))
    fireEvent.click(screen.getByLabelText('이전'))
    expect(screen.getByText('2026년 8월')).toBeInTheDocument()
  })

  it('오늘 버튼을 누르면 현재 달로 돌아온다', () => {
    renderHeader()
    fireEvent.click(screen.getByLabelText('다음'))
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('2026년 11월')).toBeInTheDocument()
    fireEvent.click(screen.getByText('오늘'))
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
  })
})

describe('Header - 보기 전환', () => {
  it('주 보기로 바꾸면 주간 타이틀을 보여주고, 다음/이전은 1주 단위로 이동한다', () => {
    renderHeader()
    fireEvent.click(screen.getByText('주'))
    expect(screen.getByText('2026년 9월 13일 - 19일')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('2026년 9월 20일 - 26일')).toBeInTheDocument()
  })

  it('일 보기로 바꾸면 일간 타이틀을 보여주고, 다음/이전은 하루 단위로 이동한다', () => {
    renderHeader()
    fireEvent.click(screen.getByText('일'))
    expect(screen.getByText('2026년 9월 15일 (화)')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('2026년 9월 16일 (수)')).toBeInTheDocument()
  })

  it('목록 보기는 월 타이틀을 그대로 쓴다', () => {
    renderHeader()
    fireEvent.click(screen.getByText('목록'))
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
  })
})

describe('Header - 모바일 할 일 버튼', () => {
  it('클릭하면 onOpenTodos를 호출한다', () => {
    const onOpenTodos = vi.fn()
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <Header onOpenTodos={onOpenTodos} />
      </CalendarProvider>,
    )
    fireEvent.click(screen.getByLabelText('할 일'))
    expect(onOpenTodos).toHaveBeenCalled()
  })
})

describe('Header - 설정 버튼', () => {
  it('클릭하면 onOpenSettings를 호출한다', () => {
    const onOpenSettings = vi.fn()
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <Header onOpenSettings={onOpenSettings} />
      </CalendarProvider>,
    )
    fireEvent.click(screen.getByLabelText('설정'))
    expect(onOpenSettings).toHaveBeenCalled()
  })
})

describe('Header - 19단계: 알림 종', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('로그아웃 상태면 알림 종이 안 보인다', () => {
    renderHeader()
    expect(screen.queryByLabelText('알림')).not.toBeInTheDocument()
  })

  it('로그인 상태면 알림 종이 보이고, 안 읽은 알림 수를 배지로 보여준다', () => {
    vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
      currentDate: new Date(2026, 8, 15),
      view: 'month',
      currentUserId: 'me',
      setCurrentDate: vi.fn(),
      setSelectedDate: vi.fn(),
      changeView: vi.fn(),
    } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)

    const onOpenNotifications = vi.fn()
    render(<Header onOpenNotifications={onOpenNotifications} unreadCount={3} />)

    expect(screen.getByText('3')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('알림'))
    expect(onOpenNotifications).toHaveBeenCalled()
  })
})
