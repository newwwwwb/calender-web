// applyEventEdits: 일정 둘을 한 번에 바꾸고(update→add), add 실패 시 롤백하며, 되돌리기로 둘 다 복원하는지 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRepository } from '../test/fakeRepository'
import type { CalendarEvent } from '../types'
import { CalendarProvider, useCalendar } from './useCalendar'
import { ToastProvider } from './useToast'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

const original: CalendarEvent = {
  id: 'w',
  title: '요가',
  allDay: false,
  start: '2026-09-07T09:00',
  end: '2026-09-07T10:00',
  recurrence: { freq: 'weekly', interval: 1 },
}
const excluded: CalendarEvent = { ...original, excludedDates: ['2026-09-14'] }
const single: CalendarEvent = { id: 'n', title: '요가', allDay: false, start: '2026-09-15T10:00', end: '2026-09-15T11:00' }

function Probe({ onResult }: { onResult: (ok: boolean) => void }) {
  const cal = useCalendar()
  return (
    <button onClick={() => cal.applyEventEdits({ update: excluded, add: single }, { message: '요가 일정을 옮겼어요.', previous: original }).then(onResult)}>
      적용
    </button>
  )
}

async function setup(repo: FakeRepository) {
  const onResult = vi.fn()
  repo.events.push(original)
  render(
    <ToastProvider>
      <CalendarProvider repository={repo}>
        <Probe onResult={onResult} />
      </CalendarProvider>
    </ToastProvider>,
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
  return onResult
}

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })

describe('applyEventEdits', () => {
  it('원본을 바꾸고 새 일정을 추가한 뒤 "되돌리기" 토스트를 띄운다', async () => {
    const repo = new FakeRepository()
    const onResult = await setup(repo)
    fireEvent.click(screen.getByText('적용'))
    await flush()

    expect(onResult).toHaveBeenCalledWith(true)
    expect(repo.events).toEqual([excluded, single])
    expect(screen.getByText('요가 일정을 옮겼어요.')).toBeInTheDocument()
  })

  it('되돌리기를 누르면 새 일정을 지우고 원본을 복원한다', async () => {
    const repo = new FakeRepository()
    await setup(repo)
    fireEvent.click(screen.getByText('적용'))
    await flush()

    fireEvent.click(screen.getByText('되돌리기'))
    await flush()

    expect(repo.events).toEqual([original])
  })

  it('되돌리기 중 두 번째 쓰기(add 삭제)가 실패해도 원본은 이미 복원돼 그 회차가 사라지지 않는다', async () => {
    const repo = new FakeRepository()
    await setup(repo)
    fireEvent.click(screen.getByText('적용'))
    await flush()
    vi.spyOn(repo, 'deleteEvent').mockRejectedValue(new Error('network'))
    fireEvent.click(screen.getByText('되돌리기'))
    await flush()

    // 원본(제외일 없음)이 먼저 복원돼 있고, 단발 일정이 남아 중복 한 건이 생길 뿐이다 — 어디에도 없는 상태는 아니다
    expect(repo.events.find((e) => e.id === 'w')).toEqual(original)
    expect(repo.events.find((e) => e.id === 'n')).toBeTruthy()
  })

  it('add가 실패하면 원본을 롤백해 회차가 사라진 중간 상태를 남기지 않고, 실패로 알린다', async () => {
    const repo = new FakeRepository()
    const onResult = await setup(repo)
    vi.spyOn(repo, 'addEvent').mockRejectedValue(new Error('network'))
    fireEvent.click(screen.getByText('적용'))
    await flush()

    expect(onResult).toHaveBeenCalledWith(false)
    expect(repo.events).toEqual([original]) // 제외된 채로 남지 않는다
    expect(screen.getByText('다시 시도')).toBeInTheDocument()
  })

  it('add 없이도(전체 범위) 원본만 바꾼다', async () => {
    const repo = new FakeRepository()
    repo.events.push(original)
    const onResult = vi.fn()
    function OnlyUpdate() {
      const cal = useCalendar()
      return <button onClick={() => cal.applyEventEdits({ update: { ...original, title: '필라테스' } }, { message: '바꿨어요.', previous: original }).then(onResult)}>적용</button>
    }
    render(
      <ToastProvider>
        <CalendarProvider repository={repo}>
          <OnlyUpdate />
        </CalendarProvider>
      </ToastProvider>,
    )
    await flush()
    fireEvent.click(screen.getByText('적용'))
    await flush()

    expect(repo.events).toEqual([{ ...original, title: '필라테스' }])
  })
})
