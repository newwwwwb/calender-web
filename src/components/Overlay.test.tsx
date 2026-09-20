// Overlay: 열려 있는 동안 뒤 페이지 스크롤 잠금, 고정 헤더/스크롤 본문 구조를 검증한다
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Overlay from './Overlay'

describe('Overlay', () => {
  it('열려 있는 동안 body 스크롤을 잠그고, 닫히면 풀어 준다', () => {
    expect(document.body.style.overflow).toBe('')
    const { unmount } = render(
      <Overlay onClose={vi.fn()}>
        <p>본문</p>
      </Overlay>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('여러 개가 겹쳐도 마지막 하나가 닫힐 때만 잠금을 푼다', () => {
    const first = render(
      <Overlay onClose={vi.fn()}>
        <p>첫째</p>
      </Overlay>,
    )
    const second = render(
      <Overlay onClose={vi.fn()}>
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
      <Overlay onClose={vi.fn()} header={<span>고정 제목</span>}>
        <p>스크롤 본문</p>
      </Overlay>,
    )
    const header = screen.getByText('고정 제목')
    const body = screen.getByText('스크롤 본문').parentElement as HTMLElement
    expect(body.contains(header)).toBe(false)
  })
})
