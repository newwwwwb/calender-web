// FreezeCalendarWhenExiting: 퇴장 중인 패널이 새 날짜로 다시 렌더되지 않고 마지막 context 값을 유지하는지 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { AnimatePresence, motion } from 'motion/react'
import { describe, expect, it } from 'vitest'
import { toDateKey } from '../lib/date'
import { FakeRepository } from '../test/fakeRepository'
import { CalendarProvider, FreezeCalendarWhenExiting, useCalendar } from './useCalendar'

function Probe() {
  const { currentDate } = useCalendar()
  return <span data-testid="pane">{toDateKey(currentDate)}</span>
}

// SwipeableViewport처럼 날짜 키로 패널을 바꿔 끼우는 최소 하네스
function Harness() {
  const { currentDate, setCurrentDate } = useCalendar()
  return (
    <>
      <button type="button" onClick={() => setCurrentDate(new Date(2030, 0, 1))}>
        이동
      </button>
      <AnimatePresence>
        <motion.div key={toDateKey(currentDate)} exit={{ opacity: 0 }}>
          <FreezeCalendarWhenExiting>
            <Probe />
          </FreezeCalendarWhenExiting>
        </motion.div>
      </AnimatePresence>
    </>
  )
}

describe('FreezeCalendarWhenExiting', () => {
  it('퇴장 중인 패널은 이전 날짜를, 들어오는 패널은 새 날짜를 보여준다', () => {
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <Harness />
      </CalendarProvider>,
    )
    const before = screen.getByTestId('pane').textContent
    fireEvent.click(screen.getByText('이동'))
    // 퇴장이 끝나기 전에는 두 패널이 공존한다 — 고정이 없으면 둘 다 새 날짜였다
    const shown = screen.getAllByTestId('pane').map((el) => el.textContent)
    expect(shown).toEqual(expect.arrayContaining([before, '2030-01-01']))
    expect(new Set(shown).size).toBe(shown.length)
  })
})
