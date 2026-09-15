// App 컴포넌트가 정상적으로 렌더링되는지 확인하는 스모크 테스트
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(() => {
  window.history.pushState({}, '', '/')
})

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText('캘린더')).toBeInTheDocument()
  })

  it('/share/:id 경로에서는 캘린더 대신 공유 수락 화면을 보여준다', () => {
    window.history.pushState({}, '', '/share/abc123')
    render(<App />)
    expect(screen.getByText('캘린더 공유를 수락하려면 먼저 로그인해주세요.')).toBeInTheDocument()
    expect(screen.queryByText('캘린더')).not.toBeInTheDocument()
  })
})
