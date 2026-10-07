// 키보드 이동 키 변환·적용과 월 고스트 위치 계산 검증
import { describe, expect, it } from 'vitest'
import { applyBlockKeyMove, blockKeyMove, ghostPosition, monthKeyMove, monthKeyResize } from './keyboardMove'

const key = (k: string, mods: Partial<{ altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key: k,
  altKey: true,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
})

describe('blockKeyMove', () => {
  it('Alt+↑↓는 15분 이동, Alt+←→는 하루 이동', () => {
    expect(blockKeyMove(key('ArrowUp'))).toEqual({ dayDelta: 0, minuteDelta: -15, mode: 'move' })
    expect(blockKeyMove(key('ArrowDown'))).toEqual({ dayDelta: 0, minuteDelta: 15, mode: 'move' })
    expect(blockKeyMove(key('ArrowLeft'))).toEqual({ dayDelta: -1, minuteDelta: 0, mode: 'move' })
    expect(blockKeyMove(key('ArrowRight'))).toEqual({ dayDelta: 1, minuteDelta: 0, mode: 'move' })
  })

  it('Alt+Shift+↑↓는 끝 시각 ±15분(길이 조절), Shift+←→는 쓰지 않는다', () => {
    expect(blockKeyMove(key('ArrowDown', { shiftKey: true }))).toEqual({ dayDelta: 0, minuteDelta: 15, mode: 'resize' })
    expect(blockKeyMove(key('ArrowUp', { shiftKey: true }))).toEqual({ dayDelta: 0, minuteDelta: -15, mode: 'resize' })
    expect(blockKeyMove(key('ArrowLeft', { shiftKey: true }))).toBeNull()
  })

  it('Alt 없이, 또는 Ctrl·Meta가 섞이거나 방향키가 아니면 null', () => {
    expect(blockKeyMove(key('ArrowDown', { altKey: false }))).toBeNull()
    expect(blockKeyMove(key('ArrowDown', { ctrlKey: true }))).toBeNull()
    expect(blockKeyMove(key('ArrowDown', { metaKey: true }))).toBeNull()
    expect(blockKeyMove(key('Enter'))).toBeNull()
    expect(blockKeyMove(key('a'))).toBeNull()
  })
})

describe('monthKeyMove', () => {
  it('Alt+←→는 ±1일, Alt+↑↓는 ±7일', () => {
    expect(monthKeyMove(key('ArrowLeft'))).toBe(-1)
    expect(monthKeyMove(key('ArrowRight'))).toBe(1)
    expect(monthKeyMove(key('ArrowUp'))).toBe(-7)
    expect(monthKeyMove(key('ArrowDown'))).toBe(7)
  })

  it('Alt 없이, Shift·Ctrl·Meta가 섞이거나 다른 키면 null', () => {
    expect(monthKeyMove(key('ArrowRight', { altKey: false }))).toBeNull()
    expect(monthKeyMove(key('ArrowRight', { shiftKey: true }))).toBeNull()
    expect(monthKeyMove(key('ArrowRight', { ctrlKey: true }))).toBeNull()
    expect(monthKeyMove(key('ArrowRight', { metaKey: true }))).toBeNull()
    expect(monthKeyMove(key('Tab'))).toBeNull()
  })
})

describe('monthKeyResize', () => {
  it('Alt+Shift+←→는 끝 날 ∓1일', () => {
    expect(monthKeyResize(key('ArrowLeft', { shiftKey: true }))).toBe(-1)
    expect(monthKeyResize(key('ArrowRight', { shiftKey: true }))).toBe(1)
  })

  it('Shift 없이, Alt 없이, Ctrl·Meta가 섞이거나 ↑↓·다른 키면 null이고 Shift 없는 Alt+←→는 이동(monthKeyMove)이 맡는다', () => {
    expect(monthKeyResize(key('ArrowRight'))).toBeNull()
    expect(monthKeyResize(key('ArrowRight', { shiftKey: true, altKey: false }))).toBeNull()
    expect(monthKeyResize(key('ArrowRight', { shiftKey: true, ctrlKey: true }))).toBeNull()
    expect(monthKeyResize(key('ArrowRight', { shiftKey: true, metaKey: true }))).toBeNull()
    expect(monthKeyResize(key('ArrowUp', { shiftKey: true }))).toBeNull()
    expect(monthKeyResize(key('Enter', { shiftKey: true }))).toBeNull()
    expect(monthKeyMove(key('ArrowRight', { shiftKey: true }))).toBeNull() // 두 변환이 겹치지 않는다
  })
})

describe('applyBlockKeyMove', () => {
  const start = '2026-09-14T09:00'
  const end = '2026-09-14T10:00'

  it('시간 이동은 길이를 유지한 채 15분씩 옮긴다', () => {
    expect(applyBlockKeyMove(start, end, { dayDelta: 0, minuteDelta: 15, mode: 'move' })).toEqual({ start: '2026-09-14T09:15', end: '2026-09-14T10:15', dayKey: '2026-09-14' })
  })

  it('하루 이동은 시각을 유지하고 날짜만 바꾼다(월말 경계 포함)', () => {
    expect(applyBlockKeyMove('2026-09-30T09:00', '2026-09-30T10:00', { dayDelta: 1, minuteDelta: 0, mode: 'move' })).toEqual({
      start: '2026-10-01T09:00',
      end: '2026-10-01T10:00',
      dayKey: '2026-10-01',
    })
  })

  it('길이 조절은 시작과 날짜를 그대로 두고 끝만 옮긴다', () => {
    expect(applyBlockKeyMove(start, end, { dayDelta: 1, minuteDelta: 15, mode: 'resize' })).toEqual({ start, end: '2026-09-14T10:15', dayKey: '2026-09-14' })
  })

  it('자정·최소 길이 한계에서는 더 움직이지 않는다', () => {
    expect(applyBlockKeyMove('2026-09-14T00:00', '2026-09-14T01:00', { dayDelta: 0, minuteDelta: -15, mode: 'move' }).start).toBe('2026-09-14T00:00')
    expect(applyBlockKeyMove('2026-09-14T23:00', '2026-09-15T00:00', { dayDelta: 0, minuteDelta: 15, mode: 'move' }).start).toBe('2026-09-14T23:00')
    expect(applyBlockKeyMove('2026-09-14T09:00', '2026-09-14T09:15', { dayDelta: 0, minuteDelta: -15, mode: 'resize' }).end).toBe('2026-09-14T09:15')
  })
})

describe('ghostPosition', () => {
  it('넘치지 않으면 포인터 오른쪽 아래 +14px', () => {
    expect(ghostPosition(100, 200, 120, 24, 1280, 800)).toEqual({ x: 114, y: 214 })
  })

  it('오른쪽이 넘치면 가로만 포인터 왼쪽으로 뒤집는다', () => {
    expect(ghostPosition(1250, 200, 120, 24, 1280, 800)).toEqual({ x: 1250 - 14 - 120, y: 214 })
  })

  it('아래가 넘치면 세로만 포인터 위로 뒤집고, 둘 다 넘치면 둘 다 뒤집는다', () => {
    expect(ghostPosition(100, 790, 120, 24, 1280, 800)).toEqual({ x: 114, y: 790 - 14 - 24 })
    expect(ghostPosition(1270, 790, 120, 24, 1280, 800)).toEqual({ x: 1270 - 14 - 120, y: 790 - 14 - 24 })
  })

  it('뒤집어도 화면 왼쪽·위로 나가지 않는다', () => {
    expect(ghostPosition(50, 10, 300, 24, 200, 20)).toEqual({ x: 0, y: 0 })
  })
})
