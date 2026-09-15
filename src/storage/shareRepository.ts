// 캘린더 공유(초대 링크) 저장소 인터페이스. 로그인(Supabase) 상태에서만 의미가 있다.
import type { ID, ShareLink, ShareMember, SharedCalendar } from '../types'

export interface ShareRepository {
  createShareLink(): Promise<ShareLink>
  listMyShareLinks(): Promise<ShareLink[]>
  deleteShareLink(id: ID): Promise<void>
  listMembers(shareId: ID): Promise<ShareMember[]>
  removeMember(memberId: ID): Promise<void>
  getShareLink(id: ID): Promise<ShareLink | null>
  acceptShareLink(id: ID): Promise<void>
  listSharedWithMe(): Promise<SharedCalendar[]>
}
