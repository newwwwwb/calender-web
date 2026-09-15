// Header: 보기 전환, 보기별 이전/다음 이동, 오늘 버튼, 타이틀 표시를 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import Header from './Header'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 15)) // 오늘 = 2026-09-15
})

afterEach(() => {
  vi.useRealTimers()
})

function renderHeader() {
  return render(
    <CalendarProvider repository={new FakeRepository()}>
      <Header />
    </CalendarProvider>,
  )
}

describe('Header - 월 보기 (기본값)', () => {
  it('현재 달 제목을 보여준다', () => {
    renderHeader()
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
  })

  it('다음/이전 버튼으로 달을 이동한다', () => {
    renderHeader()
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('이전'))
    fireEvent.click(screen.getByLabelText('이전'))
    expect(screen.getByText('2026년 8월')).toBeInTheDocument()
  })

  it('오늘 버튼을 누르면 현재 달로 돌아온다', () => {
    renderHeader()
    fireEvent.click(screen.getByLabelText('다음'))
    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('2026년 11월')).toBeInTheDocument()
    fireEvent.click(screen.getByText('오늘'))
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
  })
})

describe('Header - 보기 전환', () => {
  it('주 보기로 바꾸면 주간 타이틀을 보여주고, 다음/이전은 1주 단위로 이동한다', () => {
    renderHeader()
    fireEvent.click(screen.getByText('주'))
    expect(screen.getByText('2026년 9월 13일 - 19일')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('2026년 9월 20일 - 26일')).toBeInTheDocument()
  })

  it('일 보기로 바꾸면 일간 타이틀을 보여주고, 다음/이전은 하루 단위로 이동한다', () => {
    renderHeader()
    fireEvent.click(screen.getByText('일'))
    expect(screen.getByText('2026년 9월 15일 (화)')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('다음'))
    expect(screen.getByText('2026년 9월 16일 (수)')).toBeInTheDocument()
  })

  it('목록 보기는 월 타이틀을 그대로 쓴다', () => {
    renderHeader()
    fireEvent.click(screen.getByText('목록'))
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
  })
})
