// 일정·카테고리 저장소 인터페이스: localStorage 구현을 나중에 Supabase 구현으로
// 교체할 수 있도록 CRUD를 인터페이스 뒤에 둔다. Supabase는 네트워크 호출이라
// 모든 메서드를 Promise 기반으로 통일해 둔다.
import type { CalendarEvent, Category, ID } from '../types'

export interface EventRepository {
  listEvents(): Promise<CalendarEvent[]>
  addEvent(event: CalendarEvent): Promise<void>
  updateEvent(event: CalendarEvent): Promise<void>
  deleteEvent(id: ID): Promise<void>

  listCategories(): Promise<Category[]>
  addCategory(category: Category): Promise<void>
  updateCategory(category: Category): Promise<void>
  deleteCategory(id: ID): Promise<void>
}
