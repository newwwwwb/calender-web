// CalendarRetryButton·IntervalHint 테스트(F-08 MSG-11, F-12 MSG-12): 이름, 진행 중 중복 요청 방지, 안내 문구
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CalendarRetryButton from './CalendarRetryButton'
import IntervalHint from './IntervalHint'

describe('CalendarRetryButton (MSG-11)', () => {
  it('버튼 이름은 MSG-11 문구로 시작하고 어느 행의 버튼인지 덧붙는다', () => {
    render(<CalendarRetryButton target="교체 항목 엔진오일" onRetry={() => Promise.resolve()} />)
    expect(screen.getByRole('button', { name: '캘린더 반영 실패, 다시 시도, 교체 항목 엔진오일' })).toBeInTheDocument()
    expect(screen.getByText('캘린더 반영 실패, 다시 시도')).toBeInTheDocument()
  })

  it('진행 중에는 aria-disabled이고 다시 눌러도 요청이 1건이며 포커스를 잃지 않는다', async () => {
    let finish: () => void = () => {}
    const onRetry = vi.fn(() => new Promise<void>((r) => (finish = r)))
    render(<CalendarRetryButton target="보험 만기" onRetry={onRetry} />)
    const button = screen.getByRole('button')
    button.focus()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveFocus()
    await act(async () => finish())
    expect(button).not.toHaveAttribute('aria-disabled')
    fireEvent.click(button)
    expect(onRetry).toHaveBeenCalledTimes(2) // 끝난 뒤에는 다시 누를 수 있다
  })

  it('요청이 reject해도 버튼이 영구히 잠기지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<CalendarRetryButton target="보험 만기" onRetry={() => Promise.reject(new Error('x'))} />)
    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-disabled')
  })
})

describe('IntervalHint (MSG-12)', () => {
  it('문구가 실제 텍스트로 보이고 닫기 버튼이 없다 (AC-12-4)', () => {
    render(<IntervalHint />)
    expect(screen.getByText('참고용 값입니다. 차량 매뉴얼을 우선하세요')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
