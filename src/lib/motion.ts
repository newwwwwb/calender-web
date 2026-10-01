// 애플 Fluid Interface 스프링 프리셋과 제스처 속도 투사 유틸
import type { Transition, Variants } from 'motion/react'

/** 정적 UI 기본값: 오버슈트 없이 부드럽게 정착 (damping 1.0 상당).
 *  0.8은 "느린 애니메이션"이 아니라 정착 시간이다 — 1152px 이동의 90%가 ~330ms에 끝난다(25단계 실측).
 *  페이지 슬라이드·시트 진입·사이드바처럼 큰 공간 이동 전용이고, 작은 피드백·퇴장·제스처 뒤 복귀는 아래 세 프리셋을 쓴다 */
export const springDefault: Transition = { type: 'spring', bounce: 0, duration: 0.8 }

/** 작은 피드백(세그먼트 선택 표시·선택 원·배지·칩 등장): 정지에서 출발하는 0.8 스프링은 짧은 거리에서 굼떠 보였다
 *  (세그먼트 표시가 63ms 동안 2px) — 애플 response 약 0.36에 해당하는 빠른 스프링 */
export const springSnappy: Transition = { type: 'spring', bounce: 0, visualDuration: 0.3 }

/** 손을 놓은 뒤 되돌아가는 동작 전용: 손가락 모멘텀이 있었으므로 살짝 튕긴다(들어올 때는 모멘텀이 없어 bounce 0) */
export const springFling: Transition = { type: 'spring', bounce: 0.2, visualDuration: 0.3 }

/** 퇴장: 닫기는 의도가 이미 끝난 동작이라 진입(0.8)만큼 기다리게 하지 않는다 */
export const exitFast: Transition = { duration: 0.2, ease: [0.4, 0, 1, 1] }

/** 투명도 전환(스크림 진입·크로스페이드 등)의 기본 길이 */
export const fadeDefault: Transition = { duration: 0.4 }

/** isSlide가 true면 direction 방향으로 롤(세로 이동+페이드), false면 자리 이동 없이 크로스페이드만 한다 */
export interface PeriodTransition {
  isSlide: boolean
  direction: 1 | -1
}

// 헤더/미니 캘린더의 기간 제목이 바뀔 때 쓰는 공용 variants(SwipeableViewport의 paneVariants와 같은 custom 패턴)
export const rollVariants: Variants = {
  enter: (t: PeriodTransition) => (t.isSlide ? { y: t.direction > 0 ? 20 : -20, opacity: 0 } : { y: 0, opacity: 0 }),
  // 슬라이드가 아닌 전환(보기 변경)은 두 제목이 포개져 "2026년 11월"과 "11월 1일 – 7일"이 겹쳐 보였다 — 나가는 쪽이 먼저 사라지고 나서 나타난다
  center: (t: PeriodTransition) => ({
    y: 0,
    opacity: 1,
    transition: t.isSlide ? springDefault : { duration: 0.2, delay: 0.08 },
  }),
  exit: (t: PeriodTransition) =>
    t.isSlide
      ? { y: t.direction > 0 ? -20 : 20, opacity: 0, transition: springDefault }
      : { y: 0, opacity: 0, transition: { duration: 0.12, ease: 'easeOut' } },
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
// 대신 퇴장을 300ms로 짧게 해 빈자리가 금방 닫히게 한다.
export const listItemMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, pointerEvents: 'none' as const, transition: { duration: 0.3 } },
  transition: springDefault,
}

// 달력 칩·시간 블록이 추가/삭제될 때 쓰는 공용 페이드+스케일과 눌림 반응.
// layout은 여기 넣지 않는다 — 월 보기·종일 칩은 컴포넌트에서 layout="position"을 따로 주고, 절대 위치 시간 블록은 쓰지 않는다.
// 칩·블록은 진짜 <button>이다: 예전엔 마우스/터치 전용 <span tabIndex=-1>이고 부모 날짜 셀이 키보드 진입점이라고 했지만,
// 날짜 셀을 Enter로 누르면 일 보기로 넘어갈 뿐이라 키보드로는 기존 일정을 열 수 없었다(25단계 접근성 감사 P0).
// 눌림은 등장용 스프링 대신 짧은 tween(누를 때 즉시, 놓으면 springSnappy로 복귀)을 쓴다.
export const chipMotion = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96, pointerEvents: 'none' as const },
  transition: springSnappy,
  whileTap: { scale: 0.98, transition: { duration: 0.06 } },
}

/**
 * 릴리즈 속도로부터 관성이 멈출 위치까지의 이동량을 계산한다(스크롤 감속과 동일한 지수 감쇠).
 * v: px/s 단위 속도, decelerationRate: 0.998(일반 스크롤 느낌) ~ 0.99(더 스냅감 있게)
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate)
}
