// CategoryList: 카테고리 추가/수정/삭제(확인 다이얼로그 포함)를 검증
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import CategoryList from './CategoryList'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderList(repo: FakeRepository) {
  render(
    <CalendarProvider repository={repo}>
      <CategoryList />
    </CalendarProvider>,
  )
}

describe('CategoryList', () => {
  it('카테고리를 추가한다', async () => {
    const repo = new FakeRepository()
    renderList(repo)

    fireEvent.click(screen.getByText('+ 카테고리 추가'))
    fireEvent.change(screen.getByLabelText('카테고리 이름'), { target: { value: '업무' } })
    fireEvent.click(screen.getByLabelText('추가'))

    await waitFor(() => expect(repo.categories).toHaveLength(1))
    expect(repo.categories[0]).toMatchObject({ name: '업무' })
    expect(await screen.findByText('업무')).toBeInTheDocument()
  })

  it('카테고리 이름을 수정한다', async () => {
    const repo = new FakeRepository()
    repo.categories.push({ id: 'c1', name: '업무', color: '#0066ff' })
    renderList(repo)

    fireEvent.click(await screen.findByText('업무'))
    const nameInput = screen.getByLabelText('카테고리 이름')
    fireEvent.change(nameInput, { target: { value: '개인' } })
    fireEvent.click(screen.getByLabelText('저장'))

    await waitFor(() => expect(repo.categories[0].name).toBe('개인'))
  })

  it('확인하면 카테고리를 삭제하고, 취소하면 유지한다', async () => {
    const repo = new FakeRepository()
    repo.categories.push({ id: 'c1', name: '업무', color: '#0066ff' })
    renderList(repo)
    await screen.findByText('업무')

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    fireEvent.click(screen.getByLabelText('업무 삭제'))
    expect(repo.categories).toHaveLength(1)

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    fireEvent.click(screen.getByLabelText('업무 삭제'))
    await waitFor(() => expect(repo.categories).toHaveLength(0))
  })
})
