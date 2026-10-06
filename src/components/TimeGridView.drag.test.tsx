// TimeGridView 드래그 편집: 마우스로 시간 블록을 끌어 옮기거나 아래 끝을 끌어 길이를 바꾸고, 클릭·취소·끌 수 없는 일정을 구분하는지 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import type { CalendarEvent } from '../types'
import TimeGridView from './TimeGridView'

const DAYS = [new Date(2026, 8, 13), new Date(2026, 8, 14), new Date(2026, 8, 15)] // 일,월,화
const COLUMN_WIDTH = 100
const HOUR_PX = 48

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15))
  // jsdom은 레이아웃이 없으니 스크롤 영역(top 0)과 각 열(폭 100, 왼쪽부터 0·100·200)의 사각형을 지어낸다
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute('data-day-column')) {
      const index = Array.from(this.parentElement!.children).indexOf(this)
      const left = index * COLUMN_WIDTH
      return { left, right: left + COLUMN_WIDTH, top: 0, bottom: 1152, width: COLUMN_WIDTH, height: 1152, x: left, y: 0, toJSON() {} }
    }
    return { left: 0, right: 300, top: 0, bottom: 600, width: 300, height: 600, x: 0, y: 0, toJSON() {} }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

const meeting: CalendarEvent = { id: 'm', title: '회의', allDay: false, start: '2026-09-14T09:00', end: '2026-09-14T10:00' } // 월요일 9~10시

async function renderGrid(events: CalendarEvent[], onSelectEvent = vi.fn()) {
  const repo = new FakeRepository()
  repo.events.push(...events)
  render(
    <CalendarProvider repository={repo}>
      <TimeGridView days={DAYS} onSelectEvent={onSelectEvent} />
    </CalendarProvider>,
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
  return { repo, onSelectEvent }
}

// 드래그 중에는 고스트에도 제목이 있어 getByText가 둘을 찾으므로 블록 버튼을 클래스로 고른다
const block = () => document.querySelector('button[class*="eventBlock"]') as HTMLElement
const pointer = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'mouse' }
// 월요일 열(x 100~200)의 9시 블록 안쪽 점
const BLOCK_X = 150
const BLOCK_Y = 9 * HOUR_PX + 10

