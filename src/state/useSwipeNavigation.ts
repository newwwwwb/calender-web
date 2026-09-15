// 모바일 대응: 좌우 스와이프 제스처를 감지해 이전/다음 기간 이동에 연결한다
import { useRef } from 'react'
import type { TouchEvent } from 'react'

const SWIPE_THRESHOLD = 60 // px. 이만큼 수평으로 움직여야 스와이프로 본다 (탭/스크롤과 구분)

interface SwipeHandlers {
  onSwipeLeft: () => void // 다음으로
  onSwipeRight: () => void // 이전으로
}

export function useSwipeNavigation({ onSwipeLeft, onSwipeRight }: SwipeHandlers) {
  const startRef = useRef<{ x: number; y: number } | null>(null)

  function onTouchStart(e: TouchEvent) {
    const touch = e.touches[0]
    startRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function onTouchEnd(e: TouchEvent) {
    const start = startRef.current
    startRef.current = null
    if (!start) return

    const touch = e.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // 수평 이동이 충분히 크고, 수직 이동(세로 스크롤)보다 뚜렷할 때만 스와이프로 인정한다
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return

    if (dx < 0) onSwipeLeft()
    else onSwipeRight()
  }

  return { onTouchStart, onTouchEnd }
}
