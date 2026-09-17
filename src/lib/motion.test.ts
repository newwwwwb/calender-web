// project/rubberband: 스와이프 커밋 판정과 경계 저항 계산이 알려진 입력에 대해 맞는지 검증
import { describe, expect, it } from 'vitest'
import { project, rubberband } from './motion'

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

describe('rubberband', () => {
  it('경계를 넘지 않았으면(overshoot 0) 저항도 0이다', () => {
    expect(rubberband(0, 300)).toBe(0)
  })

  it('넘어간 거리가 커질수록 실제 이동량은 점점 더 둔감해진다(체감 저항 증가)', () => {
    const small = rubberband(20, 300)
    const large = rubberband(200, 300)
    // 입력 대비 출력 비율이 클수록 저항이 작다는 뜻 — 넘어간 거리가 커질수록 이 비율은 줄어야 한다
    expect(large / 200).toBeLessThan(small / 20)
  })

  it('음의 방향 overshoot도 대칭적으로 저항한다', () => {
    expect(rubberband(-50, 300)).toBeCloseTo(-rubberband(50, 300), 5)
  })
})