async function drag(target: HTMLElement, to: { x: number; y: number }, from = { x: BLOCK_X, y: BLOCK_Y }) {
  fireEvent.pointerDown(target, { ...pointer, clientX: from.x, clientY: from.y })
  fireEvent.pointerMove(target, { ...pointer, clientX: to.x, clientY: to.y })
  fireEvent.pointerUp(target, { ...pointer, clientX: to.x, clientY: to.y })
  fireEvent.click(target) // 브라우저는 pointerup 직후 같은 턴에 click을 보낸다
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('TimeGridView 블록 드래그', () => {
  it('아래로 한 시간만큼 끌면 시작·끝이 한 시간 뒤로 저장된다', async () => {
    const { repo, onSelectEvent } = await renderGrid([meeting])
    await drag(block(), { x: BLOCK_X, y: BLOCK_Y + HOUR_PX })

    expect(repo.events[0]).toMatchObject({ start: '2026-09-14T10:00', end: '2026-09-14T11:00' })
    // 드래그 뒤 이어지는 click이 편집기를 열지 않는다
    expect(onSelectEvent).not.toHaveBeenCalled()
    // 막는 것은 그 click 한 번뿐이라, 다음 click은 평소처럼 편집기를 연다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    fireEvent.click(block())
    expect(onSelectEvent).toHaveBeenCalledTimes(1)
  })

  it('15분 단위로 맞춰 옮긴다(22px ≈ 27분 → 30분)', async () => {
    const { repo } = await renderGrid([meeting])
    await drag(block(), { x: BLOCK_X, y: BLOCK_Y + 22 })
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14T09:30', end: '2026-09-14T10:30' })
  })

  it('옆 열로 끌면 날짜가 바뀐다', async () => {
    const { repo } = await renderGrid([meeting])
    await drag(block(), { x: 250, y: BLOCK_Y }) // 화요일 열
    expect(repo.events[0]).toMatchObject({ start: '2026-09-15T09:00', end: '2026-09-15T10:00' })
  })

  it('아래 끝 손잡이를 끌면 종료 시각만 바뀐다', async () => {
    const { repo } = await renderGrid([meeting])
    const handle = block().querySelector('[class*="resizeHandle"]') as HTMLElement
    await drag(handle, { x: BLOCK_X, y: 10 * HOUR_PX + 24 }, { x: BLOCK_X, y: 10 * HOUR_PX - 2 }) // +26px ≈ 30분
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14T09:00', end: '2026-09-14T10:30' })
  })

  it('조금만 움직이고 놓으면 그냥 클릭이라 저장하지 않고 편집기로 간다', async () => {
    const { repo, onSelectEvent } = await renderGrid([meeting])
    await drag(block(), { x: BLOCK_X + 2, y: BLOCK_Y + 2 })

    expect(repo.events[0]).toMatchObject(meeting)
    expect(onSelectEvent).toHaveBeenCalledTimes(1)
  })

  it('이동량이 15분 미만이면(같은 자리에 놓으면) 저장하지 않는다', async () => {
    const { repo } = await renderGrid([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    await drag(block(), { x: BLOCK_X, y: BLOCK_Y + 5 }) // 6.25분 → 0칸
    expect(update).not.toHaveBeenCalled()
  })

  it('끄는 동안 Esc를 누르면 취소되어 저장하지 않고, 뒤따르는 click도 막는다', async () => {
    const { repo, onSelectEvent } = await renderGrid([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    expect(document.querySelector('[class*="dragGhost"]')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument()
    fireEvent.pointerUp(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    fireEvent.click(block())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(update).not.toHaveBeenCalled()
    expect(onSelectEvent).not.toHaveBeenCalled()
  })

  it('끄는 동안 고스트에 옮겨질 시각을 보여 주고 원본은 흐리게 한다', async () => {
    await renderGrid([meeting])
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })

    expect(document.querySelector('[class*="dragGhost"]')).toHaveTextContent('10:00–11:00')
    expect(block().className).toContain('dragSource')
  })

  it('저장이 끝나면 일정이 새 위치에 그대로 있고 되돌릴 수 있다', async () => {
    const { repo } = await renderGrid([meeting])
    await drag(block(), { x: BLOCK_X, y: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(repo.events[0].start).toBe('2026-09-14T10:00')
  })
})

describe('TimeGridView 끌 수 없는 일정', () => {
  const cases: [string, CalendarEvent][] = [
    ['반복 일정', { ...meeting, recurrence: { freq: 'weekly', interval: 1 } }],
    ['함께(참여자 있는) 일정', { ...meeting, ownerId: 'u1', participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }],
    ['읽기 전용 공유 일정', { ...meeting, ownerId: 'someone-else' }],
  ]

  it.each(cases)('%s은 끌어도 바뀌지 않고, 손잡이도 없다', async (_name, event) => {
    const { repo } = await renderGrid([event])
    const update = vi.spyOn(repo, 'updateEvent')
    expect(block().querySelector('[class*="resizeHandle"]')).not.toBeInTheDocument()
    expect(block().className).not.toContain('draggable')

    await drag(block(), { x: BLOCK_X, y: BLOCK_Y + HOUR_PX })
    expect(update).not.toHaveBeenCalled()
  })

  it('하루를 넘기는 일정은 옮길 수는 있어도 길이 손잡이는 없다', async () => {
    await renderGrid([{ ...meeting, start: '2026-09-14T22:00', end: '2026-09-15T02:00' }])
    expect(block()).toHaveClass(/draggable/)
    expect(block().querySelector('[class*="resizeHandle"]')).not.toBeInTheDocument()
  })
})
