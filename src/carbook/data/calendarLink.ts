// 항목·만기일에 연결된 캘린더 일정(events)을 보장·조회·덮어쓰기·삭제하는 모듈. 카테고리 id는 화면 수명 동안 기억한다
import { supabase } from '../../lib/supabaseClient'
import type { DateKey } from '../domain/types'
import { CarbookError, request } from './request'

export interface LinkedEventSpec { eventId: string; title: string; date: DateKey } // 계산된 값(원천, BR-25)
export interface ExistingEvent { id: string; title: string; start_at: string; category_id: string | null }

export interface CalendarLink {
  ensureCategoryId(): Promise<string>
  fetchEvents(ids: string[]): Promise<Map<string, ExistingEvent>>
  syncEvent(spec: LinkedEventSpec, known?: ExistingEvent | null): Promise<'written' | 'unchanged'>
  deleteEvent(eventId: string): Promise<boolean>
  rebindCategory(eventIds: string[]): Promise<void>
}

const CHUNK = 100 // in('id', …) 한 번에 100개(주소 길이 한도, NFR-11)
const EVENT_COLS = 'id,title,start_at,category_id'
type Result<D> = PromiseLike<{ data: D | null; error: { code?: string; message?: string } | null; status?: number }>

function client() {
  if (!supabase) throw new CarbookError('unknown', 'no_client')
  return supabase
}

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK))
  return out
}

export function createCalendarLink(userId: string): CalendarLink {
  let categoryPromise: Promise<string> | null = null

  // RPC는 한 번만: 성공한 결과와 진행 중인 약속을 함께 쓰고, 실패하면 버려서 다음 호출이 다시 시도한다
  function ensureCategoryId(): Promise<string> {
    if (!categoryPromise) {
      const p = request<unknown>('ensureCategory', (s) => client().rpc('ensure_carbook_category').abortSignal(s) as Result<unknown>).then((id) => {
        if (typeof id !== 'string') throw new CarbookError('unknown', 'bad_response')
        return id
      })
      categoryPromise = p
      p.catch(() => { if (categoryPromise === p) categoryPromise = null })
    }
    return categoryPromise
  }

  async function fetchEvents(ids: string[]): Promise<Map<string, ExistingEvent>> {
    const found = new Map<string, ExistingEvent>()
    for (const chunk of chunks(ids)) {
      const rows = await request<ExistingEvent[]>('fetchEvents', (s) =>
        client().from('events').select(EVENT_COLS).eq('user_id', userId).in('id', chunk).retry(false).abortSignal(s) as Result<ExistingEvent[]>)
      for (const r of rows ?? []) found.set(r.id, r)
    }
    return found
  }

  async function upsertEvent(spec: LinkedEventSpec, categoryId: string): Promise<void> {
    const row = {
      id: spec.eventId, user_id: userId, title: spec.title, memo: null, category_id: categoryId, color: null,
      all_day: true, start_at: spec.date, end_at: spec.date, recurrence: null, excluded_dates: null,
    }
    await request('syncEvent', (s) => client().from('events').upsert(row, { onConflict: 'id' }).abortSignal(s) as Result<null>)
  }

  async function syncEvent(spec: LinkedEventSpec, known?: ExistingEvent | null): Promise<'written' | 'unchanged'> {
    let categoryId = await ensureCategoryId()
    const existing = known === undefined ? ((await fetchEvents([spec.eventId])).get(spec.eventId) ?? null) : known
    if (existing && existing.title === spec.title && existing.start_at === spec.date && existing.category_id === categoryId) return 'unchanged'
    try {
      await upsertEvent(spec, categoryId)
    } catch (e) {
      // 카테고리가 그새 지워졌으면(23503) 기억을 버리고 한 번만 다시 만들어 쓴다
      if (!(e instanceof CarbookError && e.kind === 'conflict' && e.code === '23503')) throw e
      categoryPromise = null
      categoryId = await ensureCategoryId()
      await upsertEvent(spec, categoryId)
    }
    return 'written'
  }

  async function deleteEvent(eventId: string): Promise<boolean> {
    const rows = await request<{ id: string }[]>('deleteEvent', (s) =>
      client().from('events').delete().eq('id', eventId).eq('user_id', userId).select('id').abortSignal(s) as Result<{ id: string }[]>)
    return (rows ?? []).length > 0
  }

  async function rebindCategory(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return
    const categoryId = await ensureCategoryId()
    for (const chunk of chunks(eventIds)) {
      await request('rebindCategory', (s) =>
        client().from('events').update({ category_id: categoryId }).eq('user_id', userId).in('id', chunk).abortSignal(s) as Result<null>)
    }
  }

  return { ensureCategoryId, fetchEvents, syncEvent, deleteEvent, rebindCategory }
}
