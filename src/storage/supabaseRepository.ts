// Supabase 기반 EventRepository 구현. supabase/schema.sql의 events/categories 테이블을 사용한다.
// snake_case(DB 컬럼) <-> camelCase(도메인 모델)는 여기서만 변환하고, 나머지 앱 코드는 모른다.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarEvent, Category, ID, RecurrenceRule } from '../types'
import type { EventRepository } from './repository'

interface EventRow {
  id: string
  user_id: string
  title: string
  memo: string | null
  category_id: string | null
  color: string | null
  all_day: boolean
  start_at: string
  end_at: string
  recurrence: RecurrenceRule | null
  excluded_dates: string[] | null
}

interface CategoryRow {
  id: string
  user_id: string
  name: string
  color: string
}

function eventToRow(event: CalendarEvent, userId: string) {
  return {
    id: event.id,
    user_id: userId,
    title: event.title,
    memo: event.memo ?? null,
    category_id: event.categoryId ?? null,
    color: event.color ?? null,
    all_day: event.allDay,
    start_at: event.start,
    end_at: event.end,
    recurrence: event.recurrence ?? null,
    excluded_dates: event.excludedDates ?? null,
  }
}

function eventFromRow(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    ownerId: row.user_id,
    title: row.title,
    memo: row.memo ?? undefined,
    categoryId: row.category_id ?? undefined,
    color: row.color ?? undefined,
    allDay: row.all_day,
    start: row.start_at,
    end: row.end_at,
    recurrence: row.recurrence ?? undefined,
    excludedDates: row.excluded_dates ?? undefined,
  }
}

function categoryToRow(category: Category, userId: string) {
  return { id: category.id, user_id: userId, name: category.name, color: category.color }
}

function categoryFromRow(row: CategoryRow): Category {
  return { id: row.id, ownerId: row.user_id, name: row.name, color: row.color }
}

export class SupabaseEventRepository implements EventRepository {
  private client: SupabaseClient
  private userId: string

  constructor(client: SupabaseClient, userId: string) {
    this.client = client
    this.userId = userId
  }

  async listEvents(): Promise<CalendarEvent[]> {
    const { data, error } = await this.client.from('events').select('*').order('start_at')
    if (error) throw error
    return (data as EventRow[]).map(eventFromRow)
  }

  async addEvent(event: CalendarEvent): Promise<void> {
    const { error } = await this.client.from('events').insert(eventToRow(event, this.userId))
    if (error) throw error
  }

  async updateEvent(event: CalendarEvent): Promise<void> {
    const { error } = await this.client
      .from('events')
      .update(eventToRow(event, this.userId))
      .eq('id', event.id)
    if (error) throw error
  }

  async deleteEvent(id: ID): Promise<void> {
    const { error } = await this.client.from('events').delete().eq('id', id)
    if (error) throw error
  }

  async listCategories(): Promise<Category[]> {
    const { data, error } = await this.client.from('categories').select('*').order('created_at')
    if (error) throw error
    return (data as CategoryRow[]).map(categoryFromRow)
  }

  async addCategory(category: Category): Promise<void> {
    const { error } = await this.client.from('categories').insert(categoryToRow(category, this.userId))
    if (error) throw error
  }

  async updateCategory(category: Category): Promise<void> {
    const { error } = await this.client
      .from('categories')
      .update(categoryToRow(category, this.userId))
      .eq('id', category.id)
    if (error) throw error
  }

  async deleteCategory(id: ID): Promise<void> {
    const { error } = await this.client.from('categories').delete().eq('id', id)
    if (error) throw error
  }
}
