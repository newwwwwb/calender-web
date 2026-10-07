// MonthView 퇴장 중 옛 칩: 다른 기기의 수정으로 사라지는 중(퇴장 애니메이션)인 칩이 옛 렌더의 핸들러로 놓기·키를 받아도 원격 수정을 덮지 않는지 검증
// 퇴장 애니메이션이 실시간으로 진행돼 가짜 타이머로 멈출 수 없어, 이 파일에서만 칩 전환을 매우 길게 만들어 퇴장 중 구간을 결정적으로 유지한다(31단계)
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRepository } from '../test/fakeRepository'
import type { CalendarEvent } from '../types'
import { chip, flush, installElementFromPoint, monthMeeting as meeting, pointer, press, removeElementFromPoint, renderMonth } from '../test/dragHelpers'

vi.mock('../lib/motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/motion')>()
  return { ...actual, chipMotion: { ...actual.chipMotion, transition: { duration: 600 } } }
})

let hoverKey = '2026-09-15' // document.elementFromPoint 스텁이 돌려줄 칸

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15))
  installElementFromPoint(() => hoverKey)
})

afterEach(() => {
  removeElementFromPoint()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

// 다른 기기가 일정을 다른 날로 옮겨 재로드되면 옛 칩은 퇴장 애니메이션 중으로 남는다
async function remoteMoveWhileExiting(repo: FakeRepository) {
  repo.events = [{ ...meeting, title: '원격제목', memo: '원격메모', start: '2026-09-22T09:00', end: '2026-09-22T10:00' }]
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('MonthView 퇴장 중인 옛 칩', () => {
  it('끄는 도중 다른 기기가 일정을 다른 날로 옮겨 칩이 퇴장 중일 때 놓으면, 원격 수정을 지우지 않고 저장하지 않는다', async () => {
    const { repo } = await renderMonth([{ ...meeting, memo: '원래' }])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = chip('회의')
    hoverKey = '2026-09-15'
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    hoverKey = '2026-09-17'
    fireEvent.pointerMove(el, { ...pointer, clientX: 300, clientY: 100 })
    await remoteMoveWhileExiting(repo) // 옛 칩은 아직 퇴장 애니메이션 중
    expect(el.isConnected).toBe(true)
    fireEvent.pointerUp(el, { ...pointer, clientX: 300, clientY: 100 })
    await flush()

    expect(update).not.toHaveBeenCalled()
    expect(repo.events[0]).toMatchObject({ title: '원격제목', memo: '원격메모', start: '2026-09-22T09:00' })
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
  })

  // 30.R 지적: 포커스가 남은 퇴장 중인 옛 칩이 옛 렌더의 핸들러로 옛 스냅숏을 저장해 원격 수정을 지웠다
  it('다른 기기가 일정을 다른 날로 옮겨 포커스된 칩이 퇴장 중일 때 키를 눌러도, 원격 수정을 지우지 않고 저장하지 않는다', async () => {
    const { repo } = await renderMonth([{ ...meeting, memo: '원래' }])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = chip('회의')
    el.focus()
    await remoteMoveWhileExiting(repo)
    expect(el.isConnected).toBe(true) // 퇴장 애니메이션 중인 옛 칩에 포커스가 남아 있다
    const event = press(el, 'ArrowRight')
    await flush()

    expect(event.defaultPrevented).toBe(true)
    expect(update).not.toHaveBeenCalled()
    expect(repo.events[0]).toMatchObject({ title: '원격제목', memo: '원격메모', start: '2026-09-22T09:00' })
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
  })

  // 32단계: 새 키 입구(Alt+Shift+←→ 기간 조절)도 같은 보호(최신 회차 재탐색) 아래에 있어야 한다
  it('다른 기기가 종일 일정을 다른 날로 옮겨 포커스된 칩이 퇴장 중일 때 Alt+Shift+→를 눌러도, 원격 수정을 지우지 않고 저장하지 않는다', async () => {
    const trip: CalendarEvent = { id: 't', title: '제주 여행', allDay: true, start: '2026-09-14', end: '2026-09-15', memo: '원래' }
    const { repo } = await renderMonth([trip])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = chip('제주 여행')
    el.focus()
    repo.events = [{ ...trip, title: '원격제목', memo: '원격메모', start: '2026-09-22', end: '2026-09-23' }]
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(el.isConnected).toBe(true)
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true, bubbles: true, cancelable: true })
    act(() => {
      el.dispatchEvent(event)
    })
    await flush()

    expect(event.defaultPrevented).toBe(true)
    expect(update).not.toHaveBeenCalled()
    expect(repo.events[0]).toMatchObject({ title: '원격제목', memo: '원격메모', start: '2026-09-22', end: '2026-09-23' })
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
  })
})
