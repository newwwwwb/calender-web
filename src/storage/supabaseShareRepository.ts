// ShareRepository의 Supabase 구현. supabase/schema_share.sql의 calendar_shares/calendar_share_members 테이블을 사용한다.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ID, ShareLink, ShareMember, SharedCalendar } from '../types'
import type { ShareRepository } from './shareRepository'

interface ShareRow {
  id: string
  owner_id: string
  owner_email: string
  created_at: string
}

interface MemberRow {
  id: string
  share_id: string
  viewer_id: string
  viewer_email: string
  created_at: string
}

interface SharedWithMeRow {
  viewer_id: string
  viewer_email: string
  calendar_shares: { owner_id: string; owner_email: string } | null
}

function shareFromRow(row: ShareRow): ShareLink {
  return { id: row.id, ownerId: row.owner_id, ownerEmail: row.owner_email, createdAt: row.created_at }
}

function memberFromRow(row: MemberRow): ShareMember {
  return { id: row.id, shareId: row.share_id, viewerId: row.viewer_id, viewerEmail: row.viewer_email, createdAt: row.created_at }
}

export class SupabaseShareRepository implements ShareRepository {
  private client: SupabaseClient
  private userId: string
  private userEmail: string

  constructor(client: SupabaseClient, userId: string, userEmail: string) {
    this.client = client
    this.userId = userId
    this.userEmail = userEmail
  }

  async createShareLink(): Promise<ShareLink> {
    const { data, error } = await this.client
      .from('calendar_shares')
      .insert({ owner_id: this.userId, owner_email: this.userEmail })
      .select()
      .single()
    if (error) throw error
    return shareFromRow(data as ShareRow)
  }

  async listMyShareLinks(): Promise<ShareLink[]> {
    const { data, error } = await this.client
      .from('calendar_shares')
      .select('*')
      .eq('owner_id', this.userId)
      .order('created_at')
    if (error) throw error
    return (data as ShareRow[]).map(shareFromRow)
  }

  async deleteShareLink(id: ID): Promise<void> {
    const { error } = await this.client.from('calendar_shares').delete().eq('id', id)
    if (error) throw error
  }

  async listMembers(shareId: ID): Promise<ShareMember[]> {
    const { data, error } = await this.client
      .from('calendar_share_members')
      .select('*')
      .eq('share_id', shareId)
      .order('created_at')
    if (error) throw error
    return (data as MemberRow[]).map(memberFromRow)
  }

  async removeMember(memberId: ID): Promise<void> {
    const { error } = await this.client.from('calendar_share_members').delete().eq('id', memberId)
    if (error) throw error
  }

  // 목록을 전체 열람하지 못하도록(보안 리뷰로 발견된 구멍) id 하나만 조회하는 SECURITY DEFINER
  // 함수(get_share_owner)를 통해서만 조회한다 — supabase/schema_share_fix.sql~fix3.sql 참고.
  async getShareLink(id: ID): Promise<ShareLink | null> {
    const { data, error } = await this.client.rpc('get_share_owner', { p_share_id: id })
    if (error) throw error
    const row = (data as { owner_id: string; owner_email: string }[] | null)?.[0]
    return row ? { id, ownerId: row.owner_id, ownerEmail: row.owner_email, createdAt: '' } : null
  }

  // 마찬가지로 존재하는 share_id에만 등록되는 SECURITY DEFINER 함수(accept_share)를 통해서만 수락한다.
  async acceptShareLink(id: ID): Promise<void> {
    const { error } = await this.client.rpc('accept_share', { p_share_id: id })
    if (error) throw error
  }

  // 양방향 공유(17단계): 필터 없이 조회하면 기존 RLS(calendar_share_members_select)가 이미
  // "내가 수락자이거나 링크 소유자인 행"만 돌려준다. 행마다 내가 어느 쪽인지에 따라 상대를 고른다.
  async listSharedWithMe(): Promise<SharedCalendar[]> {
    const { data, error } = await this.client
      .from('calendar_share_members')
      .select('viewer_id, viewer_email, calendar_shares(owner_id, owner_email)')
    if (error) throw error
    // 같은 상대와 여러 링크로 얽혀 있으면 행이 중복될 수 있다 —
    // 상대 id로 중복 제거(React key 중복·토글 중복 버그, 보스 리뷰에서 발견).
    const byPartner = new Map<string, SharedCalendar>()
    for (const row of data as unknown as SharedWithMeRow[]) {
      if (!row.calendar_shares) continue
      const partner =
        row.viewer_id === this.userId
          ? { ownerId: row.calendar_shares.owner_id, ownerEmail: row.calendar_shares.owner_email }
          : { ownerId: row.viewer_id, ownerEmail: row.viewer_email }
      if (partner.ownerId === this.userId) continue
      byPartner.set(partner.ownerId, partner)
    }
    return [...byPartner.values()]
  }
}
