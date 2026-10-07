// 주·일 보기 시간 블록 드래그 편집(이동·길이 조절)의 순수 계산 — 화면 좌표 → 새 start/end 문자열
import { addDays, addMinutes, differenceInCalendarDays, differenceInMinutes } from 'date-fns'
import type { CalendarEvent, ID } from '../types'
import { parseDateKey, parseDateTimeKey, toDateKey, toDateTimeKey } from './date'
import { canEdit } from './together'

// 저장 없이 원위치로 돌아갈 때 이유를 알리는 문구 — 말없이 돌아가면 무슨 일인지 알 수 없다(주·일·월 드래그 공통)
export const DRAG_BLOCKED_MESSAGE = '다른 곳에서 바뀐 일정이라 옮기지 않았어요.'

export const SNAP_MINUTES = 15
export const MIN_DURATION_MINUTES = 15
const DAY_MINUTES = 24 * 60

// 날짜·시간을 끌어 옮길 수 있는 일정인가(주·일의 시간 블록과 월의 칩이 같이 쓴다). 편집기와 같은 권한 — 내 일정, 또는 수락한 함께 일정.
// 읽기 전용 공유 일정·아직 응답하지 않은 초대는 못 옮긴다. 함께 일정의 시간이 바뀌면 서버 트리거(events_notify_updated)가 참여자에게 알림을 보낸다.
// 반복 일정은 놓을 때 범위를 묻는다(함께 일정은 시리즈 전체만 — isScopeSafe)
export function canMoveEvent(event: CalendarEvent, uid: ID | undefined): boolean {
  return canEdit(event, uid)
}

// 주·일 보기의 시간 블록은 종일이 아닌 일정만(종일은 위쪽 종일 줄에 있어 시간 축으로 옮길 수 없다)
export function isBlockDraggable(event: CalendarEvent, uid: ID | undefined): boolean {
  return !event.allDay && canMoveEvent(event, uid)
}

// 시작·끝을 같은 일수만큼 옮긴다(월 보기에서 다른 날 칸에 놓았을 때). 시간 일정은 시각을 유지하고, 종일은 날짜 키 그대로. 끝이 다른 날인 일정도 같이 옮겨진다
export function shiftByDays(start: string, end: string, dayDelta: number): { start: string; end: string } {
  const shift = (key: string) => (key.includes('T') ? toDateTimeKey(addDays(parseDateTimeKey(key), dayDelta)) : toDateKey(addDays(parseDateKey(key), dayDelta)))
  return { start: shift(start), end: shift(end) }
}

// 종일 일정의 한쪽 끝(시작 또는 끝 날)을 dayDelta일 옮겨 기간을 늘이거나 줄인다(월 보기 칩 양끝 드래그·키보드). 끝 ≥ 시작(최소 하루)으로 가둔다 —
// 시작을 끝 뒤로 끌면 끝에, 끝을 시작 앞으로 끌면 시작에 붙는다. 종일 키('YYYY-MM-DD')는 사전순이 날짜순이라 문자열로 비교한다
export function resizeDays(start: string, end: string, edge: 'start' | 'end', dayDelta: number): { start: string; end: string } {
  const moved = shiftByDays(edge === 'end' ? end : start, edge === 'end' ? end : start, dayDelta).start
  if (edge === 'end') return { start, end: moved < start ? start : moved }
  return { start: moved > end ? end : moved, end }
}

function minutesOfDay(dateTimeKey: string): number {
  const [h, m] = dateTimeKey.slice(11, 16).split(':').map(Number)
  return h * 60 + m
}

// 종료 시각이 시작한 날 0시부터 몇 분째인지. 24시에 끝나는 일정(다음 날 00:00)은 1440이라 "같은 날"로 본다
function endMinutesFromStartDay(start: string, end: string): number {
  return differenceInCalendarDays(parseDateKey(end.slice(0, 10)), parseDateKey(start.slice(0, 10))) * DAY_MINUTES + minutesOfDay(end)
}

