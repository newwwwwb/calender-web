// TodoSheet: 할 일 목록을 담은 바텀시트가 열리고, 오버레이/닫기 버튼 클릭 시 onClose를 호출하는지 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import TodoSheet from './TodoSheet'

function renderSheet(onClose = vi.fn()) {
  render(
    <CalendarProvider repository={new FakeRepository()}>
      <TodoSheet onClose={onClose} />
    </CalendarProvider>,
  )
  return onClose
}

describe('TodoSheet', () => {
  it('할 일 목록을 보여준다', () => {
    renderSheet()
    expect(screen.getByText('+ 할 일 추가')).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = renderSheet()
    fireEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })

  it('오버레이 클릭 시 onClose를 호출하지만, 시트 내부 클릭으로는 닫히지 않는다', () => {
    const onClose = renderSheet()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalled()
  })
})
