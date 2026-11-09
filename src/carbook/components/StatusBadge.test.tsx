// StatusBadge 테스트(F-06 BR-14, components.md 7장): 글자로 상태를 알리고 장식 아이콘은 읽히지 않는다
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it.each([
    ['soon', '곧 교체'],
    ['overdue', '교체 시기 지남'],
  ] as const)('%s는 "%s" 글자를 보인다', (status, label) => {
    const { container } = render(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('두 상태는 아이콘 모양이 다르다(색만으로 구분하지 않는다)', () => {
    const soon = render(<StatusBadge status="soon" />).container.querySelector('svg')!.innerHTML
    const overdue = render(<StatusBadge status="overdue" />).container.querySelector('svg')!.innerHTML
    expect(soon).not.toBe(overdue)
  })
})
