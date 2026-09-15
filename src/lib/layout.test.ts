// layout.ts 겹침 컬럼 배치 알고리즘 테스트
import { describe, expect, it } from 'vitest'
import { layoutOverlapping } from './layout'

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
