// App 컴포넌트가 정상적으로 렌더링되는지 확인하는 스모크 테스트
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  window.history.pushState({}, '', '/')
  document.documentElement.classList.remove('widget')
})

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText('캘린더')).toBeInTheDocument()
  })

  it('/share/:id 경로에서는 캘린더 대신 공유 수락 화면을 보여준다', () => {
    window.history.pushState({}, '', '/share/abc123')
    render(<App />)
    expect(screen.getByText('캘린더 공유를 수락하려면 먼저 로그인해 주세요.')).toBeInTheDocument()
    expect(screen.queryByText('캘린더')).not.toBeInTheDocument()
  })

  it('일반 웹에서는 사이드바 접기 버튼이 없고 사이드바가 항상 보인다', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: /사이드바/ })).not.toBeInTheDocument()
    expect(screen.getByText('미니 캘린더')).toBeInTheDocument()
  })

  it('일반 웹에서는 사이드바가 애니메이션 래퍼 없이 앱 루트의 직속 자식이다(모바일 웹에서 256px 빈 칸이 생기던 문제, 1차 보스 리뷰)', () => {
    const { container } = render(<App />)
    expect(screen.getByText('미니 캘린더').closest('aside')?.parentElement).toBe(container.firstElementChild)
  })

  it('위젯 모드(넓은 창)에서는 사이드바가 접기 애니메이션 래퍼 안에 있다', () => {
    document.documentElement.classList.add('widget')
    const { container } = render(<App />)
    const wrapper = screen.getByText('미니 캘린더').closest('aside')?.parentElement
    expect(wrapper).not.toBe(container.firstElementChild)
    expect(wrapper?.parentElement).toBe(container.firstElementChild)
  })

  it('위젯 모드에서는 버튼으로 사이드바를 접고 펼칠 수 있다', async () => {
    document.documentElement.classList.add('widget')
    render(<App />)
    expect(screen.getByText('미니 캘린더')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: '사이드바' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: '사이드바' }))
    // 접기 애니메이션(24.6) 퇴장이 끝나야 DOM에서 빠진다
    await waitFor(() => expect(screen.queryByText('미니 캘린더')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '사이드바' })).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(screen.getByRole('button', { name: '사이드바' }))
    expect(screen.getByText('미니 캘린더')).toBeInTheDocument()
  })

  it('위젯 모드에서 접은 상태는 다시 열어도 유지된다', () => {
    document.documentElement.classList.add('widget')
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '사이드바' }))
    first.unmount()

    render(<App />)
    expect(screen.queryByText('미니 캘린더')).not.toBeInTheDocument()
  })
})
