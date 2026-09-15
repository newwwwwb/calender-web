// AuthButton: 로딩/로그아웃/로그인 상태별 렌더링과 클릭 동작을 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as useAuthModule from '../state/useAuth'
import AuthButton from './AuthButton'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AuthButton', () => {
  it('로딩 중에는 아무것도 렌더링하지 않는다', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      loading: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    })
    const { container } = render(<AuthButton />)
    expect(container).toBeEmptyDOMElement()
  })

  it('로그아웃 상태면 "로그인" 버튼을 보여주고 클릭 시 signInWithGoogle을 호출한다', () => {
    const signInWithGoogle = vi.fn()
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle,
      signOut: vi.fn(),
    })
    render(<AuthButton />)
    fireEvent.click(screen.getByText('로그인'))
    expect(signInWithGoogle).toHaveBeenCalled()
  })

  it('로그인 상태면 "로그아웃" 버튼을 보여주고 클릭 시 signOut을 호출한다', () => {
    const signOut = vi.fn()
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u1', email: 'a@b.com' } as never, // 테스트에 필요한 필드만 채운 최소 User 객체
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut,
    })
    render(<AuthButton />)
    fireEvent.click(screen.getByText('로그아웃'))
    expect(signOut).toHaveBeenCalled()
  })
})
