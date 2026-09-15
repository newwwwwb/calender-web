// useCalendar Context: 로드, CRUD 후 재로드, Provider 밖 사용 에러를 검증
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FakeRepository } from '../test/fakeRepository'
import { CalendarProvider, useCalendar } from './useCalendar'

function Probe() {
  const cal = useCalendar()
  return (
    <div>
      <span data-testid="event-count">{cal.events.length}</span>
      <span data-testid="view">{cal.view}</span>
      <button onClick={() => cal.addEvent({ id: '1', title: '일정', allDay: true, start: '2026-09-01', end: '2026-09-01' })}>
        추가
      </button>
      <button onClick={() => cal.deleteEvent('1')}>삭제</button>
      <button onClick={() => cal.setView('week')}>주 보기로</button>
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

  it('Provider 밖에서 사용하면 에러를 던진다', () => {
    function Broken() {
      useCalendar()
      return null
    }
    expect(() => render(<Broken />)).toThrow(/CalendarProvider/)
  })
})
