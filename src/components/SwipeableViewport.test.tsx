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

  function renderWithButton(onClick: () => void) {
    const { container } = render(
      <SwipeableViewport view="week" currentDate={new Date(2026, 8, 1)} onSwipe={vi.fn()}>
        <button onClick={onClick}>시간칸</button>
      </SwipeableViewport>,
    )
    return container.firstChild as HTMLElement
  }

  it('세로로 움직인 터치는 스와이프로 보지 않고, 이어지는 탭도 그대로 동작한다(스크롤을 막지 않음)', () => {
    const onClick = vi.fn()
    const viewport = renderWithButton(onClick)

    fireEvent.pointerDown(viewport, { pointerType: 'touch', clientX: 100, clientY: 300 })
    fireEvent.pointerMove(viewport, { pointerType: 'touch', clientX: 104, clientY: 260 })
    fireEvent.pointerUp(viewport, { pointerType: 'touch', clientX: 104, clientY: 260 })
    fireEvent.click(screen.getByText('시간칸'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('가로 스와이프로 판정된 뒤의 click은 자식에게 전달하지 않는다(시간칸 탭으로 새 일정이 열리지 않게)', () => {
    const onClick = vi.fn()
    const viewport = renderWithButton(onClick)

    fireEvent.pointerDown(viewport, { pointerType: 'touch', clientX: 100, clientY: 300 })
    fireEvent.pointerMove(viewport, { pointerType: 'touch', clientX: 160, clientY: 305 })
    fireEvent.pointerUp(viewport, { pointerType: 'touch', clientX: 160, clientY: 305 })
    fireEvent.click(screen.getByText('시간칸'))
    expect(onClick).not.toHaveBeenCalled()

    // 그다음의 평범한 탭은 다시 정상 동작한다
    fireEvent.pointerDown(viewport, { pointerType: 'touch', clientX: 100, clientY: 300 })
    fireEvent.click(screen.getByText('시간칸'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('대각선에 가까운(세로 비중이 큰) 움직임은 스와이프로 보지 않는다', () => {
    const onClick = vi.fn()
    const viewport = renderWithButton(onClick)

    fireEvent.pointerDown(viewport, { pointerType: 'touch', clientX: 100, clientY: 300 })
    fireEvent.pointerMove(viewport, { pointerType: 'touch', clientX: 130, clientY: 270 })
    fireEvent.click(screen.getByText('시간칸'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
