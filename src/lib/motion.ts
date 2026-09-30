// 애플 Fluid Interface 스프링 프리셋과 제스처 속도 투사 유틸
import type { Transition, Variants } from 'motion/react'

/** 정적 UI 기본값: 오버슈트 없이 부드럽게 정착 (damping 1.0 상당) */
export const springDefault: Transition = { type: 'spring', bounce: 0, duration: 0.4 }

/** isSlide가 true면 direction 방향으로 롤(세로 이동+페이드), false면 자리 이동 없이 크로스페이드만 한다 */
export interface PeriodTransition {
  isSlide: boolean
  direction: 1 | -1
}

// 헤더/미니 캘린더의 기간 제목이 바뀔 때 쓰는 공용 variants(SwipeableViewport의 paneVariants와 같은 custom 패턴)
export const rollVariants: Variants = {
  enter: (t: PeriodTransition) => (t.isSlide ? { y: t.direction > 0 ? 14 : -14, opacity: 0 } : { y: 0, opacity: 0 }),
  center: { y: 0, opacity: 1, transition: springDefault },
  exit: (t: PeriodTransition) =>
    t.isSlide
      ? { y: t.direction > 0 ? -14 : 14, opacity: 0, transition: springDefault }
      : { y: 0, opacity: 0, transition: springDefault },
}

// 미니 캘린더 월 그리드가 바뀔 때 쓰는 가로 슬라이드(폭이 고정이라 rollVariants와 달리 x축, 위젯 전환 없이 항상 슬라이드)
// 퇴장 중인 지난 달 그리드는 pointerEvents:none으로 눌리지 않게 한다. (1차 리뷰 때 이걸 넣으면 테스트가 깨져
// motion 문제로 보고 보류했었는데, 실제 원인은 테스트가 가짜 타이머에 motion 프레임을 남긴 채 진짜 타이머로
// 돌아가 다음 테스트의 프레임 루프가 멈춘 것이었다 — 각 테스트 afterEach에서 runOnlyPendingTimers로 해결, 24.10)
export const slideVariants: Variants = {
  enter: (t: PeriodTransition) => ({ x: t.direction > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: springDefault },
  exit: (t: PeriodTransition) => ({
    x: t.direction > 0 ? -24 : 24,
    opacity: 0,
    pointerEvents: 'none' as const,
    transition: springDefault,
  }),
}

// 목록 항목(할 일·알림·목록 보기 행)이 추가/삭제될 때 쓰는 공용 페이드. motion 컴포넌트에 {...listItemMotion}로 펼쳐 쓴다.
// 퇴장 중(exit)에는 pointerEvents:none도 같이 줘서, 사라지는 중인 항목을 눌러 이미 삭제된 항목을 다시
// 조작(체크·삭제·열기)하지 못하게 막는다(보스 리뷰에서 발견 — 애니메이션이 없던 이전에는 즉시 사라져 문제없었다).
// layout은 쓰지 않는다: 형제 행만 보간되고 목록 밖(추가 버튼·날짜 제목·다음 섹션)은 즉시 움직여 서로 겹쳤다(2차 보스 실측).
// 대신 퇴장을 150ms로 짧게 해 빈자리가 금방 닫히게 한다.
export const listItemMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, pointerEvents: 'none' as const, transition: { duration: 0.15 } },
  transition: springDefault,
}

// 달력 칩·시간 블록이 추가/삭제될 때 쓰는 공용 페이드+스케일(위치는 이미 style로 고정돼 있어 layout 애니메이션은 안 씀)
export const chipMotion = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96, pointerEvents: 'none' as const },
  transition: springDefault,
}

/**
 * 릴리즈 속도로부터 관성이 멈출 위치까지의 이동량을 계산한다(스크롤 감속과 동일한 지수 감쇠).
 * v: px/s 단위 속도, decelerationRate: 0.998(일반 스크롤 느낌) ~ 0.99(더 스냅감 있게)
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate)
}
