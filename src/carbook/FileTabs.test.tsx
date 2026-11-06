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

// 레이아웃은 jsdom이 계산하지 못해, 배치를 정하는 CSS 규칙과 토큰 값을 확인한다(실제 위치·크기·스와이프는 Chrome 실측으로 확인)
describe('FileTabs 모바일 배치 규칙 (F-14)', () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf-8')
  const token = (name: string) => parseInt(tokens.split(`--${name}:`)[1]) // 값 앞 공백은 parseInt가 넘기고 'px'·';'에서 멈춘다
  const z = token

  it('AC-14-5: 모바일 탭 하나의 크기는 너비 24px 이상, 높이 44px 이상이다', () => {
    expect(token('tab-mobile-w')).toBeGreaterThanOrEqual(24)
    expect(token('tab-mobile-h')).toBeGreaterThanOrEqual(44)
  })

  it('AC-14-4: 탭은 fixed로 흐름 밖에 있어 캘린더 요소의 크기·위치에 영향을 주지 않는다', () => {
    const nav = css.match(/\n\.nav \{[^}]*\}/)?.[0] ?? ''
    expect(nav).toMatch(/position:\s*fixed/)
    expect(nav).not.toMatch(/(margin|padding)/)
  })

  it('탭은 FAB보다 위, 오버레이보다 아래 층이다', () => {
    expect(z('z-tab')).toBeGreaterThan(z('z-fab'))
    expect(z('z-tab')).toBeLessThan(z('z-overlay'))
  })

  it('안전 영역(노치)만큼 오른쪽에서 띄운다', () => {
    expect(css).toMatch(/right:\s*calc\(var\(--tab-inset\) \+ env\(safe-area-inset-right\)\)/)
  })

  it('현재 탭의 글자는 막대 두께 차이만큼 되돌려 다른 탭과 같은 세로선에 놓인다', () => {
    expect(css).toMatch(/\.current \.label \{[^}]*margin-left:\s*calc\(\(var\(--line-thin\) - var\(--line-accent\)\) \/ 2\)/)
  })
})

