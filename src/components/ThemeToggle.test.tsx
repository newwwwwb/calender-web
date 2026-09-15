// ThemeToggle: 셀렉트로 테마를 바꾸면 <html data-theme>에 반영되는지 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ThemeToggle from './ThemeToggle'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('기본값은 "기본"이고, ZIGZAG로 바꾸면 data-theme이 바뀐다', () => {
    render(<ThemeToggle />)
    const select = screen.getByLabelText('디자인 테마') as HTMLSelectElement
    expect(select.value).toBe('default')

    fireEvent.change(select, { target: { value: 'zigzag' } })

    expect(select.value).toBe('zigzag')
    expect(document.documentElement.getAttribute('data-theme')).toBe('zigzag')
  })
})
