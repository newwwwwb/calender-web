// 애플 Fluid Interface 스프링 프리셋과 제스처 물리 유틸(투사·러버밴드)
import type { Transition } from 'motion/react'

/** 정적 UI 기본값: 오버슈트 없이 부드럽게 정착 (damping 1.0 상당) */
export const springDefault: Transition = { type: 'spring', bounce: 0, duration: 0.4 }

/** 시트/드로어: 제스처가 모멘텀을 실어준 경우에만 살짝 튕긴다 (damping ~0.8 상당) */
export const springSheet: Transition = { type: 'spring', bounce: 0.2, duration: 0.3 }

/** 완전히 정적인(제스처 없는) 전환: 오버슈트를 원천적으로 배제 */
export const springStatic: Transition = { type: 'spring', bounce: 0, duration: 0.3 }

/**
 * 릴리즈 속도로부터 관성이 멈출 위치까지의 이동량을 계산한다(스크롤 감속과 동일한 지수 감쇠).
 * v: px/s 단위 속도, decelerationRate: 0.998(일반 스크롤 느낌) ~ 0.99(더 스냅감 있게)
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate)
}

/**
 * 경계를 넘어선 드래그를 점점 더 강하게 저항시킨다(경계에 가까울수록 1:1, 멀수록 둔감).
 * overshoot: 경계를 넘은 거리, dimension: 저항이 작용하는 기준 길이(보통 뷰포트 크기)
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  const sign = overshoot < 0 ? -1 : 1
  const abs = Math.abs(overshoot)
  return sign * (abs * dimension * constant) / (dimension + constant * abs)
}
