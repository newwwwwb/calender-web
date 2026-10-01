// ShortcutsToggle: 한 글자 단축키를 끄고 켜면 저장되고, 꺼져 있으면 실제 단축키가 동작하지 않는다
import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '../state/useKeyboardShortcuts'
import ShortcutsToggle from './ShortcutsToggle'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

function setup() {
  const changeView = vi.fn()
  renderHook(() =>
    useKeyboardShortcuts({
      view: 'month',
      currentDate: new Date(2026, 8, 15),
      setCurrentDate: vi.fn(),
      setSelectedDate: vi.fn(),
      changeView,
      onNewEvent: vi.fn(),
      onSearch: vi.fn(),
      onEscape: vi.fn(),
      disabled: false,
    }),
  )
  return changeView
}

describe('ShortcutsToggle', () => {
  it('기본은 켜져 있고, 끄면 localStorage에 저장되며 단축키가 동작하지 않는다', () => {
    const changeView = setup()
    render(<ShortcutsToggle />)
    const checkbox = screen.getByLabelText('한 글자 단축키 사용') as HTMLInputElement
    expect(checkbox.checked).toBe(true)

    fireEvent.keyDown(window, { key: 'w' })
    expect(changeView).toHaveBeenCalledWith('week')

    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
    expect(localStorage.getItem('calendar.shortcuts')).toBe('off')

    changeView.mockClear()
    fireEvent.keyDown(window, { key: 'w' })
    expect(changeView).not.toHaveBeenCalled()
  })

  it('어떤 단축키가 있는지 안내한다', () => {
    render(<ShortcutsToggle />)
    expect(screen.getByText(/T 오늘 · M 월 · W 주/)).toBeInTheDocument()
  })
})

describe('useKeyboardShortcuts 안전장치(접근성 감사)', () => {
  it('대화상자가 열려 있으면(App이 모르는 헤더의 날짜 이동 시트 포함) 뒤 화면 단축키가 동작하지 않는다', () => {
    const changeView = setup()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)

    fireEvent.keyDown(window, { key: 'm' })
    expect(changeView).not.toHaveBeenCalled()

    dialog.remove()
    fireEvent.keyDown(window, { key: 'm' })
    expect(changeView).toHaveBeenCalledWith('month')
  })

  it('contentEditable 영역에서 입력 중이면 단축키가 동작하지 않는다', () => {
    const changeView = setup()
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    // jsdom은 isContentEditable을 구현하지 않아 직접 지정한다
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    document.body.appendChild(editable)

    fireEvent.keyDown(editable, { key: 'd' })
    expect(changeView).not.toHaveBeenCalled()
    editable.remove()
  })
})
