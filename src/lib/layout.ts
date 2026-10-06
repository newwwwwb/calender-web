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

// 여러 날 종일 일정을 칸마다 따로 뜬 칩이 아니라 이어진 막대로 보이게 하려고, 이 칸의 칩이 이전/다음 칸과 맞붙어야 하는지 판정한다.
// 주(행)가 바뀌는 곳(첫 열의 왼쪽, 마지막 열의 오른쪽)에서는 막대가 끊기므로 붙이지 않는다 — 그 칸에서 제목이 다시 보인다.
export function allDaySegmentJoins(
  instance: { event: { allDay: boolean }; start: string; end: string },
  dayKey: string,
  column: number,
  columns: number,
): { joinLeft: boolean; joinRight: boolean } {
  const isMultiDay = instance.event.allDay && instance.start.slice(0, 10) < instance.end.slice(0, 10)
  return {
    joinLeft: isMultiDay && dayKey > instance.start.slice(0, 10) && column > 0,
    joinRight: isMultiDay && dayKey < instance.end.slice(0, 10) && column < columns - 1,
  }
}

// ── 종일 일정 줄(lane) 배정 ─────────────────────────────────────────────────────────────────────────
// 여러 날 종일 일정을 칸마다 시작 시각 순서로만 쌓으면, 겹치는 다른 일정이 먼저 끝나거나 시작할 때 남은 일정의 줄 번호가 바뀌어
// 이어진 막대가 칸마다 다른 높이로 떠서 서로 상관없는 칩 두 개처럼 보였다(25단계 4차 심사). 한 주(행) 안에서 일정마다 줄을 한 번만
// 정하고 모든 칸에서 같은 줄에 그린다(구글 캘린더 방식).

interface DayRange {
  start: string // 'YYYY-MM-DD'로 시작하는 키
  end: string
}

/**
 * 한 주(weekFirst~weekLast, 'YYYY-MM-DD') 안에서 종일 일정마다 고정 줄 번호(0부터)를 정한다.
 * 먼저 시작하는 것, 같으면 더 길게 이어지는 것, 같으면 key 순으로 가장 위의 빈 줄을 차지한다.
 * 이 주에 걸치지 않는 일정은 결과에 없다. 주마다 따로 계산하므로 주가 바뀌면 줄이 다시 배정된다(막대가 어차피 끊기는 곳).
 */
export function assignAllDayLanes<T extends DayRange>(
  items: T[],
  keyOf: (item: T) => string,
  weekFirst: string,
  weekLast: string,
): Map<string, number> {
  const clipped = items
    .map((item) => ({
      key: keyOf(item),
      s: item.start.slice(0, 10) < weekFirst ? weekFirst : item.start.slice(0, 10),
      e: item.end.slice(0, 10) > weekLast ? weekLast : item.end.slice(0, 10),
    }))
    .filter((c) => c.s <= c.e)
    .sort((a, b) => a.s.localeCompare(b.s) || b.e.localeCompare(a.e) || a.key.localeCompare(b.key))

  const laneEnds: string[] = [] // 각 줄이 마지막으로 쓰인 날(포함)
  const lanes = new Map<string, number>()
  for (const c of clipped) {
    let lane = laneEnds.findIndex((end) => end < c.s)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = c.e
    lanes.set(c.key, lane)
  }
  return lanes
}

/**
 * dayKey 칸에 그릴 종일 일정들을 줄 번호 자리에 맞춰 놓는다. 비는 줄은 null(같은 높이의 빈 자리)이고, 마지막 일정 뒤의 빈 줄은 잘라낸다.
 * 이어진 막대가 칸을 건너도 같은 줄에 있게 하는 핵심이다.
 */
export function allDaySlots<T extends DayRange>(
  items: T[],
  keyOf: (item: T) => string,
  laneOf: Map<string, number>,
  dayKey: string,
): (T | null)[] {
  const slots: (T | null)[] = []
  for (const item of items) {
    if (item.start.slice(0, 10) > dayKey || item.end.slice(0, 10) < dayKey) continue
    const lane = laneOf.get(keyOf(item))
    if (lane === undefined) continue
    while (slots.length <= lane) slots.push(null)
    slots[lane] = item
  }
  return slots
}
