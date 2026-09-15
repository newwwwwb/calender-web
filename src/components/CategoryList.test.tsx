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

  it('이름 입력란에서 Enter를 누르면 저장된다(추가/수정 둘 다)', async () => {
    // 회귀 테스트: 체크 버튼을 직접 눌러야만 저장되고 Enter는 무시되던 사용성 문제(보스 리뷰에서 발견)
    const repo = new FakeRepository()
    repo.categories.push({ id: 'c1', name: '업무', color: '#0066ff' })
    renderList(repo)

    fireEvent.click(screen.getByText('+ 카테고리 추가'))
    fireEvent.change(screen.getByLabelText('카테고리 이름'), { target: { value: '개인' } })
    fireEvent.keyDown(screen.getByLabelText('카테고리 이름'), { key: 'Enter' })
    await waitFor(() => expect(repo.categories).toHaveLength(2))

    fireEvent.click(await screen.findByText('업무'))
    fireEvent.change(screen.getByLabelText('카테고리 이름'), { target: { value: '업무(수정)' } })
    fireEvent.keyDown(screen.getByLabelText('카테고리 이름'), { key: 'Enter' })
    await waitFor(() => expect(repo.categories.find((c) => c.id === 'c1')?.name).toBe('업무(수정)'))
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

  it('공유받은(남의) 카테고리는 목록에 안 보인다', async () => {
    // 회귀 테스트: RLS가 수정/삭제를 막는데 UI엔 남의 카테고리도 보여서 클릭해도 조용히
    // 아무 일도 안 일어나던 버그(보스 리뷰에서 발견)
    const repo = new FakeRepository()
    repo.categories.push({ id: 'c1', name: '내 카테고리', color: '#0066ff' })
    repo.categories.push({ id: 'c2', name: '남의 카테고리', color: '#00aa00', ownerId: 'other-user' })
    renderList(repo)

    await screen.findByText('내 카테고리')
    expect(screen.queryByText('남의 카테고리')).not.toBeInTheDocument()
  })
})
