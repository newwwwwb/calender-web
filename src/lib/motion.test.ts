// project: 스와이프 커밋 판정에 쓰는 속도 투사 계산이 알려진 입력에 대해 맞는지 검증
import { describe, expect, it } from 'vitest'
import { project } from './motion'

describe('project', () => {
  it('속도가 0이면 이동량도 0이다', () => {
    expect(project(0)).toBe(0)
  })

  it('양의 속도는 양의 방향으로 투사된다', () => {
    expect(project(1000)).toBeCloseTo(499, 0)
  })

  it('음의 속도는 음의 방향으로 투사된다', () => {
    expect(project(-1000)).toBeCloseTo(-499, 0)
  })

  it('감쇠율이 낮을수록(더 스냅감 있게) 투사 거리가 짧다', () => {
    expect(Math.abs(project(1000, 0.99))).toBeLessThan(Math.abs(project(1000, 0.998)))
  })
})