// 하루를 넘기는 일정은 실제 종료가 다른 날이라 블록 아래 끝이 진짜 끝이 아니다 — 길이 조절은 그 날 24시까지 끝나는 일정만
export function canResizeBlock(start: string, end: string): boolean {
  return endMinutesFromStartDay(start, end) <= DAY_MINUTES
}

// 이동량을 15분 단위로 맞춘다(원래 시각이 05:50이면 05:50 → 06:05처럼 어긋남을 유지해, 살짝 끌었다고 시각이 바뀌지 않게)
export function snapDelta(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

function withMinutes(dayKey: string, minutes: number): Date {
  return addMinutes(parseDateKey(dayKey), minutes)
}

// 블록을 옮긴다. 길이는 유지하고, 시작은 targetDayKey 날의 0시~(24시 - 길이) 안으로 가둔다(하루를 넘기는 일정은 23:45까지).
export function moveBlock(start: string, end: string, deltaMinutes: number, targetDayKey: string): { start: string; end: string } {
  const duration = differenceInMinutes(parseDateTimeKey(end), parseDateTimeKey(start))
  const maxStart = canResizeBlock(start, end) ? Math.max(DAY_MINUTES - duration, 0) : DAY_MINUTES - SNAP_MINUTES
  const startMin = Math.min(Math.max(minutesOfDay(start) + snapDelta(deltaMinutes), 0), maxStart)
  const newStart = withMinutes(targetDayKey, startMin)
  return { start: toDateTimeKey(newStart), end: toDateTimeKey(addMinutes(newStart, duration)) }
}

// 아래 끝을 끌어 종료 시각을 바꾼다. 최소 15분, 그 날 24시까지. 같은 날 일정이 아니면 그대로 돌려준다.
export function resizeBlock(start: string, end: string, deltaMinutes: number): { start: string; end: string } {
  if (!canResizeBlock(start, end)) return { start, end }
  const startMin = minutesOfDay(start)
  const endMin = Math.min(Math.max(endMinutesFromStartDay(start, end) + snapDelta(deltaMinutes), startMin + MIN_DURATION_MINUTES), DAY_MINUTES)
  return { start, end: toDateTimeKey(withMinutes(start.slice(0, 10), endMin)) }
}

// 위쪽 끝을 끌어 시작 시각을 바꾼다. 종료는 그대로, 시작은 0시 ~ (종료 - 15분). 같은 날 일정이 아니면 그대로 돌려준다.
export function resizeBlockStart(start: string, end: string, deltaMinutes: number): { start: string; end: string } {
  if (!canResizeBlock(start, end)) return { start, end }
  const startMin = Math.min(Math.max(minutesOfDay(start) + snapDelta(deltaMinutes), 0), endMinutesFromStartDay(start, end) - MIN_DURATION_MINUTES)
  return { start: toDateTimeKey(withMinutes(start.slice(0, 10), startMin)), end }
}

// x 좌표가 속한 열의 번호(각 열의 left/right). 어느 열도 아니면 가장 가까운 끝 열
export function columnAtX(x: number, columns: { left: number; right: number }[]): number {
  const found = columns.findIndex((c) => x >= c.left && x < c.right)
  if (found >= 0) return found
  return x < columns[0].left ? 0 : columns.length - 1
}

const EDGE_PX = 40
const MAX_SCROLL_SPEED = 14 // px/프레임

// 드래그 중 포인터가 스크롤 영역 위·아래 가장자리에 가까울수록 빠르게 스크롤한다(음수 = 위로)
export function autoScrollSpeed(pointerY: number, top: number, bottom: number): number {
  if (pointerY < top + EDGE_PX) return -MAX_SCROLL_SPEED * Math.min((top + EDGE_PX - pointerY) / EDGE_PX, 1)
  if (pointerY > bottom - EDGE_PX) return MAX_SCROLL_SPEED * Math.min((pointerY - (bottom - EDGE_PX)) / EDGE_PX, 1)
  return 0
}
