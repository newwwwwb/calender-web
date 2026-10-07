// TimeGridView 드래그 편집: 마우스로 시간 블록을 끌어 옮기거나 아래 끝을 끌어 길이를 바꾸고, 클릭·취소·끌 수 없는 일정을 구분하는지 검증
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { ToastProvider } from '../state/useToast'
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

async function renderGrid(events: CalendarEvent[], onSelectEvent = vi.fn(), days = DAYS) {
  const repo = new FakeRepository()
  repo.events.push(...events)
  render(
    <ToastProvider>
      <CalendarProvider repository={repo}>
        <TimeGridView days={days} onSelectEvent={onSelectEvent} />
      </CalendarProvider>
    </ToastProvider>,
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

// 27단계 승인 심사에서 재현된 결함들
describe('TimeGridView 드래그 안정성', () => {
  it('motion이 키보드 Enter에 지어내 보내는 pointerdown(pointerType 빈 값)은 드래그로 보지 않는다', async () => {
    await renderGrid([meeting])
    // setPointerCapture가 NotFoundError를 던지던 경로 — 가짜 이벤트는 세션을 만들지 않아야 한다
    fireEvent.pointerDown(block(), { pointerId: 0, isPrimary: true, button: 0, pointerType: '', clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { pointerId: 0, isPrimary: true, pointerType: '', clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument()
  })

  it('블록이 놓기를 못 받아도(재로드로 사라짐 등) window 예비 리스너가 세션을 끝내 다음 드래그가 된다', async () => {
    const second: CalendarEvent = { id: 'n', title: '다음', allDay: false, start: '2026-09-15T14:00', end: '2026-09-15T15:00' }
    const { repo } = await renderGrid([meeting, second])
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    expect(document.querySelector('[class*="dragGhost"]')).toBeInTheDocument()

    fireEvent.pointerUp(document.body, { ...pointer, clientX: 10, clientY: 10 }) // 블록이 아닌 곳에서 놓임
    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument()
    expect(repo.events.find((e) => e.id === 'm')?.start).toBe('2026-09-14T09:00') // 저장하지 않는다

    const other = Array.from(document.querySelectorAll('button[class*="eventBlock"]')).find((b) => b.textContent?.includes('다음')) as HTMLElement
    fireEvent.pointerDown(other, { ...pointer, clientX: 250, clientY: 14 * HOUR_PX + 10 })
    fireEvent.pointerMove(other, { ...pointer, clientX: 250, clientY: 14 * HOUR_PX + 10 + HOUR_PX })
    expect(document.querySelector('[class*="dragGhost"]')).toBeInTheDocument()
  })

  it('끄는 동안 다른 기기가 바꾼 제목이 재로드돼도, 놓을 때 최신 일정 위에 시간만 덮는다', async () => {
    const { repo } = await renderGrid([meeting])
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    repo.events = [{ ...meeting, title: '회의(수정됨)' }] // 다른 기기에서 제목을 고친 뒤
    await act(async () => {
      window.dispatchEvent(new Event('focus')) // 창으로 돌아오며 재로드
      await vi.advanceTimersByTimeAsync(0)
    })
    fireEvent.pointerUp(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(repo.events[0]).toMatchObject({ title: '회의(수정됨)', start: '2026-09-14T10:00' })
  })

  it('끄는 도중 다른 기기가 일정을 바꿔 블록이 퇴장 중일 때 놓아도, 최신 제목·메모 위에 시간만 덮는다(옛 스냅숏으로 덮지 않는다)', async () => {
    const { repo } = await renderGrid([{ ...meeting, memo: '원래' }])
    const el = block()
    fireEvent.pointerDown(el, { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(el, { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    repo.events = [{ ...meeting, title: '원격제목', memo: '원격메모', start: '2026-09-15T09:00', end: '2026-09-15T10:00' }] // 다른 날로 옮겨 옛 블록이 퇴장
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(50)
    })
    expect(el.isConnected).toBe(true)
    fireEvent.pointerUp(el, { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(repo.events[0]).toMatchObject({ title: '원격제목', memo: '원격메모' })
  })

  it('저장이 실패하면 새 위치에 남지 않고 원래 자리로 돌아온다', async () => {
    const { repo } = await renderGrid([meeting])
    vi.spyOn(repo, 'updateEvent').mockRejectedValue(new Error('network'))
    await drag(block(), { x: BLOCK_X, y: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(repo.events[0].start).toBe('2026-09-14T09:00')
  })

  it('끄는 중에 일정이 지워져 블록이 사라지면, 놓았을 때 저장 없이 끝나고 이유를 알린다', async () => {
    const { repo } = await renderGrid([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    repo.events = []
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })
    // 사라지는 블록은 퇴장 애니메이션이 끝나야 DOM에서 빠진다 — 한 번에 길게 흘리면 끝나지 않아 나눠서 흘린다
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
    }
    expect(document.querySelector('button[class*="eventBlock"]')).not.toBeInTheDocument() // 블록이 사라졌다
    fireEvent.pointerUp(document.body, { ...pointer, clientX: 10, clientY: 10 }) // 블록이 없으니 놓기는 window로 간다

    expect(update).not.toHaveBeenCalled()
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
  })

  it('Esc로 취소한 드래그는 이유 토스트를 띄우지 않는다', async () => {
    await renderGrid([meeting])
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(document.body, { ...pointer, clientX: 10, clientY: 10 })
    expect(screen.queryByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).not.toBeInTheDocument()
  })

  it('끄는 동안 다른 기기에서 내가 수정할 수 없는 일정(남의 함께 일정)으로 바뀌면 놓아도 저장하지 않는다(드래그 규칙 재적용)', async () => {
    const { repo } = await renderGrid([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    repo.events = [{ ...meeting, ownerId: 'u1', participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }]
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })
    fireEvent.pointerUp(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(update).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument() // 범위 시트도 뜨지 않는다
    // 말없이 원위치로 돌아가지 않고 이유를 알려 준다
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
    expect(repo.events[0].start).toBe('2026-09-14T09:00')
  })

  it('고스트의 "–끝 시각"은 줄바꿈 없는 조각이라 좁은 열에서 "–"만 한 줄을 차지하지 않는다', async () => {
    await renderGrid([meeting])
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    const noWrap = document.querySelector('[class*="ghostTime"] [class*="noWrap"]')
    expect(noWrap).toHaveTextContent('–11:00')
  })

  it('짧은 일정 길이 조절 중 고스트에 시작과 끝 시각이 한 요소로 함께 있다(좁은 열에서만 줄바꿈)', async () => {
    await renderGrid([{ ...meeting, end: '2026-09-14T09:15' }])
    const handle = block().querySelector('[class*="resizeHandle"]') as HTMLElement
    fireEvent.pointerDown(handle, { ...pointer, clientX: BLOCK_X, clientY: 9 * HOUR_PX + 11 })
    fireEvent.pointerMove(handle, { ...pointer, clientX: BLOCK_X, clientY: 9 * HOUR_PX + 11 + 12 }) // +15분
    const time = document.querySelector('[class*="ghostTime"]') as HTMLElement
    expect(time).toHaveTextContent('09:00–09:30')
    expect(time.querySelector('wbr')).toBeInTheDocument()
  })
})

describe('TimeGridView 터치 길게 누르기', () => {
  const touch = { pointerId: 2, isPrimary: true, button: 0, pointerType: 'touch' }

  it('길게 누른 뒤 끌면 옮겨지고, 그 전의 짧은 터치는 평소처럼 클릭이다', async () => {
    const { repo, onSelectEvent } = await renderGrid([meeting])
    fireEvent.pointerDown(block(), { ...touch, clientX: BLOCK_X, clientY: BLOCK_Y })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450)
    })
    expect(document.querySelector('[class*="dragGhost"]')).toBeInTheDocument()
    fireEvent.pointerMove(block(), { ...touch, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    fireEvent.pointerUp(block(), { ...touch, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14T10:00', end: '2026-09-14T11:00' })
    expect(onSelectEvent).not.toHaveBeenCalled()
  })

  it('길게 누르기 전에 손가락이 움직이면(스크롤·스와이프) 드래그가 시작되지 않는다', async () => {
    const { repo } = await renderGrid([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    fireEvent.pointerDown(block(), { ...touch, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...touch, clientX: BLOCK_X, clientY: BLOCK_Y + 30 })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    fireEvent.pointerMove(block(), { ...touch, clientX: BLOCK_X, clientY: BLOCK_Y + 60 })
    fireEvent.pointerUp(block(), { ...touch, clientX: BLOCK_X, clientY: BLOCK_Y + 60 })

    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('길게 눌러 드래그 중에는 터치로 화면이 스크롤되지 않게 touchmove를 막는다', async () => {
    await renderGrid([meeting])
    fireEvent.pointerDown(block(), { ...touch, clientX: BLOCK_X, clientY: BLOCK_Y })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450)
    })
    const move = new Event('touchmove', { cancelable: true, bubbles: true })
    document.dispatchEvent(move)
    expect(move.defaultPrevented).toBe(true)
  })
})

describe('TimeGridView 자동 스크롤', () => {
  it('끄는 포인터가 아래 가장자리에 있으면 손을 멈춰도 계속 스크롤하고, 놓으면 멈춘다', async () => {
    await renderGrid([meeting])
    const scrollArea = document.querySelector('[class*="scrollArea"]') as HTMLElement
    scrollArea.scrollTop = 0
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: 595 }) // 스크롤 영역(0~600) 아래 가장자리
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(scrollArea.scrollTop).toBeGreaterThan(30)

    fireEvent.pointerUp(block(), { ...pointer, clientX: BLOCK_X, clientY: 595 })
    const stopped = scrollArea.scrollTop
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(scrollArea.scrollTop).toBe(stopped)
  })

  it('스크롤된 만큼 시각도 따라 바뀐다(놓으면 새 일정 시각이 스크롤 거리를 반영)', async () => {
    const { repo } = await renderGrid([meeting])
    const scrollArea = document.querySelector('[class*="scrollArea"]') as HTMLElement
    scrollArea.scrollTop = 0
    fireEvent.pointerDown(block(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(block(), { ...pointer, clientX: BLOCK_X, clientY: 595 })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    fireEvent.pointerUp(block(), { ...pointer, clientX: BLOCK_X, clientY: 595 })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    // 포인터 이동(595-442=153px)에 스크롤 거리가 더해진 만큼 늦은 시각이 된다
    const movedMinutes = ((595 - BLOCK_Y + scrollArea.scrollTop) / HOUR_PX) * 60
    const start = repo.events[0].start
    const startMinutes = Number(start.slice(11, 13)) * 60 + Number(start.slice(14, 16))
    expect(Math.abs(startMinutes - (9 * 60 + movedMinutes))).toBeLessThanOrEqual(8)
  })
})

describe('TimeGridView 위쪽 끝 길이 조절', () => {
  it('위쪽 손잡이를 위로 끌면 시작 시각만 바뀐다', async () => {
    const { repo } = await renderGrid([meeting])
    const top = block().querySelector('[class*="resizeTopHandle"]') as HTMLElement
    await drag(top, { x: BLOCK_X, y: 9 * HOUR_PX + 2 - 24 }, { x: BLOCK_X, y: 9 * HOUR_PX + 2 }) // 위로 24px = 30분
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14T08:30', end: '2026-09-14T10:00' })
  })

  it('아래로 끌어도 종료 15분 전까지만 줄어든다', async () => {
    const { repo } = await renderGrid([meeting])
    const top = block().querySelector('[class*="resizeTopHandle"]') as HTMLElement
    await drag(top, { x: BLOCK_X, y: 9 * HOUR_PX + 2 + 300 }, { x: BLOCK_X, y: 9 * HOUR_PX + 2 })
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14T09:45', end: '2026-09-14T10:00' })
  })

  it('짧은 블록(24px 미만)에는 위쪽 손잡이가 없고, 하루를 넘기는 일정에도 없다', async () => {
    await renderGrid([{ ...meeting, end: '2026-09-14T09:15' }])
    expect(block().querySelector('[class*="resizeTopHandle"]')).not.toBeInTheDocument()
    expect(block().querySelector('[class*="resizeHandle"]')).toBeInTheDocument() // 아래 손잡이는 그대로
  })
})

describe('TimeGridView 반복 일정 드래그', () => {
  // 매일 9~10시(9/13부터) — 세 열에 모두 회차가 있다. 가운데 열(월 9/14) 회차를 끈다
  const daily: CalendarEvent = { ...meeting, id: 'd', start: '2026-09-13T09:00', end: '2026-09-13T10:00', recurrence: { freq: 'daily', interval: 1 } }
  const mondayBlock = () => document.querySelectorAll('button[class*="eventBlock"]')[1] as HTMLElement

  async function dropMonday(repo: FakeRepository) {
    void repo
    fireEvent.pointerDown(mondayBlock(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(mondayBlock(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    fireEvent.pointerUp(mondayBlock(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it('놓으면 바로 저장하지 않고 범위 시트를 연다. 그동안 고스트가 새 자리에 남는다', async () => {
    const { repo } = await renderGrid([daily])
    const update = vi.spyOn(repo, 'updateEvent')
    await dropMonday(repo)

    expect(screen.getByRole('dialog', { name: '반복 일정 적용 범위' })).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
    expect(document.querySelector('[class*="dragGhost"]')).toHaveTextContent('10:00–11:00')
    // 끌고 있는 그 회차만 흐려지고 다른 날 회차는 그대로
    const blocks = Array.from(document.querySelectorAll('button[class*="eventBlock"]'))
    expect(blocks.map((b) => b.className.includes('dragSource'))).toEqual([false, true, false])
  })

  it('취소하면 아무것도 바꾸지 않고 고스트도 사라진다', async () => {
    const { repo } = await renderGrid([daily])
    const update = vi.spyOn(repo, 'updateEvent')
    await dropMonday(repo)
    fireEvent.click(screen.getByText('취소'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(update).not.toHaveBeenCalled()
    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument()
    expect(repo.events[0]).toMatchObject(daily)
  })

  it('"이 일정만": 그 회차만 제외하고 옮긴 시각의 단발 일정을 만든다', async () => {
    const { repo } = await renderGrid([daily])
    await dropMonday(repo)
    fireEvent.click(screen.getByText('이 일정만'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(repo.events).toHaveLength(2)
    expect(repo.events.find((e) => e.id === 'd')?.excludedDates).toEqual(['2026-09-14'])
    expect(repo.events.find((e) => e.id !== 'd')).toMatchObject({ start: '2026-09-14T10:00', end: '2026-09-14T11:00', title: '회의' })
    expect(repo.events.find((e) => e.id !== 'd')?.recurrence).toBeUndefined()
    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument() // 저장이 끝나면 고스트 해제
  })

  it('"이 일정과 이후 일정": 원본은 전날까지로 자르고 옮긴 시각부터 새 시리즈를 만든다', async () => {
    const { repo } = await renderGrid([daily])
    await dropMonday(repo)
    fireEvent.click(screen.getByText('이 일정과 이후 일정'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(repo.events.find((e) => e.id === 'd')?.recurrence?.until).toBe('2026-09-13')
    expect(repo.events.find((e) => e.id !== 'd')).toMatchObject({ start: '2026-09-14T10:00', recurrence: { freq: 'daily' } })
  })

  it('"모든 반복 일정": 시리즈 앵커가 옮긴 만큼만 움직인다', async () => {
    const { repo } = await renderGrid([daily])
    await dropMonday(repo)
    fireEvent.click(screen.getByText('모든 반복 일정'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(repo.events).toHaveLength(1)
    expect(repo.events[0]).toMatchObject({ id: 'd', start: '2026-09-13T10:00', end: '2026-09-13T11:00' })
  })
})

// 28단계 승인 심사에서 재현된 결함들
describe('TimeGridView 반복 일정 시트가 열린 동안의 변경', () => {
  const daily: CalendarEvent = { id: 'd', title: '요가', memo: '원본', allDay: false, start: '2026-09-13T09:00', end: '2026-09-13T10:00', recurrence: { freq: 'daily', interval: 1 } }
  const mondayBlock = () => document.querySelectorAll('button[class*="eventBlock"]')[1] as HTMLElement

  async function openSheet() {
    const { repo } = await renderGrid([daily])
    fireEvent.pointerDown(mondayBlock(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(mondayBlock(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    fireEvent.pointerUp(mondayBlock(), { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByRole('dialog', { name: '반복 일정 적용 범위' })).toBeInTheDocument()
    return repo
  }

  async function remoteChange(repo: FakeRepository, events: CalendarEvent[]) {
    repo.events = events
    await act(async () => {
      window.dispatchEvent(new Event('focus')) // 다른 기기에서 바뀐 뒤 창으로 돌아와 재로드
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  const choose = async (label: string) => {
    fireEvent.click(screen.getByText(label))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
  }

  it('시트가 열린 동안 다른 기기가 제목·메모를 고쳤으면 그 수정을 지우지 않고 시간만 바꾼다', async () => {
    const repo = await openSheet()
    await remoteChange(repo, [{ ...daily, title: '필라테스', memo: '원격수정' }])
    await choose('모든 반복 일정')

    expect(repo.events[0]).toMatchObject({ title: '필라테스', memo: '원격수정', start: '2026-09-13T10:00' })
  })

  it('시트가 열린 동안 일정이 지워졌으면 저장하지 않고 이유를 알린다', async () => {
    const repo = await openSheet()
    const update = vi.spyOn(repo, 'updateEvent')
    const add = vi.spyOn(repo, 'addEvent')
    await remoteChange(repo, [])
    await choose('이 일정만')

    expect(update).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument()
  })

  it('시트가 열린 동안 함께 일정으로 바뀌거나 시간이 바뀌었으면 저장하지 않는다', async () => {
    for (const changed of [
      { ...daily, ownerId: 'u1', participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' as const }] },
      { ...daily, start: '2026-09-13T11:00', end: '2026-09-13T12:00' },
    ]) {
      const repo = await openSheet()
      const update = vi.spyOn(repo, 'updateEvent')
      await remoteChange(repo, [changed])
      await choose('모든 반복 일정')
      expect(update).not.toHaveBeenCalled()
      cleanup()
    }
  })
})

describe('TimeGridView 달마다 없는 날로 옮기는 매달 반복', () => {
  // 매달 29일 9시. 9/28~9/30 보기에서 29일(가운데 열) 회차를 30일(오른쪽 열)로 옮긴다 — 30일 없는 달(2월) 회차가 사라지는 이동
  const monthly29: CalendarEvent = { id: 'm29', title: '월세', allDay: false, start: '2026-08-29T09:00', end: '2026-08-29T10:00', recurrence: { freq: 'monthly', interval: 1 } }
  const lateDays = [new Date(2026, 8, 28), new Date(2026, 8, 29), new Date(2026, 8, 30)]

  it('"이 일정과 이후 일정"·"모든 반복 일정"은 비활성이고 안내가 보이며, "이 일정만"은 가능하다', async () => {
    const { repo } = await renderGrid([monthly29], vi.fn(), lateDays)
    const block = document.querySelector('button[class*="eventBlock"]') as HTMLElement
    fireEvent.pointerDown(block, { ...pointer, clientX: 150, clientY: BLOCK_Y })
    fireEvent.pointerMove(block, { ...pointer, clientX: 250, clientY: BLOCK_Y })
    fireEvent.pointerUp(block, { ...pointer, clientX: 250, clientY: BLOCK_Y })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByText('모든 반복 일정').closest('button')).toBeDisabled()
    expect(screen.getByText('이 일정과 이후 일정').closest('button')).toBeDisabled()
    expect(screen.getByText('이 일정만').closest('button')).toBeEnabled()
    expect(screen.getByText(/같은 달 안\(28일까지\)에서만/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('이 일정만'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(repo.events.find((e) => e.id !== 'm29')).toMatchObject({ start: '2026-09-30T09:00' })
  })
})

// 29단계: 함께 일정도 편집기와 같은 권한이면 끌 수 있다(서버가 참여자에게 알림). 로컬 모드에선 ownerId가 없어 내 일정으로 본다
describe('TimeGridView 함께 일정 드래그', () => {
  const jointMeeting: CalendarEvent = { ...meeting, participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }

  it('함께 일정도 끌어서 시간을 옮길 수 있고 참여자는 그대로다', async () => {
    const { repo } = await renderGrid([jointMeeting])
    await drag(block(), { x: BLOCK_X, y: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14T10:00', end: '2026-09-14T11:00', participants: jointMeeting.participants })
  })

  it('함께 + 반복: 범위 시트에서 이 일정만·이후는 비활성이고 안내가 보이며, 모든 반복 일정은 참여자를 유지한 채 저장된다', async () => {
    const jointDaily: CalendarEvent = { ...jointMeeting, id: 'jd', start: '2026-09-13T09:00', end: '2026-09-13T10:00', recurrence: { freq: 'daily', interval: 1 } }
    const { repo } = await renderGrid([jointDaily])
    const monday = document.querySelectorAll('button[class*="eventBlock"]')[1] as HTMLElement
    fireEvent.pointerDown(monday, { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y })
    fireEvent.pointerMove(monday, { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    fireEvent.pointerUp(monday, { ...pointer, clientX: BLOCK_X, clientY: BLOCK_Y + HOUR_PX })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByText('이 일정만').closest('button')).toBeDisabled()
    expect(screen.getByText('이 일정과 이후 일정').closest('button')).toBeDisabled()
    expect(screen.getByText('모든 반복 일정').closest('button')).toBeEnabled()
    expect(screen.getByText(/함께하는 일정은 모든 반복 일정에만/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('모든 반복 일정'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(repo.events).toHaveLength(1)
    expect(repo.events[0]).toMatchObject({ id: 'jd', start: '2026-09-13T10:00', participants: jointDaily.participants })
  })
})

describe('TimeGridView 끌 수 없는 일정', () => {
  const cases: [string, CalendarEvent][] = [
    ['남의 함께 일정(내가 수락한 참여자가 아님)', { ...meeting, ownerId: 'u1', participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }],
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
