// Badge: count에 따른 표시/숨김과 max 초과 시 "9+" 표기를 검증
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Badge from './Badge'

describe('Badge', () => {
  it('count가 0이면 아무것도 표시하지 않는다', () => {
    render(<Badge count={0} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('count를 그대로 보여준다', () => {
    render(<Badge count={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('max를 넘으면 "max+"로 표시한다', () => {
    render(<Badge count={12} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  it('max를 지정하면 그 기준으로 넘친다', () => {
    render(<Badge count={5} max={4} />)
    expect(screen.getByText('4+')).toBeInTheDocument()
  })
})
