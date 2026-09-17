// Supabase 기반 EventRepository 구현. supabase/schema.sql의 events/categories 테이블을 사용한다.
// snake_case(DB 컬럼) <-> camelCase(도메인 모델)는 여기서만 변환하고, 나머지 앱 코드는 모른다.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarEvent, Category, ID, RecurrenceRule, Todo } from '../types'
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

interface TodoRow {
  id: string
  user_id: string
  title: string
  memo: string | null
  done: boolean
  due_date: string | null
  category_id: string | null
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

function todoToRow(todo: Todo, userId: string) {
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    memo: todo.memo ?? null,
    done: todo.done,
    due_date: todo.dueDate ?? null,
    category_id: todo.categoryId ?? null,
  }
}

function todoFromRow(row: TodoRow): Todo {
  return {
    id: row.id,
    ownerId: row.user_id,
    title: row.title,
    memo: row.memo ?? undefined,
    done: row.done,
    dueDate: row.due_date ?? undefined,
    categoryId: row.category_id ?? undefined,
  }
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
    // user_id/id는 events_lock_identity 트리거가 서버에서도 고정하지만, 애초에 클라이언트가
    // 소유권을 바꾸려는 시도조차 보내지 않는다(19단계: 참여자가 수락한 함께 일정을 수정할 수
    // 있게 되면서, update에 user_id를 실어 보내던 기존 방식이 소유자를 바꿔버릴 위험이 생겼다).
    // 남의 일정(참여자로서 수정)일 때는 카테고리·색도 건드리지 않는다 — 작성자만 바꿀 수 있다.
    const { user_id: _user_id, category_id, color, ...rest } = eventToRow(event, this.userId)
    const isOwn = !event.ownerId || event.ownerId === this.userId
    const patch = isOwn ? { ...rest, category_id, color } : rest
    const { error } = await this.client.from('events').update(patch).eq('id', event.id)
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

  async listTodos(): Promise<Todo[]> {
    const { data, error } = await this.client.from('todos').select('*').order('created_at')
    if (error) throw error
    return (data as TodoRow[]).map(todoFromRow)
  }

  async addTodo(todo: Todo): Promise<void> {
    const { error } = await this.client.from('todos').insert(todoToRow(todo, this.userId))
    if (error) throw error
  }

  async updateTodo(todo: Todo): Promise<void> {
    const { error } = await this.client.from('todos').update(todoToRow(todo, this.userId)).eq('id', todo.id)
    if (error) throw error
  }

  async deleteTodo(id: ID): Promise<void> {
    const { error } = await this.client.from('todos').delete().eq('id', id)
    if (error) throw error
  }
}
