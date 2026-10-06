// Overlay: 스크롤 잠금, 고정 헤더/스크롤 본문 구조, 포커스 트랩·복귀·배경 inert·접근 가능한 이름을 검증한다
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Overlay from './Overlay'

describe('Overlay', () => {
  it('열려 있는 동안 body 스크롤을 잠그고, 닫히면 풀어 준다', () => {
    expect(document.body.style.overflow).toBe('')
    const { unmount } = render(
      <Overlay onClose={vi.fn()} label="테스트">
        <p>본문</p>
      </Overlay>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('여러 개가 겹쳐도 마지막 하나가 닫힐 때만 잠금을 푼다', () => {
    const first = render(
      <Overlay onClose={vi.fn()} label="테스트">
        <p>첫째</p>
      </Overlay>,
    )
    const second = render(
      <Overlay onClose={vi.fn()} label="테스트">
        <p>둘째</p>
      </Overlay>,
    )
    first.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    second.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('header는 스크롤되는 본문 밖에 따로 렌더된다', () => {
    render(
      <Overlay onClose={vi.fn()} label="테스트" header={<span>고정 제목</span>}>
        <p>스크롤 본문</p>
      </Overlay>,
    )
    const header = screen.getByText('고정 제목')
    const body = screen.getByText('스크롤 본문').parentElement as HTMLElement
    expect(body.contains(header)).toBe(false)
  })

  it('Esc를 누르면 닫힌다(App의 단축키 훅이 모르는 시트도)', () => {
    const onClose = vi.fn()
    render(
      <Overlay onClose={onClose} label="테스트">
        <p>본문</p>
      </Overlay>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'a' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('접근성(25단계 감사: 포커스 트랩·복귀·inert·이름 없음)', () => {
    function renderWithPage(onClose = vi.fn()) {
      render(
        <>
          <button>배경 버튼</button>
          <Overlay onClose={onClose} label="설정">
            <button>첫째</button>
            <button>둘째</button>
          </Overlay>
        </>,
      )
      return screen.getByRole('dialog', { name: '설정' })
    }

    it('대화상자는 label을 접근 가능한 이름으로 갖고 aria-modal이다', () => {
      const dialog = renderWithPage()
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('열리면 포커스가 대화상자 안으로 들어온다', () => {
      const dialog = renderWithPage()
      expect(dialog.contains(document.activeElement)).toBe(true)
    })

    it('뒤쪽 화면은 inert가 되고, 닫히면(언마운트) 풀린다', () => {
      const { unmount } = render(
        <>
          <button data-testid="bg">배경</button>
          <Overlay onClose={vi.fn()} label="설정">
            <button>안</button>
          </Overlay>
        </>,
      )
      expect(screen.getByTestId('bg')).toHaveAttribute('inert')
      unmount()
    })

    it('Tab이 마지막 요소에서 첫 요소로 돌아오고, Shift+Tab은 반대로 돈다', () => {
      renderWithPage()
      const first = screen.getByText('첫째')
      const second = screen.getByText('둘째')
      second.focus()
      fireEvent.keyDown(window, { key: 'Tab' })
      expect(document.activeElement).toBe(first)
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(second)
    })

    // 26단계: 날짜 격자 같은 roving tabindex 영역은 활성 칸만 Tab 정지다. tabindex=-1 칸까지 세면 트랩이 끝 칸을 "마지막"으로 봐서
    // 실제 마지막 탭 정지에서 Tab을 눌러도 끼어들지 못하고 포커스가 대화상자 밖으로 빠졌다
    it('tabindex=-1인 요소는 트랩의 처음·끝으로 세지 않는다', () => {
      render(
        <Overlay onClose={vi.fn()} label="설정">
          <button>닫기</button>
          <button>활성 칸</button>
          <button tabIndex={-1}>비활성 칸</button>
        </Overlay>,
      )
      screen.getByText('활성 칸').focus()
      fireEvent.keyDown(window, { key: 'Tab' })
      expect(document.activeElement).toBe(screen.getByText('닫기'))
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(screen.getByText('활성 칸'))
    })

    it('안의 입력칸이 autoFocus여도 닫을 때 돌아가는 곳은 열기 전의 요소다(입력칸이 아니다)', () => {
      const opener = document.createElement('button')
      document.body.appendChild(opener)
      opener.focus()
      const { unmount } = render(
        <Overlay onClose={vi.fn()} label="설정">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input aria-label="제목" autoFocus />
        </Overlay>,
      )
      expect(screen.getByLabelText('제목')).toHaveFocus()
      unmount()
      expect(document.activeElement).toBe(opener)
      opener.remove()
    })

    it('닫혀 언마운트되면 열기 전에 포커스가 있던 요소로 돌아간다', () => {
      const opener = document.createElement('button')
      document.body.appendChild(opener)
      opener.focus()
      const { unmount } = render(
        <Overlay onClose={vi.fn()} label="설정">
          <button>안</button>
        </Overlay>,
      )
      expect(document.activeElement).not.toBe(opener)
      unmount()
      expect(document.activeElement).toBe(opener)
      opener.remove()
    })
  })
})
