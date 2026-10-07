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

  it('함께 + 매달 반복을 같은 달 안에서 옮기면 함께 안내만 보이고 매달 문구는 붙지 않는다', async () => {
    const joint: CalendarEvent = { id: 'jm', title: '정산', allDay: false, start: '2026-08-15T09:00', end: '2026-08-15T10:00', recurrence: { freq: 'monthly', interval: 1 }, participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }
    await renderMonth([joint])
    await drag(chip('정산', '2026-09-15'), '2026-09-20')

    expect(screen.getByText('모든 반복 일정').closest('button')).toBeEnabled()
    expect(screen.getByText('이 일정만').closest('button')).toBeDisabled()
    expect(screen.getByText('함께하는 일정은 모든 반복 일정에만 적용할 수 있어요.')).toBeInTheDocument()
    expect(screen.queryByText(/매달·매년 반복은/)).not.toBeInTheDocument()
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

// 32단계: 종일 일정 칩 양끝 손잡이로 시작·끝 날을 끌어 기간을 바꾼다
describe('MonthView 종일 기간 조절', () => {
  const trip: CalendarEvent = { id: 't', title: '제주 여행', allDay: true, start: '2026-09-14', end: '2026-09-16' }
  const handle = (title: string, cell: string, edge: 'Start' | 'End') => chip(title, cell).querySelector<HTMLElement>(`[class*="resizeHandle${edge}"]`)!

  async function dragHandle(el: HTMLElement, fromKey: string, toKey: string) {
    hoverKey = fromKey
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    hoverKey = toKey
    fireEvent.pointerMove(el, { ...pointer, clientX: 300, clientY: 100 })
    fireEvent.pointerUp(el, { ...pointer, clientX: 300, clientY: 100 })
    fireEvent.click(el)
    await flush(0)
  }

  it('끝 조각의 오른쪽 손잡이를 끌면 끝 날이 늘고 줄며 시작은 그대로다', async () => {
    const { repo } = await renderMonth([trip])
    await dragHandle(handle('제주 여행', '2026-09-16', 'End'), '2026-09-16', '2026-09-19')
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14', end: '2026-09-19' })

    await dragHandle(handle('제주 여행', '2026-09-19', 'End'), '2026-09-19', '2026-09-15')
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14', end: '2026-09-15' })
  })

  it('시작 조각의 왼쪽 손잡이를 끌면 시작 날이 바뀌고 끝은 그대로다', async () => {
    const { repo } = await renderMonth([trip])
    await dragHandle(handle('제주 여행', '2026-09-14', 'Start'), '2026-09-14', '2026-09-11')
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-11', end: '2026-09-16' })
  })

  it('끝을 시작보다 앞으로, 시작을 끝보다 뒤로 끌면 하루로 고정된다(최소 하루)', async () => {
    const { repo } = await renderMonth([trip])
    await dragHandle(handle('제주 여행', '2026-09-16', 'End'), '2026-09-16', '2026-09-10')
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14', end: '2026-09-14' })
  })

  it('손잡이는 진짜 시작·끝 조각에만 있고 가운데 조각·시간 일정·읽기 전용 일정에는 없다', async () => {
    const timed: CalendarEvent = { ...meeting, id: 'tm' }
    const shared: CalendarEvent = { ...trip, id: 'ro', title: '남의 여행', ownerId: 'other' }
    await renderMonth([trip, timed, shared])
    expect(chip('제주 여행', '2026-09-14').querySelector('[class*="resizeHandleStart"]')).toBeInTheDocument()
    expect(chip('제주 여행', '2026-09-14').querySelector('[class*="resizeHandleEnd"]')).not.toBeInTheDocument()
    expect(chip('제주 여행', '2026-09-15').querySelector('[class*="resizeHandle"]')).not.toBeInTheDocument()
    expect(chip('제주 여행', '2026-09-16').querySelector('[class*="resizeHandleEnd"]')).toBeInTheDocument()
    expect(chip('회의').querySelector('[class*="resizeHandle"]')).not.toBeInTheDocument()
    expect(chip('남의 여행', '2026-09-14').querySelector('[class*="resizeHandle"]')).not.toBeInTheDocument()
  })

  it('하루짜리 종일 일정은 양쪽에 손잡이가 있다', async () => {
    await renderMonth([{ ...trip, end: '2026-09-14' }])
    const one = chip('제주 여행', '2026-09-14')
    expect(one.querySelector('[class*="resizeHandleStart"]')).toBeInTheDocument()
    expect(one.querySelector('[class*="resizeHandleEnd"]')).toBeInTheDocument()
  })

  it('끄는 동안 바뀔 기간 전체 칸이 강조되고 고스트가 기간을 보여 준다', async () => {
    await renderMonth([trip])
    const el = handle('제주 여행', '2026-09-16', 'End')
    hoverKey = '2026-09-16'
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    hoverKey = '2026-09-18'
    fireEvent.pointerMove(el, { ...pointer, clientX: 300, clientY: 100 })
    for (const key of ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']) {
      expect(document.querySelector(`[data-day-key="${key}"]`)?.className, key).toContain('dropTarget')
    }
    expect(document.querySelector('[data-day-key="2026-09-19"]')?.className).not.toContain('dropTarget')
    expect(document.querySelector('[class*="dragGhost"]')).toHaveTextContent('제주 여행 · 9/14–9/18')
    fireEvent.pointerUp(el, { ...pointer, clientX: 300, clientY: 100 })
  })

  it('같은 칸에 놓으면 저장하지 않고, 움직이지 않은 클릭은 편집기로 간다', async () => {
    const { repo, onSelectEvent } = await renderMonth([trip])
    const update = vi.spyOn(repo, 'updateEvent')
    await dragHandle(handle('제주 여행', '2026-09-16', 'End'), '2026-09-16', '2026-09-16')
    expect(update).not.toHaveBeenCalled()

    const el = handle('제주 여행', '2026-09-16', 'End')
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    fireEvent.pointerUp(el, { ...pointer, clientX: 100, clientY: 100 })
    fireEvent.click(el)
    expect(onSelectEvent).toHaveBeenCalledTimes(1)
  })

  it('끄는 동안 Esc를 누르면 취소되어 저장하지 않는다', async () => {
    const { repo } = await renderMonth([trip])
    const update = vi.spyOn(repo, 'updateEvent')
    const el = handle('제주 여행', '2026-09-16', 'End')
    hoverKey = '2026-09-16'
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    hoverKey = '2026-09-18'
    fireEvent.pointerMove(el, { ...pointer, clientX: 300, clientY: 100 })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(el, { ...pointer, clientX: 300, clientY: 100 })
    await flush()
    expect(update).not.toHaveBeenCalled()
  })

  it('반복 종일 일정은 범위 시트를 묻고, 이 일정만은 그 회차를 제외하고 늘어난 단발 일정을 만든다', async () => {
    const weekly: CalendarEvent = { ...trip, id: 'w', start: '2026-09-07', end: '2026-09-08', recurrence: { freq: 'weekly', interval: 1, byWeekday: [1] } } // 월~화, 매주
    const { repo } = await renderMonth([weekly])
    await dragHandle(handle('제주 여행', '2026-09-15', 'End'), '2026-09-15', '2026-09-17') // 9/14~15 회차의 끝을 17일로
    expect(screen.getByText('이 일정만')).toBeInTheDocument()
    fireEvent.click(screen.getByText('이 일정만'))
    await flush()

    expect(repo.events.find((e) => e.id === 'w')?.excludedDates).toContain('2026-09-14')
    expect(repo.events.some((e) => e.id !== 'w' && e.start === '2026-09-14' && e.end === '2026-09-17')).toBe(true)
  })

  it('반복 종일 일정의 모든 반복 일정은 시작을 두고 기간만 바꾼다', async () => {
    const weekly: CalendarEvent = { ...trip, id: 'w', start: '2026-09-07', end: '2026-09-08', recurrence: { freq: 'weekly', interval: 1, byWeekday: [1] } }
    const { repo } = await renderMonth([weekly])
    await dragHandle(handle('제주 여행', '2026-09-15', 'End'), '2026-09-15', '2026-09-17')
    fireEvent.click(screen.getByText('모든 반복 일정'))
    await flush()
    expect(repo.events).toHaveLength(1)
    expect(repo.events[0]).toMatchObject({ id: 'w', start: '2026-09-07', end: '2026-09-10' })
  })

  it('함께 종일 일정은 모든 반복 일정만 가능하고 일정이 단발이면 바로 저장되며 참여자는 그대로다', async () => {
    const joint: CalendarEvent = { ...trip, participants: [{ userId: 'u2', email: 'a@b.c', status: 'accepted' }] }
    const { repo } = await renderMonth([joint])
    await dragHandle(handle('제주 여행', '2026-09-16', 'End'), '2026-09-16', '2026-09-17')
    await flush()
    expect(repo.events[0]).toMatchObject({ end: '2026-09-17', participants: joint.participants })
  })
})

// 30단계: 끌기의 키보드 대안 — 칩에 포커스를 두고 Alt+방향키
describe('MonthView 키보드 이동', () => {
  const press = (el: HTMLElement, key: string, mods: { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean } = {}) => {
    const event = new KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true, ...mods })
    act(() => {
      el.dispatchEvent(event)
    })
    return event
  }

  // 옮기면 칩이 새로 만들어지고 포커스가 따라가므로, 이어지는 키는 포커스된 칩에 누른다(퇴장 중인 옛 칩이 아니라)
  const pressFocused = (key: string) => press(document.activeElement as HTMLElement, key)

  it('Alt+→는 하루 뒤로, Alt+↓는 일주일 뒤로 옮기고 시각은 그대로이며 브라우저 기본 동작은 막는다', async () => {
    const { repo } = await renderMonth([meeting])
    chip('회의').focus()
    const right = pressFocused('ArrowRight')
    expect(right.defaultPrevented).toBe(true)
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-16T09:00', end: '2026-09-16T10:00' })

    pressFocused('ArrowDown')
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-23T09:00', end: '2026-09-23T10:00' })
  })

  it('옮긴 뒤 새 위치의 칩에 포커스가 돌아온다', async () => {
    await renderMonth([meeting])
    chip('회의').focus()
    press(chip('회의'), 'ArrowRight')
    await flush()
    expect(document.activeElement).toHaveAttribute('data-event-start', '2026-09-16T09:00') // 퇴장 중인 옛 칩이 아니라 새 칩
    expect(document.activeElement?.closest('[data-day-key]')).toHaveAttribute('data-day-key', '2026-09-16')
  })

  it('다일 종일 일정은 어느 조각에서 눌러도 전체 기간이 함께 옮겨진다', async () => {
    const trip: CalendarEvent = { id: 't', title: '제주 여행', allDay: true, start: '2026-09-14', end: '2026-09-16' }
    const { repo } = await renderMonth([trip])
    press(chip('제주 여행', '2026-09-15'), 'ArrowRight')
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-15', end: '2026-09-17' })
  })

  it('Alt 없이 누르거나 Ctrl·Shift가 섞이면 아무 일도 없고 키를 가로채지 않는다', async () => {
    const { repo } = await renderMonth([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    expect(press(chip('회의'), 'ArrowRight', { altKey: false }).defaultPrevented).toBe(false)
    expect(press(chip('회의'), 'ArrowRight', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(press(chip('회의'), 'ArrowRight', { shiftKey: true }).defaultPrevented).toBe(false)
    await flush()
    expect(update).not.toHaveBeenCalled()
  })

  it('보이는 그리드 밖으로 나가는 이동은 하지 않는다', async () => {
    const last: CalendarEvent = { ...meeting, id: 'l', start: '2026-10-08T09:00', end: '2026-10-08T10:00' } // 9월 그리드의 마지막 줄(10/4~10/10)
    const { repo } = await renderMonth([last])
    const update = vi.spyOn(repo, 'updateEvent')
    press(chip('회의'), 'ArrowDown') // +7일 = 10/15
    await flush()
    expect(update).not.toHaveBeenCalled()
  })

  it('저장이 끝나기 전의 연타는 무시해 저장이 겹치지 않는다', async () => {
    const { repo } = await renderMonth([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    chip('회의').focus()
    pressFocused('ArrowRight')
    pressFocused('ArrowRight')
    pressFocused('ArrowRight')
    await flush()
    expect(update).toHaveBeenCalledTimes(1)
    expect(repo.events[0].start).toBe('2026-09-16T09:00')
    pressFocused('ArrowRight')
    await flush()
    expect(repo.events[0].start).toBe('2026-09-17T09:00')
  })

  // 32단계: 종일 칩의 Alt+Shift+←→는 끝 날을 ±1일(기간 조절)
  it('종일 칩에서 Alt+Shift+→는 끝 날을 하루 늘리고 Alt+Shift+←는 줄이되 시작 날 아래로는 줄지 않는다', async () => {
    const trip: CalendarEvent = { id: 't', title: '제주 여행', allDay: true, start: '2026-09-14', end: '2026-09-15' }
    const { repo } = await renderMonth([trip])
    const update = vi.spyOn(repo, 'updateEvent')
    const shift = (key: string) => {
      const event = new KeyboardEvent('keydown', { key, altKey: true, shiftKey: true, bubbles: true, cancelable: true })
      act(() => {
        ;(document.activeElement as HTMLElement).dispatchEvent(event)
      })
      return event
    }
    chip('제주 여행', '2026-09-15').focus()
    expect(shift('ArrowRight').defaultPrevented).toBe(true)
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14', end: '2026-09-16' })

    shift('ArrowLeft')
    await flush()
    shift('ArrowLeft')
    await flush()
    expect(repo.events[0]).toMatchObject({ start: '2026-09-14', end: '2026-09-14' })
    const calls = update.mock.calls.length
    shift('ArrowLeft') // 이미 하루라 더 줄지 않는다
    await flush()
    expect(update.mock.calls.length).toBe(calls)
  })

  // 32.R 지적: 반복 종일 일정의 기간을 키로 바꾸고 '이 일정만'·'이후'를 고르면 id·시작이 그대로라 퇴장 중인 옛 칩이 "이미 목표"로 판정돼 포커스를 잃었다
  it.each([['이 일정만'], ['이 일정과 이후 일정']])('반복 종일 일정의 기간을 키로 바꾸고 %s를 고르면 새 일정의 칩에 포커스가 돌아온다', async (label) => {
    const weekly: CalendarEvent = { id: 'w', title: '워크숍', allDay: true, start: '2026-09-07', end: '2026-09-08', recurrence: { freq: 'weekly', interval: 1, byWeekday: [1] } } // 월~화, 매주
    const { repo } = await renderMonth([weekly])
    chip('워크숍', '2026-09-15').focus() // 9/14~9/15 회차의 끝 조각
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true, bubbles: true, cancelable: true })
    act(() => {
      ;(document.activeElement as HTMLElement).dispatchEvent(event)
    })
    fireEvent.click(screen.getByText(label))
    await flush()

    expect(repo.events.some((e) => e.id !== 'w')).toBe(true) // 새 일정(단발 또는 새 시리즈)이 생겼다
    const active = document.activeElement as HTMLElement
    expect(active.dataset.eventId).not.toBe('w')
    expect(active.dataset.eventStart).toBe('2026-09-14')
    expect(active.isConnected).toBe(true)
  })

  it('시간 일정에서는 Alt+Shift+←→가 아무 일도 하지 않고 키를 가로채지 않는다', async () => {
    const { repo } = await renderMonth([meeting])
    const update = vi.spyOn(repo, 'updateEvent')
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true, bubbles: true, cancelable: true })
    act(() => {
      chip('회의').dispatchEvent(event)
    })
    await flush()
    expect(event.defaultPrevented).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('읽기 전용 공유 일정은 키로도 옮길 수 없고 키를 가로채지 않는다', async () => {
    const { repo } = await renderMonth([{ ...meeting, ownerId: 'other' }])
    const update = vi.spyOn(repo, 'updateEvent')
    expect(press(chip('회의'), 'ArrowRight').defaultPrevented).toBe(false)
    await flush()
    expect(update).not.toHaveBeenCalled()
  })

  it('반복 일정은 범위 시트를 열고, 시트가 열린 동안의 키는 무시하며, 고른 뒤 옮긴 칩에 포커스가 돌아온다', async () => {
    const weekly: CalendarEvent = { id: 'w', title: '요가', allDay: false, start: '2026-09-01T09:00', end: '2026-09-01T10:00', recurrence: { freq: 'weekly', interval: 1, byWeekday: [2] } }
    const { repo } = await renderMonth([weekly])
    const tue = chip('요가', '2026-09-15')
    tue.focus()
    press(tue, 'ArrowRight')
    expect(screen.getByText('이 일정만')).toBeInTheDocument()
    press(tue, 'ArrowRight') // 시트가 열려 있는 동안은 무시(칩은 그대로라 같은 칩에 누른다)
    fireEvent.click(screen.getByText('이 일정만'))
    await flush()

    expect(repo.events.some((e) => e.start === '2026-09-16T09:00')).toBe(true) // 이 일정만 → 새 단발 일정
    expect(document.activeElement).toHaveAttribute('data-event-start', '2026-09-16T09:00')
  })
})

// 29.R P2: 창 가장자리에서 고스트가 화면 밖으로 나가지 않는다
describe('MonthView 고스트 가장자리', () => {
  it('오른쪽 끝 가까이에서는 고스트가 포인터 왼쪽으로 뒤집힌다', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(24)
    await renderMonth([meeting])
    const el = chip('회의')
    fireEvent.pointerDown(el, { ...pointer, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(el, { ...pointer, clientX: window.innerWidth - 10, clientY: 100 })
    const ghost = document.querySelector<HTMLElement>('[class*="dragGhost"]')!
    expect(ghost.style.transform).toBe(`translate(${window.innerWidth - 10 - 14 - 100}px, 114px)`)
    fireEvent.pointerUp(el, { ...pointer, clientX: window.innerWidth - 10, clientY: 100 })
    vi.restoreAllMocks()
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
