// FileTabs 테스트: 현재 탭에 포커스가 가도 현재 표시가 남는지, 강제색·왼쪽 막대 스타일 규칙이 규격대로인지(MPR-41)
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import FileTabs from './FileTabs'

const css = readFileSync('src/carbook/FileTabs.module.css', 'utf-8') // vitest는 프로젝트 루트에서 실행된다

afterEach(() => {
  window.history.pushState({}, '', '/')
})

describe('FileTabs 현재 탭 포커스', () => {
  it('현재 탭에 포커스가 가도 aria-current와 현재 표시 클래스가 유지된다', () => {
    render(<FileTabs />)
    const current = screen.getByRole('link', { name: '캘린더' })
    current.focus()
    expect(current).toHaveFocus()
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current.className).toMatch(/current/)
    expect(screen.getByRole('link', { name: '차계부' })).not.toHaveAttribute('aria-current')
  })
})

// jsdom은 CSS 모듈을 적용하지 않아 스타일 자체는 규칙 문자열로 확인한다(렌더링은 Chrome 실측으로 확인)
describe('FileTabs 스타일 규칙', () => {
  it('현재 탭의 왼쪽 막대는 box-shadow가 아니라 border-left로 그린다(포커스·강제색에서도 남게)', () => {
    const current = css.match(/\n\.current \{[^}]*\}/)?.[0] ?? ''
    expect(current).toMatch(/border-left:\s*var\(--line-accent\)\s+solid\s+var\(--color-primary-fill\)/)
    expect(current).not.toMatch(/box-shadow/)
  })

  it('강제색에서 현재 탭은 Highlight 면·HighlightText, 비선택은 Canvas·CanvasText, 테두리는 ButtonText다', () => {
    const block = css.slice(css.indexOf('@media (forced-colors: active)'))
    expect(block).toMatch(/\.tab \{[^}]*background-color:\s*Canvas[^}]*color:\s*CanvasText[^}]*border-color:\s*ButtonText/s)
    expect(block).toMatch(/\.current \{[^}]*background-color:\s*Highlight[^}]*color:\s*HighlightText/s)
    expect(block).toMatch(/\.current \.label \{[^}]*forced-color-adjust:\s*none[^}]*color:\s*HighlightText/s) // Chrome 글자 backplate 방지
    expect(block).toMatch(/\.tab:focus-visible \{[^}]*outline-color:\s*CanvasText/s)
    expect(block).toMatch(/\.current:focus-visible \{[^}]*outline-color:\s*HighlightText[^}]*outline-offset:\s*calc\(\(var\(--line-accent\) \+ var\(--line-medium\)\) \* -1\)/s) // Highlight 면 위에서도 포커스가 보이게
  })
})
