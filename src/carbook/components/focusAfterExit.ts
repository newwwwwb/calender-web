// 대화상자 퇴장 뒤 포커스 복구 공용 함수(NFR-18, WCAG 2.4.3): onExitComplete에서 부른다
const MAX_WAIT_MS = 500

// onExitComplete는 퇴장 노드가 DOM에서 빠지기 직전에 불리고, 빠지는 시점은 기기 속도에 따라 한두 프레임 이상 늦을 수 있다.
// 그래서 프레임마다 다시 본다: 포커스가 body면 복구 대상으로 보내고, 닫히는 대화상자 안이면 노드가 빠질 때까지 기다리고(최대 500ms),
// 대화상자 밖의 다른 요소에 있으면(취소처럼 Overlay가 누른 버튼으로 이미 돌려준 경우) 건드리지 않는다
export function restoreFocusAfterExit(getTarget: () => HTMLElement | null | undefined) {
  const startedAt = performance.now()
  const tick = () => {
    const active = document.activeElement
    if (!active || active === document.body) {
      getTarget()?.focus()
      return
    }
    if (!active.closest('[role="dialog"]')) return
    if (performance.now() - startedAt < MAX_WAIT_MS) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
