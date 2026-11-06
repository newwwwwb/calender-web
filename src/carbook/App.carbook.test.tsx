// App의 /car 분기와 파일철 탭 통합 테스트(F-01, F-13, AC-02-4): 탭 이동·뒤로가기·주소 변형·보조키 클릭·단축키 격리·위젯 숨김
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  window.history.pushState({}, '', '/')
  document.documentElement.classList.remove('widget')
})

const tab = (name: string) => screen.getByRole('link', { name })
const carbookShown = () => screen.queryByRole('heading', { level: 1, name: '차계부' }) !== null
const calendarShown = () => screen.queryByRole('heading', { level: 1, name: '캘린더 앱' }) !== null

describe('파일철 탭과 /car 주소 (F-01)', () => {
  it('AC-01-1: 차계부 탭은 /car로, 캘린더 탭은 /로 이동하고 화면이 바뀐다', () => {
    render(<App />)
    expect(calendarShown()).toBe(true)
    expect(tab('캘린더')).toHaveAttribute('aria-current', 'page')

    fireEvent.click(tab('차계부'))
    expect(window.location.pathname).toBe('/car')
    expect(carbookShown()).toBe(true)
    expect(calendarShown()).toBe(false)
    expect(tab('차계부')).toHaveAttribute('aria-current', 'page')
    expect(tab('캘린더')).not.toHaveAttribute('aria-current')

    fireEvent.click(tab('캘린더'))
    expect(window.location.pathname).toBe('/')
    expect(calendarShown()).toBe(true)
  })

  it('탭은 nav "화면 전환" 안의 링크이고 DOM 순서가 본문 뒤다(BR-02)', () => {
    const { container } = render(<App />)
    const nav = screen.getByRole('navigation', { name: '화면 전환' })
    expect(tab('캘린더')).toHaveAttribute('href', '/')
    expect(tab('차계부')).toHaveAttribute('href', '/car')
    expect(nav.compareDocumentPosition(container.querySelector('main')!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('AC-01-2: 뒤로 가기(popstate)가 주소와 화면을 함께 바꾼다', () => {
    render(<App />)
    fireEvent.click(tab('차계부'))
    expect(carbookShown()).toBe(true)

    // jsdom의 history.back()은 비동기라, 브라우저가 뒤로 간 뒤 보내는 popstate를 직접 재현한다
    window.history.pushState({}, '', '/')
    fireEvent(window, new PopStateEvent('popstate'))
    expect(calendarShown()).toBe(true)

    window.history.pushState({}, '', '/car')
    fireEvent(window, new PopStateEvent('popstate'))
    expect(carbookShown()).toBe(true)
  })

  it('AC-01-2: /car에서 새로고침(처음 렌더)해도 차계부가 열린다', () => {
    window.history.pushState({}, '', '/car')
    render(<App />)
    expect(carbookShown()).toBe(true)
  })

  it('AC-01-3: /car/는 /car와 같고, 알 수 없는 주소는 캘린더다', () => {
    window.history.pushState({}, '', '/car/')
    const first = render(<App />)
    expect(carbookShown()).toBe(true)
    first.unmount()

    window.history.pushState({}, '', '/abc')
    render(<App />)
    expect(calendarShown()).toBe(true)
  })

  it('AC-01-4: Ctrl·Meta·Shift·Alt·가운데 클릭은 가로채지 않는다', () => {
    render(<App />)
    // 앱이 막지 않은 클릭은 브라우저가 처리한다. jsdom이 이동을 시도하지 않게 문서 단계에서 막되, 그 전에 앱이 막았는지 기록한다
    let preventedByApp = false
    const record = (event: Event) => {
      preventedByApp ||= event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', record)
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      fireEvent.click(tab('차계부'), init)
    }
    document.removeEventListener('click', record)
    expect(preventedByApp).toBe(false)
    expect(window.location.pathname).toBe('/')
    expect(calendarShown()).toBe(true)
  })

  it('같은 탭을 다시 눌러도 기록을 쌓지 않는다', () => {
    render(<App />)
    fireEvent.click(tab('차계부'))
    const length = window.history.length
    fireEvent.click(tab('차계부'))
    expect(window.history.length).toBe(length)
  })

  it('AC-01-6: /car에서는 캘린더 단축키 n이 새 일정 편집창을 열지 않는다', () => {
    window.history.pushState({}, '', '/car')
    render(<App />)
    tab('차계부').focus()
    fireEvent.keyDown(tab('차계부'), { key: 'n' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('BR-34: /car에 다녀와도 캘린더 보기 상태가 유지된다', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '주' }))
    const heading = screen.getByRole('status').textContent
    fireEvent.click(tab('차계부'))
    fireEvent.click(tab('캘린더'))
    expect(screen.getByRole('status').textContent).toBe(heading)
  })

  it('/share/:id는 탭 없이 그대로 공유 수락 화면이다', () => {
    window.history.pushState({}, '', '/share/abc123')
    render(<App />)
    expect(screen.getByText('캘린더 공유를 수락하려면 먼저 로그인해 주세요.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '화면 전환' })).not.toBeInTheDocument()
  })
})

describe('화면 전환 알림 (A11Y-1, WCAG 2.4.2·4.1.3)', () => {
  it('탭으로 전환하면 문서 제목이 바뀌고 포커스가 새 화면의 main으로 간다', () => {
    render(<App />)
    expect(document.title).toBe('캘린더')

    fireEvent.click(tab('차계부'))
    expect(document.title).toBe('차계부')
    expect(document.activeElement).toBe(document.getElementById('main-content'))

    fireEvent.click(tab('캘린더'))
    expect(document.title).toBe('캘린더')
    expect(document.activeElement).toBe(document.getElementById('main-content'))
  })

  it('뒤로 가기(popstate)로 바뀌어도 같다', () => {
    render(<App />)
    fireEvent.click(tab('차계부'))
    window.history.pushState({}, '', '/')
    fireEvent(window, new PopStateEvent('popstate'))
    expect(document.title).toBe('캘린더')
    expect(document.activeElement).toBe(document.getElementById('main-content'))
  })

  it('처음 /car를 열 때는 제목만 맞추고 포커스는 옮기지 않는다', () => {
    window.history.pushState({}, '', '/car')
    render(<App />)
    expect(document.title).toBe('차계부')
    expect(document.activeElement).toBe(document.body)
  })
})

describe('AC-02-4 비로그인에서도 탭은 보인다', () => {
  it('로그인하지 않아도 탭 2개가 보이고 차계부 탭을 누르면 /car가 열린다', () => {
    render(<App />)
    expect(screen.getAllByRole('link', { name: /^(캘린더|차계부)$/ })).toHaveLength(2)
    fireEvent.click(tab('차계부'))
    expect(window.location.pathname).toBe('/car')
  })
})

describe('위젯 모드에서 탭 숨김 (F-13)', () => {
  it('AC-13-1: 위젯 모드에서는 탭이 DOM에 없다', () => {
    document.documentElement.classList.add('widget')
    render(<App />)
    expect(screen.queryByRole('navigation', { name: '화면 전환' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '차계부' })).not.toBeInTheDocument()
  })

  it('AC-13-2: 일반 접속에서는 탭 2개가 보인다', () => {
    render(<App />)
    expect(screen.getByRole('navigation', { name: '화면 전환' }).querySelectorAll('a')).toHaveLength(2)
  })

  it('AC-13-3: 위젯 화면은 탭 도입 전과 같다(렌더 루트의 직속 자식은 앱 루트 하나뿐)', () => {
    document.documentElement.classList.add('widget')
    const { container } = render(<App />)
    expect(container.children).toHaveLength(1)
  })

  it('AC-13-4: 위젯 모드에서 /car를 직접 열면 차계부는 열리고 탭은 없다', () => {
    document.documentElement.classList.add('widget')
    window.history.pushState({}, '', '/car')
    render(<App />)
    expect(carbookShown()).toBe(true)
    expect(screen.queryByRole('navigation', { name: '화면 전환' })).not.toBeInTheDocument()
  })
})
