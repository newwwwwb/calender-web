// localStorage 기반 EventRepository 구현 (마지막 단계에서 supabaseRepository로 교체 예정)
import type { CalendarEvent, Category, ID } from '../types'
import type { EventRepository } from './repository'

const EVENTS_KEY = 'calendar.events'
const CATEGORIES_KEY = 'calendar.categories'

function readList<T>(key: string): T[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []
  try {
    return JSON.parse(raw) as T[]
  } catch {
    return []
  }
}

function writeList<T>(key: string, list: T[]): void {
  localStorage.setItem(key, JSON.stringify(list))
}

export class LocalEventRepository implements EventRepository {
  async listEvents(): Promise<CalendarEvent[]> {
    return readList<CalendarEvent>(EVENTS_KEY)
  }

  async addEvent(event: CalendarEvent): Promise<void> {
    const events = readList<CalendarEvent>(EVENTS_KEY)
    events.push(event)
    writeList(EVENTS_KEY, events)
  }

  async updateEvent(event: CalendarEvent): Promise<void> {
    const events = readList<CalendarEvent>(EVENTS_KEY)
    const index = events.findIndex((e) => e.id === event.id)
    if (index === -1) throw new Error(`일정을 찾을 수 없습니다: ${event.id}`)
    events[index] = event
    writeList(EVENTS_KEY, events)
  }

  async deleteEvent(id: ID): Promise<void> {
    writeList(
      EVENTS_KEY,
      readList<CalendarEvent>(EVENTS_KEY).filter((e) => e.id !== id),
    )
  }

  async listCategories(): Promise<Category[]> {
    return readList<Category>(CATEGORIES_KEY)
  }

  async addCategory(category: Category): Promise<void> {
    const categories = readList<Category>(CATEGORIES_KEY)
    categories.push(category)
    writeList(CATEGORIES_KEY, categories)
  }

  async updateCategory(category: Category): Promise<void> {
    const categories = readList<Category>(CATEGORIES_KEY)
    const index = categories.findIndex((c) => c.id === category.id)
    if (index === -1) throw new Error(`카테고리를 찾을 수 없습니다: ${category.id}`)
    categories[index] = category
    writeList(CATEGORIES_KEY, categories)
  }

  async deleteCategory(id: ID): Promise<void> {
    writeList(
      CATEGORIES_KEY,
      readList<Category>(CATEGORIES_KEY).filter((c) => c.id !== id),
    )
  }
}
