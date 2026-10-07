// TimeGridView 퇴장 중 옛 블록: 다른 기기의 수정으로 사라지는 중(퇴장 애니메이션)인 블록이 옛 렌더의 핸들러로 놓기·키를 받아도 원격 수정을 덮지 않는지 검증
// 퇴장 애니메이션이 실시간으로 진행돼 가짜 타이머로 멈출 수 없어, 이 파일에서만 블록 전환을 매우 길게 만들어 퇴장 중 구간을 결정적으로 유지한다(31단계)
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BLOCK_X, BLOCK_Y, block, flush as settle, HOUR_PX, installGridRects, pointer, press, renderGrid, weekMeeting as meeting } from '../test/dragHelpers'
import type { FakeRepository } from '../test/fakeRepository'

vi.mock('../lib/motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/motion')>()
  return { ...actual, chipMotion: { ...actual.chipMotion, transition: { duration: 600 } } }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15))
  installGridRects()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

// 다른 기기가 일정을 다른 날로 옮겨 재로드되면 옛 블록은 퇴장 애니메이션 중으로 남는다
async function remoteMoveWhileExiting(repo: FakeRepository) {
  repo.events = [{ ...meeting, title: '원격제목', memo: '원격메모', start: '2026-09-15T09:00', end: '2026-09-15T10:00' }]
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('TimeGridView 퇴장 중인 옛 블록', () => {
  it('끄는 도중 다른 기기가 일정을 다른 날로 옮겨 블록이 퇴장 중일 때 놓으면, 원격 수정을 지우지 않고 저장하지 않는다', async () => {
    const { repo } = await renderGrid([{ ...meeting, memo: '원래' }])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = block()
    fireEvent.pointerDown(el, { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(el, { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    await remoteMoveWhileExiting(repo) // 다른 날로 옮겨 옛 블록이 퇴장
    expect(el.isConnected).toBe(true)
    fireEvent.pointerUp(el, { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(update).not.toHaveBeenCalled()
    expect(repo.events[0]).toMatchObject({ title: '원격제목', memo: '원격메모', start: '2026-09-15T09:00' })
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
  })

  // 30.R 지적: 포커스가 남은 퇴장 중인 옛 블록이 옛 렌더의 핸들러로 옛 스냅숏을 저장해 원격 수정을 지웠다
  it('다른 기기가 일정을 다른 날로 옮겨 포커스된 블록이 퇴장 중일 때 키를 눌러도, 원격 수정을 지우지 않고 저장하지 않는다', async () => {
    const { repo } = await renderGrid([{ ...meeting, memo: '원래' }])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = block()
    el.focus()
    await remoteMoveWhileExiting(repo)
    expect(el.isConnected).toBe(true)
    const event = press(el, 'ArrowDown')
    await settle()

    expect(event.defaultPrevented).toBe(true)
    expect(update).not.toHaveBeenCalled()
    expect(repo.events[0]).toMatchObject({ title: '원격제목', memo: '원격메모', start: '2026-09-15T09:00' })
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
  })
})
