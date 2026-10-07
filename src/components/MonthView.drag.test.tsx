// MonthView 드래그 이동: 일정 칩을 끌어 다른 날 칸에 놓아 날짜를 옮기고, 반복 범위·끌 수 없는 일정·취소·사라진 칩을 구분하는지 검증
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { ToastProvider } from '../state/useToast'
import { FakeRepository } from '../test/fakeRepository'
import type { CalendarEvent } from '../types'
import MonthView from './MonthView'

let hoverKey = '2026-09-15' // document.elementFromPoint 스텁이 돌려줄 칸

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15))
  // jsdom에는 elementFromPoint가 없다 — 포인터가 놓인 칸을 테스트가 정한다(고스트는 pointer-events:none이라 실제로는 칸이 잡힌다)
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => document.querySelector(`[data-day-key="${hoverKey}"]`),
  })
})

afterEach(() => {
  Reflect.deleteProperty(document, 'elementFromPoint')
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

const pointer = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'mouse' }
const meeting: CalendarEvent = { id: 'm', title: '회의', allDay: false, start: '2026-09-15T09:00', end: '2026-09-15T10:00' }

async function renderMonth(events: CalendarEvent[], onSelectEvent = vi.fn()) {
  const repo = new FakeRepository()
  repo.events.push(...events)
  render(
    <ToastProvider>
      <CalendarProvider repository={repo}>
        <MonthView onSelectEvent={onSelectEvent} />
      </CalendarProvider>
    </ToastProvider>,
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
  return { repo, onSelectEvent }
}

const flush = (ms = 500) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

// 칩 버튼(고스트는 div라 걸리지 않는다). 다일 종일 일정은 칸마다 조각이 있어 칸을 지정할 수 있다
function chip(title: string, inCell?: string): HTMLElement {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => b.textContent === title && b.className.includes('chip'))
  const found = inCell ? candidates.find((b) => b.closest('[data-day-key]')?.getAttribute('data-day-key') === inCell) : candidates[0]
  if (!found) throw new Error(`칩 없음: ${title} ${inCell ?? ''}`)
  return found
}

async function drag(el: HTMLElement, overKey: string) {
  hoverKey = el.closest('[data-day-key]')!.getAttribute('data-day-key')!
  fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
  hoverKey = overKey
  fireEvent.pointerMove(el, { ...pointer, clientX: 300, clientY: 100 })
  fireEvent.pointerUp(el, { ...pointer, clientX: 300, clientY: 100 })
  fireEvent.click(el) // 브라우저는 pointerup 직후 같은 턴에 click을 보낸다
  await flush(0)
}

describe('MonthView 칩 드래그', () => {
  it('다른 날 칸에 놓으면 날짜가 옮겨지고 시각은 그대로이며, 뒤따르는 click은 편집기를 열지 않는다', async () => {
    const { repo, onSelectEvent } = await renderMonth([meeting])
    await drag(chip('회의'), '2026-09-17')
    await flush()

    expect(repo.events[0]).toMatchObject({ start: '2026-09-17T09:00', end: '2026-09-17T10:00' })
    expect(onSelectEvent).not.toHaveBeenCalled()
  })

  it('끄는 동안 놓일 칸이 강조되고 원본 칩은 흐려지며 고스트가 제목을 보여 준다', async () => {
    await renderMonth([meeting])
    const el = chip('회의')
    hoverKey = '2026-09-15'
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    hoverKey = '2026-09-18'
    fireEvent.pointerMove(el, { ...pointer, clientX: 400, clientY: 100 })

    expect(document.querySelector('[data-day-key="2026-09-18"]')?.className).toContain('dropTarget')
    expect(document.querySelector('[data-day-key="2026-09-15"]')?.className).not.toContain('dropTarget') // 출발 칸은 강조하지 않는다
    expect(chip('회의', '2026-09-15').className).toContain('dragSource')
    expect(document.querySelector('[class*="dragGhost"]')).toHaveTextContent('회의')
    fireEvent.pointerUp(el, { ...pointer, clientX: 400, clientY: 100 })
  })

  it('여러 날에 걸친 종일 일정은 어느 조각을 끌어도 전체 기간이 같은 일수만큼 옮겨진다', async () => {
    const trip: CalendarEvent = { id: 't', title: '제주 여행', allDay: true, start: '2026-09-14', end: '2026-09-16' }
    const { repo } = await renderMonth([trip])
    await drag(chip('제주 여행', '2026-09-15'), '2026-09-18') // 가운데 조각(15일)을 18일로: +3일
    await flush()

    expect(repo.events[0]).toMatchObject({ start: '2026-09-17', end: '2026-09-19' })
  })

  it('같은 칸에 놓거나 칸 밖에 놓으면 저장하지 않는다', async () => {
    const { repo } = await renderMonth([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    await drag(chip('회의'), '2026-09-15')
    expect(update).not.toHaveBeenCalled()

    hoverKey = 'none'
    const el = chip('회의')
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(el, { ...pointer, clientX: 900, clientY: 900 })
    fireEvent.pointerUp(el, { ...pointer, clientX: 900, clientY: 900 })
    await flush()
    expect(update).not.toHaveBeenCalled()
  })

  it('조금만 움직이고 놓으면 그냥 클릭이라 편집기로 간다', async () => {
    const { repo, onSelectEvent } = await renderMonth([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = chip('회의')
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(el, { ...pointer, clientX: 102, clientY: 101 })
    fireEvent.pointerUp(el, { ...pointer, clientX: 102, clientY: 101 })
    fireEvent.click(el)

    expect(update).not.toHaveBeenCalled()
    expect(onSelectEvent).toHaveBeenCalledTimes(1)
  })

  it('끄는 동안 Esc를 누르면 취소되어 저장하지 않고 뒤따르는 click도 막는다', async () => {
    const { repo, onSelectEvent } = await renderMonth([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = chip('회의')
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    hoverKey = '2026-09-18'
    fireEvent.pointerMove(el, { ...pointer, clientX: 400, clientY: 100 })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument()
    fireEvent.pointerUp(el, { ...pointer, clientX: 400, clientY: 100 })
    fireEvent.click(el)
    await flush()

    expect(update).not.toHaveBeenCalled()
    expect(onSelectEvent).not.toHaveBeenCalled()
  })

  it('motion이 키보드 Enter에 지어내 보내는 pointerdown(pointerType 빈 값)은 드래그로 보지 않는다', async () => {
    await renderMonth([meeting])
    const el = chip('회의')
    fireEvent.pointerDown(el, { pointerId: 0, isPrimary: true, button: 0, pointerType: '', clientX: 100, clientY: 100 })
    hoverKey = '2026-09-18'
    fireEvent.pointerMove(el, { pointerId: 0, isPrimary: true, pointerType: '', clientX: 400, clientY: 100 })
    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument()
  })

  it('끄는 중에 일정이 지워져 칩이 사라지면 놓았을 때 저장 없이 끝나고 이유를 알린다', async () => {
    const { repo } = await renderMonth([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = chip('회의')
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    hoverKey = '2026-09-18'
    fireEvent.pointerMove(el, { ...pointer, clientX: 400, clientY: 100 })
    repo.events = []
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })
    for (let i = 0; i < 8; i++) await flush(100) // 사라지는 칩은 퇴장 애니메이션이 끝나야 DOM에서 빠진다
    fireEvent.pointerUp(document.body, { ...pointer, clientX: 10, clientY: 10 })

    expect(update).not.toHaveBeenCalled()
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
  })
})

describe('MonthView 반복 일정 드래그', () => {
  const weekly: CalendarEvent = { id: 'w', title: '요가', allDay: false, start: '2026-09-01T09:00', end: '2026-09-01T10:00', recurrence: { freq: 'weekly', interval: 1, byWeekday: [2] } } // 매주 화
  const sheet = () => screen.queryByRole('dialog', { name: '반복 일정 적용 범위' })

  it('놓으면 범위 시트를 열고 그동안 놓일 칸과 흐린 원본을 유지하며, 취소하면 아무것도 바꾸지 않는다', async () => {
    const { repo } = await renderMonth([weekly])
    const update = vi.spyOn(repo, 'updateEvent')
    await drag(chip('요가', '2026-09-15'), '2026-09-17')

    expect(sheet()).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
    expect(document.querySelector('[data-day-key="2026-09-17"]')?.className).toContain('dropTarget')
    expect(chip('요가', '2026-09-15').className).toContain('dragSource')
    expect(chip('요가', '2026-09-22').className).not.toContain('dragSource') // 다른 회차는 그대로

    fireEvent.click(screen.getByText('취소'))
    await flush()
    expect(update).not.toHaveBeenCalled()
    expect(document.querySelector('[data-day-key="2026-09-17"]')?.className).not.toContain('dropTarget')
  })

  it('"이 일정만": 그 회차를 제외하고 옮긴 날의 단발 일정을 만든다', async () => {
    const { repo } = await renderMonth([weekly])
    await drag(chip('요가', '2026-09-15'), '2026-09-17')
    fireEvent.click(screen.getByText('이 일정만'))
    await flush()

    expect(repo.events.find((e) => e.id === 'w')?.excludedDates).toEqual(['2026-09-15'])
    expect(repo.events.find((e) => e.id !== 'w')).toMatchObject({ start: '2026-09-17T09:00', title: '요가' })
    expect(repo.events.find((e) => e.id !== 'w')?.recurrence).toBeUndefined()
  })

  it('"모든 반복 일정": 요일이 같은 일수만큼 돌아가고 앵커가 옮겨진다', async () => {
    const { repo } = await renderMonth([weekly])
    await drag(chip('요가', '2026-09-15'), '2026-09-17') // 화 → 목(+2일)
    fireEvent.click(screen.getByText('모든 반복 일정'))
    await flush()

    expect(repo.events).toHaveLength(1)
    expect(repo.events[0]).toMatchObject({ start: '2026-09-03T09:00', recurrence: { byWeekday: [4] } })
  })

  it('매달 반복을 다른 달 칸으로 옮기면 이후·전체는 비활성이고 이 일정만 가능하다', async () => {
    const monthly: CalendarEvent = { id: 'mo', title: '월세', allDay: false, start: '2026-08-30T09:00', end: '2026-08-30T10:00', recurrence: { freq: 'monthly', interval: 1 } }
    await renderMonth([monthly])
    await drag(chip('월세', '2026-08-30'), '2026-09-02') // 8/30(이전 달 칸) → 9/2

    expect(screen.getByText('모든 반복 일정').closest('button')).toBeDisabled()
    expect(screen.getByText('이 일정과 이후 일정').closest('button')).toBeDisabled()
    expect(screen.getByText('이 일정만').closest('button')).toBeEnabled()
  })
})

// 29.R 지적: 칩이 퇴장 애니메이션 중일 때 놓으면 옛 렌더의 핸들러가 불려 눌렀을 때의 스냅숏 위에 저장하고 원격 수정을 덮었다
describe('MonthView 끄는 도중 원격 수정', () => {
  it('끄는 도중 다른 기기가 일정을 다른 날로 옮겨 칩이 퇴장 중일 때 놓으면, 원격 수정을 지우지 않고 저장하지 않는다', async () => {
    const { repo } = await renderMonth([{ ...meeting, memo: '원래' }])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = chip('회의')
    hoverKey = '2026-09-15'
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    hoverKey = '2026-09-17'
    fireEvent.pointerMove(el, { ...pointer, clientX: 300, clientY: 100 })
    repo.events = [{ ...meeting, title: '원격제목', memo: '원격메모', start: '2026-09-22T09:00', end: '2026-09-22T10:00' }]
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(50) // 옛 칩은 아직 퇴장 애니메이션 중
    })
    expect(el.isConnected).toBe(true)
    fireEvent.pointerUp(el, { ...pointer, clientX: 300, clientY: 100 })
    await flush()

    expect(update).not.toHaveBeenCalled()
    expect(repo.events[0]).toMatchObject({ title: '원격제목', memo: '원격메모', start: '2026-09-22T09:00' })
    expect(screen.getByText('다른 곳에서 바뀐 일정이라 옮기지 않았어요.')).toBeInTheDocument()
  })
})

describe('MonthView 함께 일정 드래그', () => {
  it('함께 일정도 날짜를 옮길 수 있고 참여자는 그대로다', async () => {
    const joint: CalendarEvent = { ...meeting, participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }
    const { repo } = await renderMonth([joint])
    await drag(chip('회의'), '2026-09-17')
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-17T09:00', participants: joint.participants })
  })

  it('함께 + 매달 반복을 다른 달로 옮기면 고를 범위가 없으므로 시트 대신 이유를 알린다', async () => {
    const joint: CalendarEvent = { id: 'jm', title: '정산', allDay: false, start: '2026-08-15T09:00', end: '2026-08-15T10:00', recurrence: { freq: 'monthly', interval: 1 }, participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }
    const { repo } = await renderMonth([joint])
    const update = vi.spyOn(repo, 'updateEvent')
    await drag(chip('정산', '2026-09-15'), '2026-09-30') // 같은 달이지만 30일 — 28일 넘음
    await flush()

    expect(screen.queryByText('모든 반복 일정')).not.toBeInTheDocument()
    expect(screen.getByText('함께하는 매달·매년 반복 일정은 같은 달 안(28일까지)에서만 옮길 수 있어요.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('함께 + 반복: 이 일정만·이후는 비활성이고 모든 반복 일정만 가능하다', async () => {
    const joint: CalendarEvent = { id: 'jw', title: '스터디', allDay: false, start: '2026-09-01T09:00', end: '2026-09-01T10:00', recurrence: { freq: 'weekly', interval: 1, byWeekday: [2] }, participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }
    await renderMonth([joint])
    await drag(chip('스터디', '2026-09-15'), '2026-09-17')

    expect(screen.getByText('이 일정만').closest('button')).toBeDisabled()
    expect(screen.getByText('이 일정과 이후 일정').closest('button')).toBeDisabled()
    expect(screen.getByText('모든 반복 일정').closest('button')).toBeEnabled()
  })
})

describe('MonthView 끌 수 없는 일정', () => {
  it('읽기 전용 공유 일정은 끌 수 없고 손 모양 커서도 없다', async () => {
    const { repo } = await renderMonth([{ ...meeting, ownerId: 'someone-else' }])
    const update = vi.spyOn(repo, 'updateEvent')
    expect(chip('회의').className).not.toContain('draggable')
    await drag(chip('회의'), '2026-09-17')
    await flush()
    expect(update).not.toHaveBeenCalled()
    expect(document.querySelector('[class*="dragGhost"]')).not.toBeInTheDocument()
  })

  it('내 일정은 종일이어도 끌 수 있다', async () => {
    await renderMonth([{ ...meeting, allDay: true, start: '2026-09-15', end: '2026-09-15' }])
    expect(chip('회의').className).toContain('draggable')
  })
})
