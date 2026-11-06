// CarbookApp 테스트: 로그인 게이트(AC-02-1·2·3·5), 불러오기 실패(AC-10-7). useAuth·useCarbook은 모의한다
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CarbookApp from './CarbookApp'

const mocks = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() },
  carbook: {
    loadState: 'ready' as 'loading' | 'ready' | 'error',
    retryLoad: vi.fn(),
    vehicles: [] as { id: string }[],
    selectedVehicleId: null as string | null,
    selectVehicle: vi.fn(),
  },
  useCarbook: vi.fn(),
}))

vi.mock('../state/useAuth', () => ({ useAuth: () => mocks.auth }))
vi.mock('./state/useCarbook', () => ({
  useCarbook: (userId: string) => {
    mocks.useCarbook(userId)
    return mocks.carbook
  },
}))

const user = { id: 'user-1' }

beforeEach(() => {
  mocks.auth.user = null
  mocks.auth.loading = false
  mocks.auth.signInWithGoogle = vi.fn(() => Promise.resolve())
  Object.assign(mocks.carbook, { loadState: 'ready', vehicles: [], selectedVehicleId: null, retryLoad: vi.fn() })
  mocks.useCarbook.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('로그인 게이트 (F-02)', () => {
  it('AC-02-1: 비로그인이면 MSG-02와 로그인 버튼만 보이고 데이터 훅을 부르지 않는다', () => {
    render(<CarbookApp />)
    expect(screen.getByText('로그인하면 사용할 수 있습니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(mocks.useCarbook).not.toHaveBeenCalled()
  })

  it('AC-02-2: 로그인 버튼은 지금 주소(/car)로 돌아오도록 로그인을 시작한다', () => {
    window.history.pushState({}, '', '/car')
    render(<CarbookApp />)
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    expect(mocks.auth.signInWithGoogle).toHaveBeenCalledWith(window.location.href)
    expect(window.location.pathname).toBe('/car')
    window.history.pushState({}, '', '/')
  })

  it('AC-02-3: 로그인이 실패해도 안내 화면에 머물고 데이터 요청은 없다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.auth.signInWithGoogle = vi.fn(() => Promise.reject(new Error('cancelled')))
    render(<CarbookApp />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    })
    expect(screen.getByText('로그인하면 사용할 수 있습니다')).toBeInTheDocument()
    expect(mocks.useCarbook).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('AC-02-5: 세션 복원 중에는 로딩 표시만 보이고, 5초가 되면 로그인 안내로 바뀐다', () => {
    vi.useFakeTimers()
    mocks.auth.loading = true
    render(<CarbookApp />)
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(4999))
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(mocks.useCarbook).not.toHaveBeenCalled()
  })

  it('h1 "차계부"와 main#main-content가 있다(화면 전환 포커스 대상)', () => {
    render(<CarbookApp />)
    expect(screen.getByRole('heading', { level: 1, name: '차계부' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
  })
})

describe('불러오기 상태 (AC-10-7)', () => {
  beforeEach(() => {
    mocks.auth.user = user
  })

  it('로그인했으면 사용자 id로 데이터 훅을 부른다', () => {
    render(<CarbookApp />)
    expect(mocks.useCarbook).toHaveBeenCalledWith('user-1')
  })

  it('불러오는 중이면 로딩 표시가 보인다', () => {
    mocks.carbook.loadState = 'loading'
    render(<CarbookApp />)
    expect(screen.getByText('불러오는 중')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('실패하면 MSG-04와 "다시 시도"만 보이고, 누르면 다시 읽는다', () => {
    mocks.carbook.loadState = 'error'
    render(<CarbookApp />)
    expect(screen.getByRole('alert')).toHaveTextContent('차계부 데이터를 불러오지 못했습니다')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(mocks.carbook.retryLoad).toHaveBeenCalledTimes(1)
  })
})
