// 기간 키(날짜·월 키)가 바뀔 때 이전/다음 방향을 계산한다. SwipeableViewport의 방향 판정과 같은 규칙(문자열 비교)을 공용화한 것.
import { useRef } from 'react'

/**
 * key가 이전 렌더보다 커지면 1(다음), 작아지면 -1(이전)을 반환한다.
 * 렌더 중에 계산해 같은 렌더에서 바로 쓸 수 있게 한다(상태로 만들면 한 렌더 늦게 반영된다).
 * key가 같으면 이전에 계산해 둔 방향을 그대로 유지한다.
 */
export function usePeriodDirection(key: string): 1 | -1 {
  const prevKeyRef = useRef(key)
  const directionRef = useRef<1 | -1>(1)
  if (prevKeyRef.current !== key) {
    directionRef.current = key < prevKeyRef.current ? -1 : 1
    prevKeyRef.current = key
  }
  return directionRef.current
}
