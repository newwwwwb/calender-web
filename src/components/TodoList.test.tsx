// TodoList: 할 일 추가/수정/삭제(확인 다이얼로그 포함)/완료 토글/정렬을 검증
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import TodoList from './TodoList'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderList(repo: FakeRepository) {
  render(
    <CalendarProvider repository={repo}>
      <TodoList />
    </CalendarProvider>,
  )
}

describe('TodoList', () => {
  it('할 일을 추가한다', async () => {
    const repo = new FakeRepository()
    renderList(repo)

    fireEvent.click(screen.getByText('+ 할 일 추가'))
    fireEvent.change(screen.getByLabelText('할 일 제목'), { target: { value: '빨래' } })
    fireEvent.click(screen.getByLabelText('저장'))

    await waitFor(() => expect(repo.todos).toHaveLength(1))
    expect(repo.todos[0]).toMatchObject({ title: '빨래', done: false })
    expect(await screen.findByText('빨래')).toBeInTheDocument()
  })

  it('할 일 제목을 수정한다', async () => {
    const repo = new FakeRepository()
    repo.todos.push({ id: 't1', title: '빨래', done: false })
    renderList(repo)

    fireEvent.click(await screen.findByText('빨래'))
    fireEvent.change(screen.getByLabelText('할 일 제목'), { target: { value: '청소' } })
    fireEvent.click(screen.getByLabelText('저장'))

    await waitFor(() => expect(repo.todos[0].title).toBe('청소'))
  })

  it('체크박스로 완료 상태를 토글한다', async () => {
    const repo = new FakeRepository()
    repo.todos.push({ id: 't1', title: '빨래', done: false })
    renderList(repo)

    const checkbox = await screen.findByLabelText('빨래 완료')
    fireEvent.click(checkbox)

    await waitFor(() => expect(repo.todos[0].done).toBe(true))
  })

  it('확인하면 할 일을 삭제하고, 취소하면 유지한다', async () => {
    const repo = new FakeRepository()
    repo.todos.push({ id: 't1', title: '빨래', done: false })
    renderList(repo)
    await screen.findByText('빨래')

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    fireEvent.click(screen.getByLabelText('빨래 삭제'))
    expect(repo.todos).toHaveLength(1)

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    fireEvent.click(screen.getByLabelText('빨래 삭제'))
    await waitFor(() => expect(repo.todos).toHaveLength(0))
  })

  it('완료된 할 일은 목록 아래로 내려간다', async () => {
    const repo = new FakeRepository()
    repo.todos.push({ id: 't1', title: '완료됨', done: true })
    repo.todos.push({ id: 't2', title: '미완료', done: false })
    renderList(repo)

    await screen.findByText('완료됨')
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items[0]).toContain('미완료')
    expect(items[1]).toContain('완료됨')
  })
})
