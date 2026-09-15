// 테스트용 인메모리 EventRepository 구현 (localStorage 없이 Provider/컴포넌트 테스트에 사용)
import type { CalendarEvent, Category, ID, Todo } from '../types'
import type { EventRepository } from '../storage/repository'

export class FakeRepository implements EventRepository {
  events: CalendarEvent[] = []
  categories: Category[] = []
  todos: Todo[] = []

  async listEvents() {
    return [...this.events]
  }
  async addEvent(event: CalendarEvent) {
    this.events.push(event)
  }
  async updateEvent(event: CalendarEvent) {
    this.events = this.events.map((e) => (e.id === event.id ? event : e))
  }
  async deleteEvent(id: ID) {
    this.events = this.events.filter((e) => e.id !== id)
  }
  async listCategories() {
    return [...this.categories]
  }
  async addCategory(category: Category) {
    this.categories.push(category)
  }
  async updateCategory(category: Category) {
    this.categories = this.categories.map((c) => (c.id === category.id ? category : c))
  }
  async deleteCategory(id: ID) {
    this.categories = this.categories.filter((c) => c.id !== id)
  }
  async listTodos() {
    return [...this.todos]
  }
  async addTodo(todo: Todo) {
    this.todos.push(todo)
  }
  async updateTodo(todo: Todo) {
    this.todos = this.todos.map((t) => (t.id === todo.id ? todo : t))
  }
  async deleteTodo(id: ID) {
    this.todos = this.todos.filter((t) => t.id !== id)
  }
}
