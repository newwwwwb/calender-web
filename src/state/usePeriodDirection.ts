// 기간 키(날짜·월 키)가 바뀔 때 이전/다음 방향을 계산한다. SwipeableViewport의 방향 판정과 같은 규칙(문자열 비교)을 공용화한 것.
import { useState } from 'react'

/**
 * key가 이전 렌더보다 커지면 1(다음), 작아지면 -1(이전)을 반환한다.
 * key가 같으면 이전에 계산해 둔 방향을 그대로 유지한다.
 * React의 "렌더 중 state 조정" 패턴(SwipeableViewport와 동일)으로 계산해, 같은 렌더에서 바로 최신 값을 쓴다.
 */
export function usePeriodDirection(key: string): 1 | -1 {
  const [state, setState] = useState<{ key: string; direction: 1 | -1 }>({ key, direction: 1 })
  if (state.key !== key) {
    const direction: 1 | -1 = key < state.key ? -1 : 1
    setState({ key, direction })
    return direction
  }
  return state.direction
}
