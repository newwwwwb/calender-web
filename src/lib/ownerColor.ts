// 겹쳐보기에서 "누구의 캘린더인지" 구분할 색상을 공유자 순서대로 배정한다 (내 캘린더는 배정하지 않음)
const PALETTE = ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899']

export function ownerColorFor(ownerId: string, sharedOwnerIds: string[]): string {
  const index = sharedOwnerIds.indexOf(ownerId)
  return PALETTE[index % PALETTE.length]
}
