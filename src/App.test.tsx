// App 컴포넌트가 정상적으로 렌더링되는지 확인하는 스모크 테스트
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText('캘린더')).toBeInTheDocument()
  })
})
