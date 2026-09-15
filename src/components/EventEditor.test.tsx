// EventEditor: 생성/수정/삭제, 필수값 검증을 확인
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import EventEditor from './EventEditor'

function renderEditor(repo: FakeRepository, props: Partial<ComponentProps<typeof EventEditor>> = {}) {
  const onClose = vi.fn()
  render(
    <CalendarProvider repository={repo}>
      <EventEditor event={null} defaultDate="2026-09-15" onClose={onClose} {...props} />
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
    const { onClose } = renderEditor(repo, { event: repo.events[0] })

    expect(screen.getByLabelText('제목')).toHaveValue('기존 일정')
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '수정된 제목' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events[0].title).toBe('수정된 제목'))
    expect(onClose).toHaveBeenCalled()
  })

  it('일정을 삭제한다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '삭제될 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    const { onClose } = renderEditor(repo, { event: repo.events[0] })

    fireEvent.click(screen.getByText('삭제'))

    await waitFor(() => expect(repo.events).toHaveLength(0))
    expect(onClose).toHaveBeenCalled()
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
