// applyWidgetMode: ?widget=1 주소로 열렸을 때만 <html>에 widget 클래스를 붙이는지 검증
import { afterEach, describe, expect, it } from 'vitest'
import { applyWidgetMode } from './widgetMode'

afterEach(() => {
  document.documentElement.classList.remove('widget')
})

describe('applyWidgetMode', () => {
  it('widget=1이면 html에 widget 클래스를 붙인다', () => {
    applyWidgetMode('?widget=1')
    expect(document.documentElement.classList.contains('widget')).toBe(true)
  })

  it('파라미터가 없거나 다른 값이면 붙이지 않는다', () => {
    applyWidgetMode('')
    applyWidgetMode('?widget=0')
    applyWidgetMode('?view=week')
    expect(document.documentElement.classList.contains('widget')).toBe(false)
  })
})
