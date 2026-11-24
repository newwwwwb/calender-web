// AuthExpiredNotice 테스트: MSG-30·MSG-37 알림, 로그인 버튼, 대화상자 안 배치와 닫히면 해제(AC-27-7·9·11)
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthExpiredNotice from './AuthExpiredNotice'

afterEach(() => vi.restoreAllMocks())

describe('대화상자가 없을 때', () => {
  it('MSG-30이 알림으로, MSG-37이 "로그인" 옆에 보이고 닫기 버튼이 있다', () => {
    render(<AuthExpiredNotice onLogin={() => Promise.resolve()} onDismiss={vi.fn()} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('로그인이 만료됐습니다. 다시 로그인해 주세요')
    expect(alert).toHaveTextContent('다시 로그인하면 입력한 내용은 사라집니다')
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument()
  })

  it('닫기는 만료 상태를 해제한다', () => {
    const onDismiss = vi.fn()
    render(<AuthExpiredNotice onLogin={() => Promise.resolve()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('로그인 버튼', () => {
  it('AC-27-7: 누르면 로그인을 한 번 시작하고, 진행 중에는 다시 눌러도 또 시작하지 않으며 포커스를 유지한다', () => {
    const onLogin = vi.fn(() => new Promise<void>(() => {}))
    render(<AuthExpiredNotice onLogin={onLogin} onDismiss={vi.fn()} />)
    const button = screen.getByRole('button', { name: '로그인' })
    button.focus()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onLogin).toHaveBeenCalledTimes(1)
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeEnabled()
    expect(document.activeElement).toBe(button)
  })

  it('시작하지 못하면 진행 표시를 풀고 다시 누를 수 있다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onLogin = vi.fn(() => Promise.reject(new Error('network')))
    render(<AuthExpiredNotice onLogin={onLogin} onDismiss={vi.fn()} />)
    const button = screen.getByRole('button', { name: '로그인' })
    await act(async () => {
      fireEvent.click(button)
    })
    expect(button).not.toHaveAttribute('aria-busy')
    await act(async () => {
      fireEvent.click(button)
    })
    expect(onLogin).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalled()
  })
})

// 열린 대화상자(role=dialog) 흉내: 안내는 만료가 알려진 시점에 이미 열려 있던 대화상자에 붙는다. 맨 아래 고정 영역이 붙는 곳이다
function Host({ nested = false }: { nested?: boolean }) {
  const [open, setOpen] = useState(true)
  const [expired, setExpired] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setExpired(true)}>
        만료 발생
      </button>
      {open && (
        <div role="dialog" aria-label="정비 기록">
          <div data-testid="body">본문</div>
          {nested && (
            <div role="dialog" aria-label="확인">
              확인
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)}>
            닫기 대화상자
          </button>
        </div>
      )}
      {expired && <AuthExpiredNotice onLogin={() => Promise.resolve()} onDismiss={() => setExpired(false)} />}
    </>
  )
}

describe('대화상자가 열려 있을 때', () => {
  it('안내가 그 대화상자 안(본문 밖)에 붙고 별도 닫기 버튼은 없다', () => {
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: '만료 발생' }))
    const dialog = screen.getByRole('dialog')
    const alert = screen.getByRole('alert')
    expect(alert.parentElement).toBe(dialog)
    expect(screen.getByTestId('body')).not.toContainElement(alert)
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument()
  })

  it('AC-27-11: 대화상자를 닫으면 MSG-30과 MSG-37이 함께 사라진다', async () => {
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: '만료 발생' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '닫기 대화상자' }))
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('다시 로그인하면 입력한 내용은 사라집니다')).not.toBeInTheDocument()
  })

  it('대화상자가 겹쳐 있으면 가장 위(DOM에서 나중) 대화상자 안에 붙는다', () => {
    render(<Host nested />)
    fireEvent.click(screen.getByRole('button', { name: '만료 발생' }))
    expect(screen.getByRole('dialog', { name: '확인' })).toContainElement(screen.getByRole('alert'))
  })
})
