// SwipeableViewport: 날짜/보기가 바뀌어도 자식이 정상적으로 교체돼 렌더되는지, 마우스 포인터는
// 드래그를 시작하지 않는지 검증한다(실제 스프링 모션/드래그 물리는 playwright-cli로 육안 확인).
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SwipeableViewport from './SwipeableViewport'

describe('SwipeableViewport', () => {
  it('현재 날짜에 해당하는 자식을 렌더한다', () => {
    render(
      <SwipeableViewport view="month" currentDate={new Date(2026, 8, 1)} onSwipe={vi.fn()}>
        <div>9월 내용</div>
      </SwipeableViewport>,
    )
    expect(screen.getByText('9월 내용')).toBeInTheDocument()
  })

  it('날짜가 바뀌면 새 자식으로 교체된다', () => {
    const { rerender } = render(
      <SwipeableViewport view="month" currentDate={new Date(2026, 8, 1)} onSwipe={vi.fn()}>
        <div>9월 내용</div>
      </SwipeableViewport>,
    )
    rerender(
      <SwipeableViewport view="month" currentDate={new Date(2026, 9, 1)} onSwipe={vi.fn()}>
        <div>10월 내용</div>
      </SwipeableViewport>,
    )
    expect(screen.getByText('10월 내용')).toBeInTheDocument()
  })

  it('마우스 포인터로는 드래그가 시작되지 않는다(클릭과 충돌 방지)', () => {
    const onSwipe = vi.fn()
    const { container } = render(
      <SwipeableViewport view="month" currentDate={new Date(2026, 8, 1)} onSwipe={onSwipe}>
        <div>내용</div>
      </SwipeableViewport>,
    )
    const viewport = container.firstChild as HTMLElement
    expect(() =>
      fireEvent.pointerDown(viewport, { pointerType: 'mouse', clientX: 10, clientY: 10 }),
    ).not.toThrow()
    expect(onSwipe).not.toHaveBeenCalled()
  })
})
