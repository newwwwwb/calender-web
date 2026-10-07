// 월·주 보기의 드래그·키보드 이동 테스트가 함께 쓰는 헬퍼: 뷰 렌더, 칩·블록 찾기, 포인터·키 입력, jsdom에 없는 레이아웃 스텁
// 주의: vi.mock·가짜 시계 설정은 vitest가 파일 단위로 다루므로 여기 두지 않는다(각 테스트 파일의 beforeEach·최상단에 남긴다)
import { act, render } from '@testing-library/react'
import { vi } from 'vitest'
import MonthView from '../components/MonthView'
import TimeGridView from '../components/TimeGridView'
import { CalendarProvider } from '../state/useCalendar'
import { ToastProvider } from '../state/useToast'
import type { CalendarEvent } from '../types'
import { FakeRepository } from './fakeRepository'

export const pointer = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'mouse' }

// 가짜 타이머를 ms만큼 진행(저장·재로드·애니메이션 정리가 끝나도록)
export const flush = (ms = 500) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

// 포커스된 요소에 Alt+키를 보낸다(수정자는 mods로 덮어쓴다). 반환한 이벤트로 defaultPrevented를 확인한다
export function press(el: HTMLElement, key: string, mods: { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true, ...mods })
  act(() => {
    el.dispatchEvent(event)
  })
  return event
}

// ── 월 보기 ─────────────────────────────────────────────────────────────────────────────────────

export const monthMeeting: CalendarEvent = { id: 'm', title: '회의', allDay: false, start: '2026-09-15T09:00', end: '2026-09-15T10:00' }

export async function renderMonth(events: CalendarEvent[], onSelectEvent = vi.fn()) {
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

// 칩 버튼(고스트는 div라 걸리지 않는다). 다일 종일 일정은 칸마다 조각이 있어 칸을 지정할 수 있다
export function chip(title: string, inCell?: string): HTMLElement {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => b.textContent === title && b.className.includes('chip'))
  const found = inCell ? candidates.find((b) => b.closest('[data-day-key]')?.getAttribute('data-day-key') === inCell) : candidates[0]
  if (!found) throw new Error(`칩 없음: ${title} ${inCell ?? ''}`)
  return found
}

// jsdom에는 elementFromPoint가 없다 — 포인터가 놓인 칸을 테스트가 정한다(고스트는 pointer-events:none이라 실제로는 칸이 잡힌다)
export function installElementFromPoint(getKey: () => string) {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => document.querySelector(`[data-day-key="${getKey()}"]`),
  })
}

export function removeElementFromPoint() {
  Reflect.deleteProperty(document, 'elementFromPoint')
}

// ── 주·일 보기 ───────────────────────────────────────────────────────────────────────────────────

export const DAYS = [new Date(2026, 8, 13), new Date(2026, 8, 14), new Date(2026, 8, 15)] // 일,월,화
export const COLUMN_WIDTH = 100
export const HOUR_PX = 48
// 월요일 열(x 100~200)의 9시 블록 안쪽 점
export const BLOCK_X = 150
export const BLOCK_Y = 9 * HOUR_PX + 10

export const weekMeeting: CalendarEvent = { id: 'm', title: '회의', allDay: false, start: '2026-09-14T09:00', end: '2026-09-14T10:00' } // 월요일 9~10시

// jsdom은 레이아웃이 없으니 스크롤 영역(top 0)과 각 열(폭 100, 왼쪽부터 0·100·200)의 사각형을 지어낸다(afterEach의 vi.restoreAllMocks로 원복)
export function installGridRects() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute('data-day-column')) {
      const index = Array.from(this.parentElement!.children).indexOf(this)
      const left = index * COLUMN_WIDTH
      return { left, right: left + COLUMN_WIDTH, top: 0, bottom: 1152, width: COLUMN_WIDTH, height: 1152, x: left, y: 0, toJSON() {} }
    }
    return { left: 0, right: 300, top: 0, bottom: 600, width: 300, height: 600, x: 0, y: 0, toJSON() {} }
  })
}

export async function renderGrid(events: CalendarEvent[], onSelectEvent = vi.fn(), days = DAYS) {
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
export const block = () => document.querySelector('button[class*="eventBlock"]') as HTMLElement
