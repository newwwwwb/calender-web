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

describe('토스트 시간·쌓기(25단계 최종 심사 P2)', () => {
  it('마우스를 올리거나 포커스가 안에 있는 동안은 사라지지 않고, 벗어나면 다시 시간이 흐른다', async () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ToastButton options={{ message: '삭제했어요.', actionLabel: '되돌리기', onAction: () => {} }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    const toast = screen.getByRole('status')

    fireEvent.pointerEnter(toast)
    act(() => void vi.advanceTimersByTime(20_000)) // 한참 지나도 올려 둔 동안은 남는다
    expect(screen.getByText('삭제했어요.')).toBeInTheDocument()

    fireEvent.pointerLeave(toast)
    act(() => void vi.advanceTimersByTime(7500))
    await act(async () => void vi.runOnlyPendingTimers())
    expect(screen.queryByText('삭제했어요.')).not.toBeInTheDocument()
  })

  it('키보드 포커스가 되돌리기 버튼에 있는 동안에도 사라지지 않는다', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ToastButton options={{ message: '삭제했어요.', actionLabel: '되돌리기', onAction: () => {} }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    fireEvent.focus(screen.getByText('되돌리기'))
    act(() => void vi.advanceTimersByTime(20_000))
    expect(screen.getByText('삭제했어요.')).toBeInTheDocument()
  })

  it('오류 토스트가 뒤이은 일반 토스트에 덮이지 않고 함께 남는다', () => {
    render(
      <ToastProvider>
        <ToastButton options={{ message: '저장하지 못했어요.', tone: 'error', actionLabel: '다시 시도', onAction: () => {} }} />
        <ToastButton options={{ message: '링크를 복사했어요.' }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getAllByText('띄우기')[0])
    fireEvent.click(screen.getAllByText('띄우기')[1])
    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했어요.')
    expect(screen.getByText('링크를 복사했어요.')).toBeInTheDocument()
  })

  it('토스트는 body의 맨 앞에 있어 키보드 첫 Tab으로 닿는다', () => {
    render(
      <ToastProvider>
        <ToastButton options={{ message: '삭제했어요.', actionLabel: '되돌리기', onAction: () => {} }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    expect(document.body.firstElementChild).toContainElement(screen.getByText('되돌리기'))
  })
})

describe('Ctrl/Cmd+Z 되돌리기(25단계 2차 심사: 삭제 직후 키보드로 토스트에 닿기 어려움)', () => {
  it('가장 최근의 되돌리기 토스트를 실행하고 닫는다', () => {
    const onAction = vi.fn()
    render(
      <ToastProvider>
        <ToastButton options={{ message: '삭제했어요.', actionLabel: '되돌리기', onAction }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    expect(onAction).toHaveBeenCalledTimes(1)
    return waitFor(() => expect(screen.queryByText('삭제했어요.')).not.toBeInTheDocument())
  })

  it('macOS의 Cmd+Z도 같다', () => {
    const onAction = vi.fn()
    render(
      <ToastProvider>
        <ToastButton options={{ message: '삭제했어요.', actionLabel: '되돌리기', onAction }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('입력칸 안에서는 글자 입력의 실행 취소를 가로채지 않는다', () => {
    const onAction = vi.fn()
    render(
      <ToastProvider>
        <ToastButton options={{ message: '삭제했어요.', actionLabel: '되돌리기', onAction }} />
        <input aria-label="입력" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    fireEvent.keyDown(screen.getByLabelText('입력'), { key: 'z', ctrlKey: true })
    expect(onAction).not.toHaveBeenCalled()
  })

  it('키보드로 삭제한 뒤 포커스가 체크박스에 있어도 되돌린다(텍스트 입력만 제외)', () => {
    const onAction = vi.fn()
    render(
      <ToastProvider>
        <ToastButton options={{ message: '삭제했어요.', actionLabel: '되돌리기', onAction }} />
        <input type="checkbox" aria-label="체크" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    fireEvent.keyDown(screen.getByLabelText('체크'), { key: 'z', ctrlKey: true })
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('되돌리기가 없는 토스트(오류 등)가 있으면 아무 일도 하지 않는다', () => {
    const onAction = vi.fn()
    render(
      <ToastProvider>
        <ToastButton options={{ message: '저장하지 못했어요.', tone: 'error', actionLabel: '다시 시도', onAction }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(onAction).not.toHaveBeenCalled()
  })

  it('같은 되돌리기가 쌓여도 문구에 항목 이름이 있어 구분된다', () => {
    render(
      <ToastProvider>
        <ToastButton options={{ message: "'빨래' 할 일을 삭제했어요.", actionLabel: '되돌리기', onAction: () => {} }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('띄우기'))
    expect(screen.getByText("'빨래' 할 일을 삭제했어요.")).toBeInTheDocument()
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
    expect(screen.getByRole('status')).toHaveTextContent("'회의' 일정을 삭제했어요.")

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

describe('새 일정 강조·기간 이동(25단계 모션 감사 N3)', () => {
  function Probe() {
    const cal = useCalendar()
    return (
      <>
        <button onClick={() => cal.addEvent(event({ id: 'brand-new', title: '새 일정' }))}>추가</button>
        <button onClick={() => cal.revealDate(new Date(2027, 0, 20))}>이동</button>
        <span data-testid="hl">{cal.highlightedEventId ?? ''}</span>
        <span data-testid="date">{cal.currentDate.getFullYear()}-{cal.currentDate.getMonth() + 1}</span>
      </>
    )
  }

  it('저장에 성공하면 그 일정이 잠깐 강조되고 시간이 지나면 풀린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(
      <ToastProvider>
        <CalendarProvider repository={new FakeRepository()}>
          <Probe />
        </CalendarProvider>
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('추가'))
    await waitFor(() => expect(screen.getByTestId('hl')).toHaveTextContent('brand-new'))
    act(() => void vi.advanceTimersByTime(1600))
    expect(screen.getByTestId('hl')).toHaveTextContent('')
  })

  it('다른 기간의 날짜를 보여 줄 때만 이동한다(같은 기간이면 그대로)', async () => {
    render(
      <ToastProvider>
        <CalendarProvider repository={new FakeRepository()}>
          <Probe />
        </CalendarProvider>
      </ToastProvider>,
    )
    const before = screen.getByTestId('date').textContent
    fireEvent.click(screen.getByText('이동'))
    await waitFor(() => expect(screen.getByTestId('date').textContent).toBe('2027-1'))
    expect(before).not.toBe('2027-1')
  })
})
