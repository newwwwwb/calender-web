// 시간대가 겹치는 일정을 나란히 배치하기 위한 컬럼 패킹 알고리즘 (주/일 보기 시간 그리드용)
export interface PositionedItem<T> {
  item: T
  column: number // 0부터 시작하는 배치 컬럼
  columnCount: number // 겹치는 그룹에서 필요한 전체 컬럼 수 (너비 계산용: 1/columnCount)
}

// items를 시작 시각 오름차순으로 겹치는 그룹별로 묶어 컬럼을 배정한다.
// start/end는 같은 단위(예: 자정 기준 분)의 숫자면 무엇이든 된다.
export function layoutOverlapping<T>(
  items: T[],
  getStart: (item: T) => number,
  getEnd: (item: T) => number,
): PositionedItem<T>[] {
  const sorted = [...items].sort((a, b) => getStart(a) - getStart(b))
  const result: PositionedItem<T>[] = []

  let group: PositionedItem<T>[] = []
  let groupEnd = -Infinity
  let columnEnds: number[] = [] // 각 컬럼에 마지막으로 배치된 일정의 종료 시각

  function flushGroup() {
    if (group.length === 0) return
    const columnCount = columnEnds.length
    for (const positioned of group) {
      positioned.columnCount = columnCount
      result.push(positioned)
    }
    group = []
    columnEnds = []
  }

  for (const item of sorted) {
    const start = getStart(item)
    const end = getEnd(item)

    if (start >= groupEnd) {
      flushGroup()
      groupEnd = end
    } else {
      groupEnd = Math.max(groupEnd, end)
    }

    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(end)
    } else {
      columnEnds[column] = end
    }

    group.push({ item, column, columnCount: 0 })
  }
  flushGroup()

  return result
}
