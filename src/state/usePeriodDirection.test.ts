// usePeriodDirection: key 변화에 따라 방향(1/-1)이 맞게 나오는지, 같은 key에서는 유지되는지 검증
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePeriodDirection } from './usePeriodDirection'

describe('usePeriodDirection', () => {
  it('처음에는 1(다음)을 반환한다', () => {
    const { result } = renderHook(() => usePeriodDirection('2026-09-01'))
    expect(result.current).toBe(1)
  })

  it('key가 커지면(다음으로 이동) 1을 반환한다', () => {
    const { result, rerender } = renderHook(({ key }) => usePeriodDirection(key), {
      initialProps: { key: '2026-09-01' },
    })
    rerender({ key: '2026-09-02' })
    expect(result.current).toBe(1)
  })

  it('key가 작아지면(이전으로 이동) -1을 반환한다', () => {
    const { result, rerender } = renderHook(({ key }) => usePeriodDirection(key), {
      initialProps: { key: '2026-09-02' },
    })
    rerender({ key: '2026-09-01' })
    expect(result.current).toBe(-1)
  })

  it('key가 같으면 이전에 계산한 방향을 그대로 유지한다', () => {
    const { result, rerender } = renderHook(({ key }) => usePeriodDirection(key), {
      initialProps: { key: '2026-09-02' },
    })
    rerender({ key: '2026-09-01' }) // -1로 바뀜
    rerender({ key: '2026-09-01' }) // key가 그대로라 -1 유지
    expect(result.current).toBe(-1)
  })
})
