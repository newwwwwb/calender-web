// EventEditor: 생성/수정/삭제, 필수값 검증을 확인
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import type { CalendarEvent, EventInstance } from '../types'
import EventEditor from './EventEditor'

function toInstance(event: CalendarEvent): EventInstance {
  return { event, start: event.start, end: event.end, instanceDate: event.start.slice(0, 10) }
}

function renderEditor(repo: FakeRepository, props: Partial<ComponentProps<typeof EventEditor>> = {}) {
  const onClose = vi.fn()
  render(
    <CalendarProvider repository={repo}>
      <EventEditor instance={null} defaultDate="2026-09-15" onClose={onClose} {...props} />
    </CalendarProvider>,
  )
  return { onClose }
}

describe('EventEditor', () => {
  it('제목 없이 저장하면 에러를 보여주고 저장하지 않는다', async () => {
    const repo = new FakeRepository()
    const { onClose } = renderEditor(repo)

    fireEvent.click(screen.getByText('저장'))

    expect(await screen.findByText('제목을 입력해 주세요.')).toBeInTheDocument()
    expect(repo.events).toHaveLength(0)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('새 일정을 생성한다', async () => {
    const repo = new FakeRepository()
    const { onClose } = renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '팀 회의' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events).toHaveLength(1))
    expect(repo.events[0]).toMatchObject({ title: '팀 회의', start: '2026-09-15', end: '2026-09-15', allDay: true })
    expect(onClose).toHaveBeenCalled()
  })

  it('기존 일정을 수정한다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '기존 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    const { onClose } = renderEditor(repo, { instance: toInstance(repo.events[0]) })

    expect(screen.getByLabelText('제목')).toHaveValue('기존 일정')
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '수정된 제목' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events[0].title).toBe('수정된 제목'))
    expect(onClose).toHaveBeenCalled()
  })

  it('반복 일정이 아니면 클릭한 회차의 실제 날짜를 폼에 채운다', () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '기존 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    // 이 회차의 실제 날짜(예: 반복 전개 결과)가 템플릿과 다르다고 가정
    renderEditor(repo, {
      instance: { event: repo.events[0], start: '2026-09-17', end: '2026-09-17', instanceDate: '2026-09-17' },
    })

    expect(screen.getByLabelText('시작')).toHaveValue('2026-09-17')
    expect(screen.getByLabelText('종료')).toHaveValue('2026-09-17')
  })

  it('일정을 삭제한다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '삭제될 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    const { onClose } = renderEditor(repo, { instance: toInstance(repo.events[0]) })

    fireEvent.click(screen.getByText('삭제'))

    await waitFor(() => expect(repo.events).toHaveLength(0))
    expect(onClose).toHaveBeenCalled()
  })

  it('매주 반복 + 요일 선택 + 횟수 종료로 일정을 만든다', async () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '스탠드업' } })
    fireEvent.change(screen.getByLabelText('반복'), { target: { value: 'weekly' } })
    fireEvent.click(screen.getByLabelText('월'))
    fireEvent.click(screen.getByLabelText('수'))
    fireEvent.change(screen.getByLabelText('반복 종료'), { target: { value: 'count' } })
    fireEvent.change(screen.getByLabelText('반복 횟수'), { target: { value: '8' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events).toHaveLength(1))
    expect(repo.events[0].recurrence).toEqual({ freq: 'weekly', interval: 1, byWeekday: [1, 3], count: 8 })
  })

  it('반복 안 함을 유지하면 recurrence 없이 저장된다', async () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '단발성 일정' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events).toHaveLength(1))
    expect(repo.events[0].recurrence).toBeUndefined()
  })

  it('기존 반복 일정을 열면 반복 규칙이 폼에 채워진다', () => {
    const repo = new FakeRepository()
    repo.events.push({
      id: 'e1',
      title: '반복 일정',
      allDay: true,
      start: '2026-09-01',
      end: '2026-09-01',
      recurrence: { freq: 'monthly', interval: 2, until: '2027-01-01' },
    })
    renderEditor(repo, { instance: toInstance(repo.events[0]) })

    expect(screen.getByLabelText('반복')).toHaveValue('monthly')
    expect(screen.getByLabelText('간격')).toHaveValue(2)
    expect(screen.getByLabelText('반복 종료')).toHaveValue('until')
    expect(screen.getByLabelText('반복 종료일')).toHaveValue('2027-01-01')
  })

  it('종료가 시작보다 빠르면 에러를 보여준다', async () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '일정' } })
    fireEvent.change(screen.getByLabelText('종료'), { target: { value: '2026-09-10' } })
    fireEvent.click(screen.getByText('저장'))

    expect(await screen.findByText('종료 일시는 시작 일시보다 빠를 수 없어요.')).toBeInTheDocument()
    expect(repo.events).toHaveLength(0)
  })
})
