// 겹쳐보기에서 "누구의 캘린더인지" 구분할 색상을 공유자 순서대로 배정한다 (내 캘린더는 배정하지 않음)
// 실제 색은 tokens.css의 --owner-N(라이트·다크 별도, 글자색으로 써도 AA 통과)이 정한다
const PALETTE_SIZE = 6

export function ownerColorFor(ownerId: string, sharedOwnerIds: string[]): string {
  // sharedCalendars가 아직 로드되지 않았거나 공유가 취소된 뒤 남은 이벤트라면 -1이 나올 수 있다 — 팔레트 첫 색으로 대체
  const index = Math.max(sharedOwnerIds.indexOf(ownerId), 0)
  return `var(--owner-${(index % PALETTE_SIZE) + 1})`
}
