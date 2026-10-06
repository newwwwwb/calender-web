// layout.ts 겹침 컬럼 배치 알고리즘 테스트
import { describe, expect, it } from 'vitest'
import { allDaySegmentJoins, allDaySlots, assignAllDayLanes, layoutOverlapping } from './layout'

interface Range {
  id: string
  start: number
  end: number
}

function layout(items: Range[]) {
  return layoutOverlapping(items, (i) => i.start, (i) => i.end).map((p) => ({
    id: p.item.id,
    column: p.column,
    columnCount: p.columnCount,
  }))
}

describe('layoutOverlapping', () => {
  it('겹치지 않으면 모두 컬럼 0, columnCount 1이다', () => {
    const items: Range[] = [
      { id: 'a', start: 0, end: 1 },
      { id: 'b', start: 2, end: 3 },
    ]
    expect(layout(items)).toEqual([
      { id: 'a', column: 0, columnCount: 1 },
      { id: 'b', column: 0, columnCount: 1 },
    ])
  })

  it('완전히 겹치면 서로 다른 컬럼에 배치되고 columnCount가 늘어난다', () => {
    const items: Range[] = [
      { id: 'a', start: 0, end: 2 },
      { id: 'b', start: 0, end: 2 },
      { id: 'c', start: 0, end: 2 },
    ]
    expect(layout(items)).toEqual([
      { id: 'a', column: 0, columnCount: 3 },
      { id: 'b', column: 1, columnCount: 3 },
      { id: 'c', column: 2, columnCount: 3 },
    ])
  })

  it('맞닿기만 하면(끝==시작) 겹침으로 보지 않고 같은 컬럼을 재사용한다', () => {
    const items: Range[] = [
      { id: 'a', start: 0, end: 1 },
      { id: 'b', start: 1, end: 2 },
    ]
    expect(layout(items)).toEqual([
      { id: 'a', column: 0, columnCount: 1 },
      { id: 'b', column: 0, columnCount: 1 },
    ])
  })

  it('부분 겹침: A(0-3) B(1-2) C(2-4) — B와 C는 컬럼을 공유할 수 있다', () => {
    const items: Range[] = [
      { id: 'a', start: 0, end: 3 },
      { id: 'b', start: 1, end: 2 },
      { id: 'c', start: 2, end: 4 },
    ]
    expect(layout(items)).toEqual([
      { id: 'a', column: 0, columnCount: 2 },
      { id: 'b', column: 1, columnCount: 2 },
      { id: 'c', column: 1, columnCount: 2 },
    ])
  })

  it('서로 다른 겹침 그룹은 독립적으로 columnCount를 계산한다', () => {
    const items: Range[] = [
      { id: 'a', start: 0, end: 1 },
      { id: 'b', start: 0, end: 1 },
      { id: 'c', start: 5, end: 6 },
    ]
    expect(layout(items)).toEqual([
      { id: 'a', column: 0, columnCount: 2 },
      { id: 'b', column: 1, columnCount: 2 },
      { id: 'c', column: 0, columnCount: 1 },
    ])
  })

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(layout([])).toEqual([])
  })
})

describe('allDaySegmentJoins', () => {
  const trip = { event: { allDay: true }, start: '2026-10-02', end: '2026-10-05' }

  it('여러 날 종일 일정은 첫날은 오른쪽만, 가운데는 양쪽, 마지막 날은 왼쪽만 이웃 칸과 이어 붙인다', () => {
    expect(allDaySegmentJoins(trip, '2026-10-02', 5, 7)).toEqual({ joinLeft: false, joinRight: true })
    expect(allDaySegmentJoins(trip, '2026-10-03', 6, 7)).toEqual({ joinLeft: true, joinRight: false }) // 토요일: 주 끝이라 오른쪽은 끊김
    expect(allDaySegmentJoins(trip, '2026-10-04', 0, 7)).toEqual({ joinLeft: false, joinRight: true }) // 일요일: 주 시작이라 왼쪽은 끊겨 제목이 다시 보인다
    expect(allDaySegmentJoins(trip, '2026-10-05', 2, 7)).toEqual({ joinLeft: true, joinRight: false })
  })

  it('하루짜리 종일 일정과 시간 일정은 아무것도 이어 붙이지 않는다', () => {
    expect(allDaySegmentJoins({ event: { allDay: true }, start: '2026-10-02', end: '2026-10-02' }, '2026-10-02', 3, 7)).toEqual({
      joinLeft: false,
      joinRight: false,
    })
    expect(
      allDaySegmentJoins({ event: { allDay: false }, start: '2026-10-02T09:00', end: '2026-10-03T10:00' }, '2026-10-02', 3, 7),
    ).toEqual({ joinLeft: false, joinRight: false })
  })

  it('일 보기처럼 열이 하나뿐이면 이어 붙이지 않는다', () => {
    expect(allDaySegmentJoins(trip, '2026-10-03', 0, 1)).toEqual({ joinLeft: false, joinRight: false })
  })
})

