// useCalendar Context: 로드, CRUD 후 재로드, Provider 밖 사용 에러를 검증
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Category, ID } from '../types'
import type { EventRepository } from '../storage/repository'
import { CalendarProvider, useCalendar } from './useCalendar'

class FakeRepository implements EventRepository {
  events: CalendarEvent[] = []
  categories: Category[] = []

  async listEvents() {
    return [...this.events]
  }
  async addEvent(event: CalendarEvent) {
    this.events.push(event)
  }
  async updateEvent(event: CalendarEvent) {
    this.events = this.events.map((e) => (e.id === event.id ? event : e))
  }
  async deleteEvent(id: ID) {
    this.events = this.events.filter((e) => e.id !== id)
  }
  async listCategories() {
    return [...this.categories]
  }
  async addCategory(category: Category) {
    this.categories.push(category)
  }
  async updateCategory(category: Category) {
    this.categories = this.categories.map((c) => (c.id === category.id ? category : c))
  }
  async deleteCategory(id: ID) {
    this.categories = this.categories.filter((c) => c.id !== id)
  }
}

function Probe() {
  const cal = useCalendar()
  return (
    <div>
      <span data-testid="event-count">{cal.events.length}</span>
      <button onClick={() => cal.addEvent({ id: '1', title: '일정', allDay: true, start: '2026-09-01', end: '2026-09-01' })}>
        추가
      </button>
      <button onClick={() => cal.deleteEvent('1')}>삭제</button>
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

  it('Provider 밖에서 사용하면 에러를 던진다', () => {
    function Broken() {
      useCalendar()
      return null
    }
    expect(() => render(<Broken />)).toThrow(/CalendarProvider/)
  })
})
