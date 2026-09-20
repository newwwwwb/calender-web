// useCalendar Context: 로드, CRUD 후 재로드, Provider 밖 사용 에러를 검증
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeRepository } from '../test/fakeRepository'
import { CalendarProvider, useCalendar } from './useCalendar'

function Probe() {
  const cal = useCalendar()
  return (
    <div>
      <span data-testid="event-count">{cal.events.length}</span>
      <span data-testid="todo-count">{cal.todos.length}</span>
      <span data-testid="todo-done">{String(cal.todos[0]?.done ?? false)}</span>
      <span data-testid="view">{cal.view}</span>
      <span data-testid="current-date">{cal.currentDate.toDateString()}</span>
      <button onClick={() => cal.addEvent({ id: '1', title: '일정', allDay: true, start: '2026-09-01', end: '2026-09-01' })}>
        추가
      </button>
      <button onClick={() => cal.deleteEvent('1')}>삭제</button>
      <button onClick={() => cal.addTodo({ id: 't1', title: '할 일', done: false })}>할일추가</button>
      <button onClick={() => cal.updateTodo({ id: 't1', title: '할 일', done: true })}>할일완료</button>
      <button onClick={() => cal.deleteTodo('t1')}>할일삭제</button>
      <button onClick={() => cal.setView('week')}>주 보기로</button>
      <button onClick={() => cal.setSelectedDate(new Date(2026, 8, 20))}>20일 선택</button>
      <button onClick={() => cal.changeView('day')}>일 보기로 전환</button>
    </div>
  )
}

describe('CalendarProvider / useCalendar', () => {
  it('초기 로드 후 repository의 이벤트를 보여준다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: '1', title: '기존 일정', allDay: true, start: '2026-09-01', end: '2026-09-01' })

    render(
      <CalendarProvider repository={repo}>
        <Probe />
      </CalendarProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('1'))
  })

  it('addEvent/deleteEvent 후 화면에 반영된다', async () => {
    const repo = new FakeRepository()
    render(
      <CalendarProvider repository={repo}>
        <Probe />
      </CalendarProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('0'))

    screen.getByText('추가').click()
    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('1'))

    screen.getByText('삭제').click()
    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('0'))
  })

  it('view 기본값은 month이고 setView로 바뀐다', async () => {
    const repo = new FakeRepository()
    render(
      <CalendarProvider repository={repo}>
        <Probe />
      </CalendarProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('view')).toHaveTextContent('month'))
    screen.getByText('주 보기로').click()
    await waitFor(() => expect(screen.getByTestId('view')).toHaveTextContent('week'))
  })

  it('changeView는 선택된 날짜를 기준으로 currentDate를 맞춘다', async () => {
    const repo = new FakeRepository()
    render(
      <CalendarProvider repository={repo}>
        <Probe />
      </CalendarProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('view')).toHaveTextContent('month'))

    fireEvent.click(screen.getByText('20일 선택'))
    fireEvent.click(screen.getByText('일 보기로 전환'))

    await waitFor(() => expect(screen.getByTestId('view')).toHaveTextContent('day'))
    expect(screen.getByTestId('current-date')).toHaveTextContent(new Date(2026, 8, 20).toDateString())
  })

  it('addTodo/updateTodo/deleteTodo 후 화면에 반영된다', async () => {
    const repo = new FakeRepository()
    render(
      <CalendarProvider repository={repo}>
        <Probe />
      </CalendarProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('todo-count')).toHaveTextContent('0'))

    screen.getByText('할일추가').click()
    await waitFor(() => expect(screen.getByTestId('todo-count')).toHaveTextContent('1'))
    expect(screen.getByTestId('todo-done')).toHaveTextContent('false')

    screen.getByText('할일완료').click()
    await waitFor(() => expect(screen.getByTestId('todo-done')).toHaveTextContent('true'))

    screen.getByText('할일삭제').click()
    await waitFor(() => expect(screen.getByTestId('todo-count')).toHaveTextContent('0'))
  })

  it('localStorage에 저장된 기본 보기가 있으면 그걸로 시작한다', async () => {
    localStorage.setItem('calendar.defaultView', 'agenda')
    const repo = new FakeRepository()
    render(
      <CalendarProvider repository={repo}>
        <Probe />
      </CalendarProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('view')).toHaveTextContent('agenda'))
    localStorage.clear()
  })

  it('로컬 모드(supabase 없음)에서 respondToEvent/setEventParticipants는 아무 일도 하지 않고 안전하게 끝난다', async () => {
    // 함께 일정은 Supabase 전용 기능이지만, EventEditor는 로그인 여부와 무관하게 이 액션들을
    // 호출할 수 있는 구조라 로컬 모드에서 호출돼도 예외 없이 조용히 끝나야 한다
    const repo = new FakeRepository()
    let respondResult: unknown = 'not-called'
    let setParticipantsResult: unknown = 'not-called'
    function Inner() {
      const cal = useCalendar()
      return (
        <div>
          <button onClick={() => cal.respondToEvent('e1', 'accepted').then(() => (respondResult = 'ok'))}>응답</button>
          <button
            onClick={() =>
              cal.setEventParticipants('e1', [], [{ userId: 'u2', status: 'pending' }]).then(() => (setParticipantsResult = 'ok'))
            }
          >
            초대
          </button>
        </div>
      )
    }
    render(
      <CalendarProvider repository={repo}>
        <Inner />
      </CalendarProvider>,
    )

    fireEvent.click(screen.getByText('응답'))
    fireEvent.click(screen.getByText('초대'))

    await waitFor(() => expect(respondResult).toBe('ok'))
    await waitFor(() => expect(setParticipantsResult).toBe('ok'))
  })

  it('월 보기에서 다른 달로 넘어가면 선택일도 그 달의 같은 날짜로 따라가고, 존재하지 않는 날짜는 말일로 맞춘다', async () => {
    function Inner() {
      const cal = useCalendar()
      return (
        <div>
          <span data-testid="selected">{cal.selectedDate.toDateString()}</span>
          <button onClick={() => cal.setSelectedDate(new Date(2026, 0, 31))}>1월31일 선택</button>
          <button onClick={() => cal.setCurrentDate(new Date(2026, 1, 1))}>2월로</button>
          <button onClick={() => cal.setView('week')}>주 보기</button>
          <button onClick={() => cal.setCurrentDate(new Date(2026, 2, 1))}>3월로</button>
        </div>
      )
    }
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <Inner />
      </CalendarProvider>,
    )
    fireEvent.click(screen.getByText('1월31일 선택'))
    fireEvent.click(screen.getByText('2월로'))
    expect(screen.getByTestId('selected')).toHaveTextContent(new Date(2026, 1, 28).toDateString())

    // 다른 보기(주)는 기존 동작 그대로 — 선택일을 건드리지 않는다
    fireEvent.click(screen.getByText('주 보기'))
    fireEvent.click(screen.getByText('3월로'))
    expect(screen.getByTestId('selected')).toHaveTextContent(new Date(2026, 1, 28).toDateString())
  })

  it('Provider 밖에서 사용하면 에러를 던진다', () => {
    function Broken() {
      useCalendar()
      return null
    }
    expect(() => render(<Broken />)).toThrow(/CalendarProvider/)
  })
})

