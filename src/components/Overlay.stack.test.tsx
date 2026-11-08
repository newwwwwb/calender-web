// Overlay 겹침 테스트: 대화상자 위에 다른 대화상자가 열리면 Esc·Tab은 가장 위 하나만 처리한다(Auditor G1, WCAG 2.1.1·2.4.3)
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Overlay from './Overlay'

// 실제처럼 아래 창이 먼저 열린 뒤에 위 창이 열리게 한다(같은 커밋에 둘이 뜨면 서로를 inert로 만든다)
function mountStacked(bottom: () => void, top: () => void) {
  const view = render(<Stacked onCloseBottom={bottom} onCloseTop={top} showTop={false} />)
  view.rerender(<Stacked onCloseBottom={bottom} onCloseTop={top} />)
  return view
}

function Stacked({ onCloseBottom, onCloseTop, showTop = true }: { onCloseBottom: () => void; onCloseTop: () => void; showTop?: boolean }) {
  return (
    <>
      <Overlay label="아래" onClose={onCloseBottom}>
        <button>아래 첫째</button>
        <button>아래 끝</button>
      </Overlay>
      {showTop && (
        <Overlay label="위" onClose={onCloseTop}>
          <button>위 첫째</button>
          <button>위 가운데</button>
          <button>위 끝</button>
        </Overlay>
      )}
    </>
  )
}

describe('겹친 Overlay의 키 처리', () => {
  it('Esc는 가장 위 창만 닫고 아래 창은 그대로 둔다', () => {
    const bottom = vi.fn()
    const top = vi.fn()
    mountStacked(bottom, top)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(top).toHaveBeenCalledTimes(1)
    expect(bottom).not.toHaveBeenCalled()
  })

  it('위 창이 닫히면 Esc가 다시 아래 창을 닫는다', () => {
    const bottom = vi.fn()
    const top = vi.fn()
    const { rerender } = mountStacked(bottom, top)
    rerender(<Stacked onCloseBottom={bottom} onCloseTop={top} showTop={false} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(bottom).toHaveBeenCalledTimes(1)
    expect(top).not.toHaveBeenCalled()
  })

  it('Tab은 가장 위 창의 끝에서 그 창의 첫 요소로 돈다(아래 창 기준으로 한 번 더 돌지 않는다)', () => {
    mountStacked(vi.fn(), vi.fn())
    const topEnd = screen.getByRole('button', { name: '위 끝' })
    topEnd.focus()
    fireEvent.keyDown(topEnd, { key: 'Tab' })
    expect(screen.getByRole('button', { name: '위 첫째' })).toHaveFocus()
  })

  it('Tab이 가운데 요소에서는 아래 창이 가로채지 않는다(기본 동작을 막지 않고 포커스도 그대로)', () => {
    mountStacked(vi.fn(), vi.fn())
    const middle = screen.getByRole('button', { name: '위 가운데' })
    middle.focus()
    const notPrevented = fireEvent.keyDown(middle, { key: 'Tab' })
    expect(notPrevented).toBe(true)
    expect(middle).toHaveFocus()
  })

  it('Shift+Tab은 가장 위 창의 첫 요소에서 그 창의 끝 요소로 돈다', () => {
    mountStacked(vi.fn(), vi.fn())
    const topFirst = screen.getByRole('button', { name: '위 첫째' })
    topFirst.focus()
    fireEvent.keyDown(topFirst, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: '위 끝' })).toHaveFocus()
  })
})
