// localRepository.ts (localStorage 기반 EventRepository) 테스트
import { beforeEach, describe, expect, it } from 'vitest'
import type { CalendarEvent, Category, Todo } from '../types'
import { LocalEventRepository } from './localRepository'

beforeEach(() => {
  localStorage.clear()
})

function event(id: string): CalendarEvent {
  return { id, title: `일정 ${id}`, allDay: true, start: '2026-09-01', end: '2026-09-01' }
}

function category(id: string): Category {
  return { id, name: `카테고리 ${id}`, color: '#0066ff' }
}

function todo(id: string): Todo {
  return { id, title: `할 일 ${id}`, done: false }
}

describe('이벤트 CRUD', () => {
  it('처음에는 빈 목록이다', async () => {
    expect(await new LocalEventRepository().listEvents()).toEqual([])
  })

  it('추가한 이벤트가 목록에 나타난다', async () => {
    const repo = new LocalEventRepository()
    await repo.addEvent(event('1'))
    expect(await repo.listEvents()).toEqual([event('1')])
  })

  it('수정한 이벤트가 반영된다', async () => {
    const repo = new LocalEventRepository()
    await repo.addEvent(event('1'))
    await repo.updateEvent({ ...event('1'), title: '수정됨' })
    const events = await repo.listEvents()
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('수정됨')
  })

  it('존재하지 않는 이벤트를 수정하면 에러를 던진다', async () => {
    const repo = new LocalEventRepository()
    await expect(repo.updateEvent(event('없음'))).rejects.toThrow()
  })

  it('삭제한 이벤트는 목록에서 사라진다', async () => {
    const repo = new LocalEventRepository()
    await repo.addEvent(event('1'))
    await repo.addEvent(event('2'))
    await repo.deleteEvent('1')
    expect(await repo.listEvents()).toEqual([event('2')])
  })

  it('새 인스턴스를 만들어도 localStorage에 저장된 데이터를 읽는다', async () => {
    await new LocalEventRepository().addEvent(event('1'))
    expect(await new LocalEventRepository().listEvents()).toEqual([event('1')])
  })
})

describe('카테고리 CRUD', () => {
  it('추가·수정·삭제가 동작한다', async () => {
    const repo = new LocalEventRepository()
    await repo.addCategory(category('1'))
    expect(await repo.listCategories()).toEqual([category('1')])

    await repo.updateCategory({ ...category('1'), name: '변경됨' })
    expect((await repo.listCategories())[0].name).toBe('변경됨')

    await repo.deleteCategory('1')
    expect(await repo.listCategories()).toEqual([])
  })
})

describe('할 일 CRUD', () => {
  it('추가·수정·완료 토글·삭제가 동작한다', async () => {
    const repo = new LocalEventRepository()
    await repo.addTodo(todo('1'))
    expect(await repo.listTodos()).toEqual([todo('1')])

    await repo.updateTodo({ ...todo('1'), done: true })
    expect((await repo.listTodos())[0].done).toBe(true)

    await repo.deleteTodo('1')
    expect(await repo.listTodos()).toEqual([])
  })

  it('존재하지 않는 할 일을 수정하면 에러를 던진다', async () => {
    const repo = new LocalEventRepository()
    await expect(repo.updateTodo(todo('없음'))).rejects.toThrow()
  })
})
