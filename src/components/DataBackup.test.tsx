// DataBackup: JSON 내보내기 트리거, 가져오기(유효/무효/거부) 동작을 검증
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import DataBackup from './DataBackup'

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderBackup(repo: FakeRepository) {
  return render(
    <CalendarProvider repository={repo}>
      <DataBackup />
    </CalendarProvider>,
  )
}

function jsonFile(content: unknown, name = 'backup.json') {
  return new File([JSON.stringify(content)], name, { type: 'application/json' })
}

describe('DataBackup', () => {
  it('내보내기를 누르면 다운로드를 트리거한다', async () => {
    const repo = new FakeRepository()
    renderBackup(repo)
    await screen.findByText('내보내기')

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByText('내보내기'))

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('올바르지 않은 JSON 파일이면 경고하고 아무것도 바꾸지 않는다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '기존 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    renderBackup(repo)
    await screen.findByText('내보내기')

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const badFile = new File(['이건 JSON이 아님'], 'bad.json', { type: 'application/json' })
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [badFile] } })

    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    expect(repo.events).toHaveLength(1)
  })

  it('events/categories 배열이 없는 JSON이면 경고한다', async () => {
    const repo = new FakeRepository()
    renderBackup(repo)
    await screen.findByText('내보내기')

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: { files: [jsonFile({ hello: 'world' })] },
    })

    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
  })

  it('배열 안의 항목이 필수 필드가 없으면 경고하고 가져오지 않는다', async () => {
    // 회귀 테스트: 항목 단위 검증이 없어서 {"events":[{}]} 같은 파일도 통과해 title이
    // undefined인 채 저장되던 문제(보스 리뷰에서 발견)
    const repo = new FakeRepository()
    renderBackup(repo)
    await screen.findByText('내보내기')

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: { files: [jsonFile({ events: [{}], categories: [] })] },
    })

    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    expect(repo.events).toHaveLength(0)
  })

  it('확인을 취소하면 기존 데이터를 그대로 둔다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '기존 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    renderBackup(repo)
    await screen.findByText('내보내기')

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const backup = {
      events: [{ id: 'new', title: '가져온 일정', allDay: true, start: '2026-09-20', end: '2026-09-20' }],
      categories: [],
    }
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [jsonFile(backup)] } })

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled())
    expect(repo.events).toHaveLength(1)
    expect(repo.events[0].id).toBe('e1')
  })

  it('확인하면 기존 데이터를 지우고 파일 내용으로 바꾼다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'old', title: '기존 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    repo.categories.push({ id: 'oldCat', name: '기존 카테고리', color: '#000000' })
    renderBackup(repo)
    await screen.findByText('내보내기')

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const backup = {
      events: [
        { id: 'new', title: '가져온 일정', allDay: true, start: '2026-09-20', end: '2026-09-20', categoryId: 'newCat' },
      ],
      categories: [{ id: 'newCat', name: '가져온 카테고리', color: '#123456' }],
    }
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [jsonFile(backup)] } })

    await waitFor(() => expect(repo.events.map((e) => e.id)).toEqual(['new']))
    expect(repo.categories.map((c) => c.id)).toEqual(['newCat'])
  })

  it('할 일도 함께 지우고 파일 내용(todos)으로 바꾼다', async () => {
    const repo = new FakeRepository()
    repo.todos.push({ id: 'oldTodo', title: '기존 할 일', done: false })
    renderBackup(repo)
    await screen.findByText('내보내기')

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const backup = {
      events: [],
      categories: [],
      todos: [{ id: 'newTodo', title: '가져온 할 일', done: true }],
    }
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [jsonFile(backup)] } })

    await waitFor(() => expect(repo.todos.map((t) => t.id)).toEqual(['newTodo']))
  })
})
