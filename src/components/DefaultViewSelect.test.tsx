// DefaultViewSelect: 선택하면 localStorage에 저장되고, 지금 화면(view)에도 바로 반영되는지 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CalendarProvider, useCalendar } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import DefaultViewSelect from './DefaultViewSelect'

function ViewProbe() {
  const { view } = useCalendar()
  return <span data-testid="view">{view}</span>
}

beforeEach(() => {
  localStorage.clear()
})

describe('DefaultViewSelect', () => {
  it('기본값은 "월"이고, "주"로 바꾸면 localStorage에 저장되고 지금 화면도 주 보기로 바뀐다', () => {
    render(
      <CalendarProvider repository={new FakeRepository()}>
        <DefaultViewSelect />
        <ViewProbe />
      </CalendarProvider>,
    )
    const select = screen.getByLabelText('기본 보기') as HTMLSelectElement
    expect(select.value).toBe('month')

    fireEvent.change(select, { target: { value: 'week' } })

    expect(select.value).toBe('week')
    expect(localStorage.getItem('calendar.defaultView')).toBe('week')
    expect(screen.getByTestId('view')).toHaveTextContent('week')
  })
})
