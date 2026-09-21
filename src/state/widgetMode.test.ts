// applyWidgetMode: ?widget=1 주소로 열렸을 때만 <html>에 widget 클래스를 붙이는지 검증
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyWidgetMode, isWidgetMode } from './widgetMode'

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  document.documentElement.classList.remove('widget')
})

describe('applyWidgetMode', () => {
  it('widget=1이면 html에 widget 클래스를 붙인다', () => {
    applyWidgetMode('?widget=1')
    expect(document.documentElement.classList.contains('widget')).toBe(true)
    expect(isWidgetMode()).toBe(true)
  })

  it('파라미터가 없거나 다른 값이면 붙이지 않는다', () => {
    applyWidgetMode('')
    applyWidgetMode('?widget=0')
    applyWidgetMode('?view=week')
    expect(document.documentElement.classList.contains('widget')).toBe(false)
    expect(isWidgetMode()).toBe(false)
  })

  it('로그인 리다이렉트로 ?widget=1이 사라져도 같은 탭에서는 위젯 모드를 유지한다', () => {
    applyWidgetMode('?widget=1')
    document.documentElement.classList.remove('widget') // 페이지가 새로 로드된 상황
    applyWidgetMode('')
    expect(document.documentElement.classList.contains('widget')).toBe(true)
  })
})
