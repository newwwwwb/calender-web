// 함께 일정(19단계): 참여자 초대/변경, 수락·거절, 알림 조회. EventRepository와 달리 로컬
// 모드가 없는(로그인 전용) 기능이라 별도 인터페이스 없이 client를 받는 함수로 둔다.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppNotification, ID, NotificationKind, Participant, ParticipantStatus } from '../types'

interface NotificationRow {
  id: string
  actor_id: string | null
  actor_email: string
  kind: NotificationKind
  status: ParticipantStatus | null
  event_id: string | null
  event_title: string
  read_at: string | null
  created_at: string
}

function notificationFromRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    kind: row.kind,
    status: row.status ?? undefined,
    eventId: row.event_id ?? undefined,
    eventTitle: row.event_title,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
  }
}

// current(기존 참여자)와 next(원하는 참여자+초대 방식)를 비교해 차이만 insert/delete한다.
// 참여자 상태(pending -> accepted/declined) 변경은 respondToEvent로만 하므로 여기서는 다루지 않는다.
export async function setParticipants(
  client: SupabaseClient,
  eventId: ID,
  current: Participant[],
  next: { userId: ID; status: 'pending' | 'accepted' }[],
): Promise<void> {
  const nextIds = new Set(next.map((p) => p.userId))
  const currentIds = new Set(current.map((p) => p.userId))
  const toRemove = current.filter((p) => !nextIds.has(p.userId)).map((p) => p.userId)
  const toAdd = next.filter((p) => !currentIds.has(p.userId))

  if (toRemove.length > 0) {
    const { error } = await client.from('event_participants').delete().eq('event_id', eventId).in('user_id', toRemove)
    if (error) throw error
  }
  if (toAdd.length > 0) {
    const { error } = await client.from('event_participants').insert(
      toAdd.map((p) => ({ event_id: eventId, user_id: p.userId, status: p.status })),
    )
    if (error) throw error
  }
}

export async function respondToEvent(client: SupabaseClient, eventId: ID, status: 'accepted' | 'declined'): Promise<void> {
  const { error } = await client.rpc('respond_to_event', { p_event_id: eventId, p_status: status })
  if (error) throw error
}

export async function listNotifications(client: SupabaseClient): Promise<AppNotification[]> {
  const { data, error } = await client.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
  if (error) throw error
  return (data as NotificationRow[]).map(notificationFromRow)
}

export async function markAllRead(client: SupabaseClient): Promise<void> {
  const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (error) throw error
}