// 웹과 바탕화면 위젯이 같은 DB를 보므로, 한쪽에서 바꾼 일정이 다른 쪽에도 (새로고침 없이) 나타나야 한다
describe('CalendarProvider 자동 갱신', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function renderWith(repo: FakeRepository) {
    render(
      <CalendarProvider repository={repo}>
        <Probe />
      </CalendarProvider>,
    )
  }

  const external = { id: 'x', title: '다른 기기 일정', allDay: true, start: '2026-09-01', end: '2026-09-01' }

  it('창에 포커스가 돌아오면 다른 곳에서 추가된 일정을 다시 불러온다', async () => {
    const repo = new FakeRepository()
    renderWith(repo)
    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('0'))

    repo.events.push(external)
    fireEvent.focus(window)

    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('1'))
  })

  it('60초마다 다시 불러온다', async () => {
    vi.useFakeTimers()
    const repo = new FakeRepository()
    renderWith(repo)
    await act(async () => {})
    expect(screen.getByTestId('event-count')).toHaveTextContent('0')

    repo.events.push(external)
    await act(async () => {
      vi.advanceTimersByTime(59_000)
    })
    expect(screen.getByTestId('event-count')).toHaveTextContent('0')

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.getByTestId('event-count')).toHaveTextContent('1')
  })

  it('언마운트하면 주기 갱신을 멈춘다', async () => {
    vi.useFakeTimers()
    const repo = new FakeRepository()
    const listEvents = vi.spyOn(repo, 'listEvents')
    const { unmount } = render(
      <CalendarProvider repository={repo}>
        <Probe />
      </CalendarProvider>,
    )
    await act(async () => {})
    unmount()
    listEvents.mockClear()

    await act(async () => {
      vi.advanceTimersByTime(120_000)
    })
    expect(listEvents).not.toHaveBeenCalled()
  })

  it('먼저 시작한 오래된 응답이 나중에 도착해도 최신 데이터를 덮어쓰지 않는다', async () => {
    const repo = new FakeRepository()
    renderWith(repo)
    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('0'))

    // 첫 번째(주기 갱신) 요청은 빈 목록을 늦게 돌려주고, 두 번째(추가 직후 재로드)는 바로 새 목록을 돌려준다
    let releaseStale!: (events: never[]) => void
    const realList = repo.listEvents.bind(repo)
    const spy = vi.spyOn(repo, 'listEvents')
    spy.mockImplementationOnce(() => new Promise((resolve) => (releaseStale = resolve)))
    spy.mockImplementation(realList)

    fireEvent.focus(window) // 오래된 응답 대기 시작
    screen.getByText('추가').click()
    await waitFor(() => expect(screen.getByTestId('event-count')).toHaveTextContent('1'))

    await act(async () => releaseStale([]))
    expect(screen.getByTestId('event-count')).toHaveTextContent('1')
  })
})
