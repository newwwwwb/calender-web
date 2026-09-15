// useSwipeNavigation: 수평 스와이프 판정, 수직 스크롤/짧은 이동은 무시함을 검증
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSwipeNavigation } from './useSwipeNavigation'

function Harness({ onSwipeLeft, onSwipeRight }: { onSwipeLeft: () => void; onSwipeRight: () => void }) {
  const swipe = useSwipeNavigation({ onSwipeLeft, onSwipeRight })
  return (
    <div data-testid="area" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
      영역
    </div>
  )
}

function touch(x: number, y: number) {
  return { touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] }
}

describe('useSwipeNavigation', () => {
  it('왼쪽으로 충분히 스와이프하면 onSwipeLeft가 호출된다', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { getByTestId } = render(<Harness onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />)
    const area = getByTestId('area')

    fireEvent.touchStart(area, touch(300, 100))
    fireEvent.touchEnd(area, touch(200, 100))

    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('오른쪽으로 충분히 스와이프하면 onSwipeRight가 호출된다', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { getByTestId } = render(<Harness onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />)
    const area = getByTestId('area')

    fireEvent.touchStart(area, touch(100, 100))
    fireEvent.touchEnd(area, touch(200, 100))

    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('이동 거리가 짧으면(탭) 무시한다', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { getByTestId } = render(<Harness onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />)
    const area = getByTestId('area')

    fireEvent.touchStart(area, touch(100, 100))
    fireEvent.touchEnd(area, touch(110, 100))

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('세로 스크롤(수직 이동이 더 큰 경우)은 무시한다', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { getByTestId } = render(<Harness onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />)
    const area = getByTestId('area')

    fireEvent.touchStart(area, touch(100, 100))
    fireEvent.touchEnd(area, touch(170, 300))

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })
})
