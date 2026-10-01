// 토스트: 뷰포트 표시·액션·접근성 역할, 그리고 useCalendar 쓰기 실패("다시 시도")·삭제 뒤 "되돌리기"를 검증한다
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRepository } from '../test/fakeRepository'
import type { CalendarEvent } from '../types'
import { CalendarProvider, useCalendar } from './useCalendar'
import { ToastProvider, useToast } from './useToast'

afterEach(() => {
  vi.useRealTimers()
})

function ToastButton({ options }: { options: Parameters<ReturnType<typeof useToast>['showToast']>[0] }) {
  const { showToast } = useToast()
  return <button onClick={() => showToast(options)}>띄우기</button>
}

describe('ToastProvider', () => {
  it('일반 안내는 status 역할로, 오류는 alert 역할로 뜬다', () => {
    const { rerender } = render(
      <ToastProvider>
        <ToastButton options={{ message: '저장했어요.' }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    expect(screen.getByRole('status')).toHaveTextContent('저장했어요.')

    rerender(
      <ToastProvider>
        <ToastButton options={{ message: '저장하지 못했어요.', tone: 'error' }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했어요.')
  })

  it('액션 버튼을 누르면 onAction이 호출되고 토스트가 닫힌다', async () => {
    const onAction = vi.fn()
    render(
      <ToastProvider>
        <ToastButton options={{ message: '삭제했어요.', actionLabel: '되돌리기', onAction }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    fireEvent.click(screen.getByText('되돌리기'))
    expect(onAction).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByText('삭제했어요.')).not.toBeInTheDocument())
  })

  it('시간이 지나면 저절로 사라진다(액션이 있으면 더 오래 둔다)', async () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ToastButton options={{ message: '안내', actionLabel: '확인', onAction: () => {} }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    act(() => void vi.advanceTimersByTime(4500))
    expect(screen.getByText('안내')).toBeInTheDocument() // 4초가 지나도 액션이 있으면 남는다
    act(() => void vi.advanceTimersByTime(3000))
    await act(async () => void vi.runOnlyPendingTimers())
    expect(screen.queryByText('안내')).not.toBeInTheDocument()
  })
})

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id: 'e1', title: '회의', allDay: true, start: '2026-09-15', end: '2026-09-15', ...overrides }
}

function Actions() {
  const cal = useCalendar()
  return (
    <>
      <button onClick={() => cal.addEvent(event({ id: 'new', title: '새 일정' }))}>추가</button>
      <button onClick={() => cal.deleteEvent('e1')}>삭제</button>
      <ul>
        {cal.shownEvents.map((e) => (
          <li key={e.id}>{e.title}</li>
        ))}
      </ul>
    </>
  )
}

function renderCalendar(repo: FakeRepository) {
  render(
    <ToastProvider>
      <CalendarProvider repository={repo}>
        <Actions />
      </CalendarProvider>
    </ToastProvider>,
  )
}

describe('useCalendar 쓰기 피드백', () => {
  let repo: FakeRepository
  beforeEach(() => {
    repo = new FakeRepository()
    repo.events.push(event())
  })

  it('저장이 실패하면 조용히 묻지 않고 "다시 시도" 오류 토스트를 띄우고, 누르면 다시 시도한다', async () => {
    const add = vi.spyOn(repo, 'addEvent').mockRejectedValueOnce(new Error('network'))
    renderCalendar(repo)
    await screen.findByText('회의')

    fireEvent.click(screen.getByText('추가'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('저장하지 못했어요.')
    expect(screen.queryByText('새 일정')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('다시 시도')) // 두 번째 호출은 성공한다
    await screen.findByText('새 일정')
    expect(add).toHaveBeenCalledTimes(2)
  })

  it('삭제하면 "되돌리기" 토스트가 뜨고, 누르면 일정이 돌아온다', async () => {
    renderCalendar(repo)
    await screen.findByText('회의')

    fireEvent.click(screen.getByText('삭제'))
    await waitFor(() => expect(screen.queryByText('회의')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('일정을 삭제했어요.')

    fireEvent.click(screen.getByText('되돌리기'))
    await screen.findByText('회의')
  })

  it('초대받은 사람이 있는 함께 일정은 되돌리기를 주지 않는다(초대 상태가 복원되지 않으므로)', async () => {
    repo.events[0] = event({ participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] })
    renderCalendar(repo)
    await screen.findByText('회의')

    fireEvent.click(screen.getByText('삭제'))
    await waitFor(() => expect(screen.queryByText('회의')).not.toBeInTheDocument())
    expect(screen.queryByText('되돌리기')).not.toBeInTheDocument()
  })
})
