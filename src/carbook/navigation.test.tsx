// navigation 훅·함수 테스트: 경로 판정, 같은 경로 이동 무시, pushState·popstate에 따른 갱신
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCarPath, navigate, usePathname } from './navigation'

afterEach(() => {
  window.history.pushState({}, '', '/')
})

function Path() {
  return <span data-testid="path">{usePathname()}</span>
}

describe('isCarPath', () => {
  it('/car와 /car/만 참이다(BR-01)', () => {
    expect(isCarPath('/car')).toBe(true)
    expect(isCarPath('/car/')).toBe(true)
    expect(isCarPath('/')).toBe(false)
    expect(isCarPath('/abc')).toBe(false)
    expect(isCarPath('/car/x')).toBe(false)
    expect(isCarPath('/cars')).toBe(false)
  })
})

describe('navigate / usePathname', () => {
  it('navigate가 주소를 바꾸고 구독한 컴포넌트가 다시 그려진다', () => {
    render(<Path />)
    expect(screen.getByTestId('path')).toHaveTextContent('/')
    act(() => navigate('/car'))
    expect(window.location.pathname).toBe('/car')
    expect(screen.getByTestId('path')).toHaveTextContent('/car')
  })

  it('같은 경로면 기록을 쌓지 않는다', () => {
    render(<Path />)
    act(() => navigate('/car'))
    const length = window.history.length
    act(() => navigate('/car'))
    expect(window.history.length).toBe(length)
  })

  it('뒤로 가기(popstate)에도 따라간다', () => {
    render(<Path />)
    act(() => navigate('/car'))
    act(() => {
      window.history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByTestId('path')).toHaveTextContent('/')
  })
})

describe('navigate의 기록 쌓기 (pushState 호출 수)', () => {
  function pushCount(from: string, to: string): number {
    window.history.pushState({}, '', from)
    const spy = vi.spyOn(window.history, 'pushState')
    navigate(to)
    const count = spy.mock.calls.length
    spy.mockRestore()
    return count
  }

  it('/car/에서 /car로 가도 기록을 쌓지 않는다(같은 화면)', () => {
    expect(pushCount('/car/', '/car')).toBe(0)
    expect(pushCount('/car', '/car/')).toBe(0)
  })

  it('/와 /car 사이는 지금처럼 1건 쌓는다', () => {
    expect(pushCount('/car', '/')).toBe(1)
    expect(pushCount('/', '/car')).toBe(1)
    expect(pushCount('/car/', '/')).toBe(1)
  })

  it('같은 경로면 쌓지 않는다', () => {
    expect(pushCount('/', '/')).toBe(0)
    expect(pushCount('/car', '/car')).toBe(0)
  })
})