describe('assignAllDayLanes / allDaySlots (겹치는 여러 날 종일 일정의 고정 줄)', () => {
  interface Ev {
    id: string
    start: string
    end: string
  }
  const key = (e: Ev) => e.id
  // 심사 재현 시나리오: 출장 10/12~13, 휴가 10/13~15 (한 주 안)
  const trip: Ev = { id: '출장', start: '2026-10-12', end: '2026-10-13' }
  const leave: Ev = { id: '휴가', start: '2026-10-13', end: '2026-10-15' }
  const WEEK: [string, string] = ['2026-10-11', '2026-10-17']

  it('겹치지 않는 일정은 같은 줄을 재사용하고, 겹치면 다른 줄을 준다', () => {
    const lanes = assignAllDayLanes([trip, leave], key, ...WEEK)
    expect(lanes.get('출장')).toBe(0)
    expect(lanes.get('휴가')).toBe(1) // 13일에 겹치므로 아랫줄
    const later: Ev = { id: '뒤', start: '2026-10-16', end: '2026-10-16' }
    expect(assignAllDayLanes([trip, leave, later], key, ...WEEK).get('뒤')).toBe(0) // 앞 일정들이 끝난 뒤라 윗줄 재사용
  })

  it('한 일정은 걸친 모든 날에서 같은 줄에 놓인다(막대가 끊겨 보이지 않는다)', () => {
    const lanes = assignAllDayLanes([trip, leave], key, ...WEEK)
    const laneOnDay = (day: string, id: string) => allDaySlots([trip, leave], key, lanes, day).findIndex((e) => e?.id === id)
    // 휴가는 13·14·15일 어느 칸에서든 같은 줄(1)
    expect(['2026-10-13', '2026-10-14', '2026-10-15'].map((d) => laneOnDay(d, '휴가'))).toEqual([1, 1, 1])
    // 출장은 12·13일 모두 줄 0
    expect(['2026-10-12', '2026-10-13'].map((d) => laneOnDay(d, '출장'))).toEqual([0, 0])
  })

  it('윗줄 일정이 끝난 칸에서도 아랫줄 일정은 내려간 줄에 남고, 윗줄은 빈 자리(null)가 된다', () => {
    const lanes = assignAllDayLanes([trip, leave], key, ...WEEK)
    expect(allDaySlots([trip, leave], key, lanes, '2026-10-14')).toEqual([null, leave]) // 14일: 출장은 끝, 휴가는 그대로 줄 1
    expect(allDaySlots([trip, leave], key, lanes, '2026-10-12')).toEqual([trip]) // 마지막 일정 뒤의 빈 줄은 잘라낸다
    expect(allDaySlots([trip, leave], key, lanes, '2026-10-16')).toEqual([]) // 그날 일정이 없으면 빈 배열
  })

  it('더 길게 이어지는 일정이 같은 날 시작하는 짧은 일정보다 위 줄을 차지한다', () => {
    const long: Ev = { id: 'B긴', start: '2026-10-12', end: '2026-10-16' }
    const short: Ev = { id: 'A짧', start: '2026-10-12', end: '2026-10-12' }
    const lanes = assignAllDayLanes([short, long], key, ...WEEK)
    expect(lanes.get('B긴')).toBe(0)
    expect(lanes.get('A짧')).toBe(1)
  })

  it('주 경계에서 잘라 계산한다: 앞주에서 이어진 일정은 이 주 첫날부터, 이 주에 안 걸치면 빠진다', () => {
    const fromPrev: Ev = { id: '앞주', start: '2026-10-08', end: '2026-10-12' }
    const outside: Ev = { id: '밖', start: '2026-10-20', end: '2026-10-21' }
    const lanes = assignAllDayLanes([fromPrev, trip, outside], key, ...WEEK)
    expect(lanes.has('밖')).toBe(false)
    expect(lanes.get('앞주')).toBe(0) // 이 주에선 11~12일 → 출장(12~13)과 겹쳐 출장이 아랫줄
    expect(lanes.get('출장')).toBe(1)
  })

  it('같은 입력이면 항상 같은 배정이다(폴링마다 줄이 바뀌지 않게 키 순으로 결정)', () => {
    const a = assignAllDayLanes([leave, trip], key, ...WEEK)
    const b = assignAllDayLanes([trip, leave], key, ...WEEK)
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort())
  })
})

