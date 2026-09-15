// localStorage 기반 EventRepository 구현 (마지막 단계에서 supabaseRepository로 교체 예정)
import type { CalendarEvent, Category, ID, Todo } from '../types'
import type { EventRepository } from './repository'

const EVENTS_KEY = 'calendar.events'
const CATEGORIES_KEY = 'calendar.categories'
const TODOS_KEY = 'calendar.todos'

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

  async listTodos(): Promise<Todo[]> {
    return readList<Todo>(TODOS_KEY)
  }

  async addTodo(todo: Todo): Promise<void> {
    const todos = readList<Todo>(TODOS_KEY)
    todos.push(todo)
    writeList(TODOS_KEY, todos)
  }

  async updateTodo(todo: Todo): Promise<void> {
    const todos = readList<Todo>(TODOS_KEY)
    const index = todos.findIndex((t) => t.id === todo.id)
    if (index === -1) throw new Error(`할 일을 찾을 수 없습니다: ${todo.id}`)
    todos[index] = todo
    writeList(TODOS_KEY, todos)
  }

  async deleteTodo(id: ID): Promise<void> {
    writeList(
      TODOS_KEY,
      readList<Todo>(TODOS_KEY).filter((t) => t.id !== id),
    )
  }
}
