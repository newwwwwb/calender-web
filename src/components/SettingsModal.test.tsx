// SettingsModal: 데이터/디자인 섹션을 보여주고, 오버레이/닫기 버튼 클릭 시 onClose를 호출하는지 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import SettingsModal from './SettingsModal'

function renderModal(onClose = vi.fn()) {
  render(
    <CalendarProvider repository={new FakeRepository()}>
      <SettingsModal onClose={onClose} />
    </CalendarProvider>,
  )
  return onClose
}

describe('SettingsModal', () => {
  it('데이터와 디자인 섹션을 보여준다', () => {
    renderModal()
    expect(screen.getByText('데이터')).toBeInTheDocument()
    expect(screen.getByText('내보내기')).toBeInTheDocument()
    expect(screen.getByText('디자인')).toBeInTheDocument()
    expect(screen.getByLabelText('디자인 테마')).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = renderModal()
    fireEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })

  it('오버레이 클릭 시 onClose를 호출하지만, 모달 내부 클릭으로는 닫히지 않는다', () => {
    const onClose = renderModal()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalled()
  })
})
