// Badge: count에 따른 표시/숨김, 9 초과 시 "9+" 표기, 값이 바뀔 때 이전 값이 남지 않는지 검증
import { render, screen, waitFor } from '@testing-library/react'
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

  it('9를 넘으면 "9+"로 표시한다', () => {
    render(<Badge count={12} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  it('count가 0으로 줄면 사라진다', async () => {
    const { rerender } = render(<Badge count={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    rerender(<Badge count={0} />)
    await waitFor(() => expect(screen.queryByText('3')).not.toBeInTheDocument())
  })

  it('count가 바뀌면 새 값 하나만 남는다(이전 값과 함께 보이지 않음)', async () => {
    const { rerender } = render(<Badge count={3} />)
    rerender(<Badge count={4} />)
    await waitFor(() => expect(screen.queryByText('3')).not.toBeInTheDocument())
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
