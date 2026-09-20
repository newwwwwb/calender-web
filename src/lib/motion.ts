// 애플 Fluid Interface 스프링 프리셋과 제스처 속도 투사 유틸
import type { Transition } from 'motion/react'

/** 정적 UI 기본값: 오버슈트 없이 부드럽게 정착 (damping 1.0 상당) */
export const springDefault: Transition = { type: 'spring', bounce: 0, duration: 0.4 }

/**
 * 릴리즈 속도로부터 관성이 멈출 위치까지의 이동량을 계산한다(스크롤 감속과 동일한 지수 감쇠).
 * v: px/s 단위 속도, decelerationRate: 0.998(일반 스크롤 느낌) ~ 0.99(더 스냅감 있게)
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate)
}
