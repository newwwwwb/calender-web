// 일정 블록·칩에 포커스가 있을 때 Alt+방향키로 옮기는 키 → 이동량 변환과 월 고스트 위치 계산(순수 함수)
import { addDays } from 'date-fns'
import { moveBlock, resizeBlock, SNAP_MINUTES } from './blockDrag'
import { parseDateKey, toDateKey } from './date'

interface KeyLike {
  key: string
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export interface BlockKeyMove {
  dayDelta: number
  minuteDelta: number
  mode: 'move' | 'resize'
}

// 수정자는 Alt(+Shift)만 — Ctrl·Meta가 섞이면 브라우저·OS 단축키라 가로채지 않는다
function altOnly(e: KeyLike): boolean {
  return e.altKey && !e.ctrlKey && !e.metaKey
}

// 주·일 보기 시간 블록: Alt+↑↓ 15분 이동, Alt+←→ 하루 이동, Alt+Shift+↑↓ 끝 시각 ±15분(길이 조절). 그 밖은 null
export function blockKeyMove(e: KeyLike): BlockKeyMove | null {
  if (!altOnly(e)) return null
  switch (e.key) {
    case 'ArrowUp':
      return { dayDelta: 0, minuteDelta: -SNAP_MINUTES, mode: e.shiftKey ? 'resize' : 'move' }
    case 'ArrowDown':
      return { dayDelta: 0, minuteDelta: SNAP_MINUTES, mode: e.shiftKey ? 'resize' : 'move' }
    case 'ArrowLeft':
      return e.shiftKey ? null : { dayDelta: -1, minuteDelta: 0, mode: 'move' }
    case 'ArrowRight':
      return e.shiftKey ? null : { dayDelta: 1, minuteDelta: 0, mode: 'move' }
    default:
      return null
  }
}

// 월 보기 칩: Alt+←→ ±1일, Alt+↑↓ ±7일(같은 요일의 이전·다음 주). Shift가 섞이면 null
export function monthKeyMove(e: KeyLike): number | null {
  if (!altOnly(e) || e.shiftKey) return null
  switch (e.key) {
    case 'ArrowLeft':
      return -1
    case 'ArrowRight':
      return 1
    case 'ArrowUp':
      return -7
    case 'ArrowDown':
      return 7
    default:
      return null
  }
}

// 블록을 키 이동량만큼 옮긴 새 start/end와 놓인 날(키). 길이 조절은 날짜를 바꾸지 않는다. 화면에 보이는 날 밖이면 호출 쪽이 무시한다
export function applyBlockKeyMove(start: string, end: string, move: BlockKeyMove): { start: string; end: string; dayKey: string } {
  const dayKey = toDateKey(addDays(parseDateKey(start.slice(0, 10)), move.mode === 'move' ? move.dayDelta : 0))
  const next = move.mode === 'move' ? moveBlock(start, end, move.minuteDelta, dayKey) : resizeBlock(start, end, move.minuteDelta)
  return { ...next, dayKey }
}

const GHOST_OFFSET = 14

// 포인터를 따라다니는 고스트의 좌상단 위치. 기본은 포인터 오른쪽 아래(+14px)이고, 창 밖으로 넘치면 그 축만 반대편으로 뒤집는다
export function ghostPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number): { x: number; y: number } {
  const flipX = x + GHOST_OFFSET + width > viewportWidth
  const flipY = y + GHOST_OFFSET + height > viewportHeight
  return {
    x: Math.max(flipX ? x - GHOST_OFFSET - width : x + GHOST_OFFSET, 0),
    y: Math.max(flipY ? y - GHOST_OFFSET - height : y + GHOST_OFFSET, 0),
  }
}
