// RecurrenceScopeDialog: 반복 일정 적용 범위 3택과 취소가 올바른 콜백을 부르는지 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RecurrenceScopeDialog from './RecurrenceScopeDialog'

describe('RecurrenceScopeDialog', () => {
  it('세 범위 버튼이 각각 해당 범위로 onChoose를 부른다', () => {
    const onChoose = vi.fn()
    render(<RecurrenceScopeDialog onChoose={onChoose} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByText('이 일정만'))
    fireEvent.click(screen.getByText('이 일정과 이후 일정'))
    fireEvent.click(screen.getByText('모든 반복 일정'))

    expect(onChoose.mock.calls.map((c) => c[0])).toEqual(['this', 'following', 'all'])
  })

  it('취소 버튼과 Esc는 onCancel을 부르고 onChoose는 부르지 않는다', () => {
    const onChoose = vi.fn()
    const onCancel = vi.fn()
    render(<RecurrenceScopeDialog onChoose={onChoose} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('취소'))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('막힌 범위는 비활성이고 안내가 보이며, 막히지 않은 범위는 그대로 고를 수 있다', () => {
    const onChoose = vi.fn()
    render(<RecurrenceScopeDialog onChoose={onChoose} disabledScopes={['following', 'all']} onCancel={vi.fn()} />)

    expect(screen.getByText('이 일정과 이후 일정').closest('button')).toBeDisabled()
    expect(screen.getByText('모든 반복 일정').closest('button')).toBeDisabled()
    expect(screen.getByText(/같은 달 안\(28일까지\)에서만/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('이 일정만'))
    expect(onChoose).toHaveBeenCalledWith('this')
  })

  it('"어떤 일정에 적용할까요?" 질문이 있는 이름 붙은 대화상자다', () => {
    render(<RecurrenceScopeDialog onChoose={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: '반복 일정 적용 범위' })).toHaveTextContent('어떤 일정에 적용할까요?')
  })
})
