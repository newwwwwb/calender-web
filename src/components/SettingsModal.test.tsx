// SettingsModal: 데이터/디자인 섹션을 보여주고, 오버레이/닫기 버튼 클릭 시 onClose를 호출하는지 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import { stubMobileViewport } from '../test/mobile'
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
  it('카테고리·공유 캘린더·데이터·디자인 섹션을 보여준다', () => {
    // 카테고리·공유 캘린더 섹션: Sidebar가 숨는 모바일에서 유일한 접근 경로(보스 리뷰로 발견한 공백 수정)
    renderModal()
    expect(screen.getByText('카테고리')).toBeInTheDocument()
    expect(screen.getByText('+ 카테고리 추가')).toBeInTheDocument()
    expect(screen.getByText('공유 캘린더')).toBeInTheDocument()
    expect(screen.getByText('로그인하면 캘린더를 공유할 수 있어요')).toBeInTheDocument()
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

  describe('모바일: 헤더에 자리가 없어진 계정', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('모바일에서는 계정 섹션에 로그인 버튼을 보여준다', () => {
      stubMobileViewport()
      renderModal()
      expect(screen.getByText('계정')).toBeInTheDocument()
      expect(screen.getByText('로그인')).toBeInTheDocument()
    })

    it('데스크톱에서는 계정 섹션이 없다(헤더에 로그인 버튼이 있음)', () => {
      renderModal()
      expect(screen.queryByText('계정')).not.toBeInTheDocument()
    })
  })
})
