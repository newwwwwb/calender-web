// 겹쳐보기에서 "누구의 캘린더인지" 구분할 색상을 공유자 순서대로 배정한다 (내 캘린더는 배정하지 않음)
const PALETTE = ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899']

export function ownerColorFor(ownerId: string, sharedOwnerIds: string[]): string {
  // sharedCalendars가 아직 로드되지 않았거나 공유가 취소된 뒤 남은 이벤트라면 -1이 나올 수 있다 — 팔레트 첫 색으로 대체
  const index = Math.max(sharedOwnerIds.indexOf(ownerId), 0)
  return PALETTE[index % PALETTE.length]
}
