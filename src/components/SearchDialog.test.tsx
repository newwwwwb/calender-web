// SearchDialog: 검색어에 따른 결과 필터링, 클릭 시 이동, 닫기를 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import SearchDialog from './SearchDialog'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15))
})

afterEach(() => {
  vi.useRealTimers()
})

async function flushLoad() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

function renderDialog(repo: FakeRepository) {
  const onClose = vi.fn()
  const onNavigate = vi.fn()
  render(
    <CalendarProvider repository={repo}>
      <SearchDialog onClose={onClose} onNavigate={onNavigate} />
    </CalendarProvider>,
  )
  return { onClose, onNavigate }
}

describe('SearchDialog', () => {
  it('검색어가 비어 있으면 안내 문구를 보여준다', async () => {
    renderDialog(new FakeRepository())
    await flushLoad()
    expect(screen.getByText('제목이나 메모로 일정을 찾아보세요.')).toBeInTheDocument()
  })

  it('제목이나 메모에 검색어가 포함된 일정만 보여준다', async () => {
    const repo = new FakeRepository()
    repo.events.push(
      { id: 'a', title: '치과 예약', allDay: true, start: '2026-09-10', end: '2026-09-10' },
      { id: 'b', title: '팀 회의', memo: '치과 관련 논의', allDay: true, start: '2026-09-12', end: '2026-09-12' },
      { id: 'c', title: '점심 약속', allDay: true, start: '2026-09-13', end: '2026-09-13' },
    )
    renderDialog(repo)
    await flushLoad()

    fireEvent.change(screen.getByPlaceholderText('일정 검색 (제목, 메모)'), { target: { value: '치과' } })

    expect(screen.getByText('치과 예약')).toBeInTheDocument()
    expect(screen.getByText('팀 회의')).toBeInTheDocument()
    expect(screen.queryByText('점심 약속')).not.toBeInTheDocument()
  })

  it('검색 결과가 없으면 안내 문구를 보여준다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'a', title: '팀 회의', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    renderDialog(repo)
    await flushLoad()

    fireEvent.change(screen.getByPlaceholderText('일정 검색 (제목, 메모)'), { target: { value: '없는 일정' } })
    expect(screen.getByText('검색 결과가 없어요.')).toBeInTheDocument()
  })

  it('결과를 클릭하면 그 날짜로 이동하고 닫힌다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'a', title: '치과 예약', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    const { onClose, onNavigate } = renderDialog(repo)
    await flushLoad()

    fireEvent.change(screen.getByPlaceholderText('일정 검색 (제목, 메모)'), { target: { value: '치과' } })
    fireEvent.click(screen.getByText('치과 예약'))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate.mock.calls[0][0].getDate()).toBe(10)
    expect(onClose).toHaveBeenCalled()
  })

  it('Esc를 누르면 닫힌다', async () => {
    const { onClose } = renderDialog(new FakeRepository())
    await flushLoad()
    fireEvent.keyDown(screen.getByPlaceholderText('일정 검색 (제목, 메모)'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
