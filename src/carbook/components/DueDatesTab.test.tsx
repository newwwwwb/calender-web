// DueDatesTab 테스트(F-07·F-08, AC-07-1~6): 세 행 고정, 입력/수정/삭제 버튼 규칙, 양식·삭제 확인 연결, 반영 실패 버튼, 로딩·오류
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DueDateView } from '../domain/types'
import DueDatesTab from './DueDatesTab'

type Props = Partial<React.ComponentProps<typeof DueDatesTab>>

const due = (patch: Partial<DueDateView>): DueDateView => ({ id: 'd1', vehicleId: 'v1', kind: 'insurance', dueDate: '2027-03-10', eventId: 'e1', createdAt: 'x', calendarFailed: false, ...patch })

function setup(props: Props = {}) {
  const fns = {
    onRetry: vi.fn(), onSave: vi.fn(() => Promise.resolve(true)), onDelete: vi.fn(() => Promise.resolve(true)), onRetryCalendar: vi.fn(() => Promise.resolve()),
  }
  const ui = (p: Props) => <DueDatesTab dueDates={[]} state="ready" {...fns} {...p} />
  const { rerender } = render(ui(props))
  return { ...fns, rerender: (p: Props) => rerender(ui({ ...props, ...p })) }
}

const row = (name: string) => screen.getByText(name).closest('li')!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T09:00:00+09:00'))
})
afterEach(() => vi.useRealTimers())

describe('세 행 고정과 버튼 규칙', () => {
  it('만기일이 없으면 세 종류가 모두 "날짜 없음"과 "입력"이고 임의 날짜가 없다 (AC-07-3)', () => {
    setup()
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((r) => r.querySelector('span')!.textContent)).toEqual(['보험 만기', '자동차세 납부', '정기검사'])
    rows.forEach((r) => {
      expect(r).toHaveTextContent('날짜 없음')
      expect(within(r).getAllByRole('button')).toHaveLength(1)
    })
    expect(screen.queryByText(/\d{4}-\d{2}-\d{2}/)).not.toBeInTheDocument()
  })

  it('값이 있는 종류는 날짜와 "수정"·"삭제"만 있고 "입력"은 없다 (AC-07-6)', () => {
    setup({ dueDates: [due({})] })
    const insurance = row('보험 만기')
    expect(insurance).toHaveTextContent('2027-03-10')
    expect(within(insurance).getByRole('button', { name: '보험 만기 수정' })).toBeInTheDocument()
    expect(within(insurance).getByRole('button', { name: '보험 만기 삭제' })).toBeInTheDocument()
    expect(within(insurance).queryByRole('button', { name: /입력/ })).not.toBeInTheDocument()
    expect(within(row('정기검사')).getByRole('button', { name: '정기검사 입력' })).toBeInTheDocument()
  })

  it('지난 날짜에도 배지를 두지 않는다', () => {
    setup({ dueDates: [due({ dueDate: '2026-01-01' })] })
    expect(row('보험 만기')).toHaveTextContent('2026-01-01')
    expect(screen.queryByText(/곧|지남|임박/)).not.toBeInTheDocument()
  })
})

describe('양식·삭제 연결', () => {
  it('"입력" → 날짜 저장하면 종류와 날짜로 onSave가 한 번 호출되고 창이 닫힌다 (AC-07-1)', async () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: '자동차세 납부 입력' }))
    expect(screen.getByRole('dialog', { name: '자동차세 납부 만기일 입력' })).toHaveTextContent('자동차세 납부')
    fireEvent.change(screen.getByLabelText('만기일 (필수)'), { target: { value: '2026-12-31' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '저장' })))
    expect(onSave).toHaveBeenCalledWith('car_tax', '2026-12-31')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('"수정"은 기존 날짜가 채워진 양식을 연다 (AC-07-2)', () => {
    setup({ dueDates: [due({})] })
    fireEvent.click(screen.getByRole('button', { name: '보험 만기 수정' }))
    expect(screen.getByRole('dialog', { name: '보험 만기 만기일 수정' })).toBeInTheDocument()
    expect(screen.getByLabelText('만기일 (필수)')).toHaveValue('2027-03-10')
  })

  it('"삭제"는 확인창(보험 만기)을 거치고 확인하면 onDelete(kind)가 1건 나간다 (AC-07-2)', async () => {
    const { onDelete } = setup({ dueDates: [due({})] })
    fireEvent.click(screen.getByRole('button', { name: '보험 만기 삭제' }))
    const dialog = screen.getByRole('dialog', { name: '삭제 확인' })
    expect(dialog).toHaveTextContent('만기일(보험 만기)을(를) 삭제할까요?')
    expect(onDelete).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '삭제' })))
    expect(onDelete).toHaveBeenCalledWith('insurance')
  })

  it('삭제 확인에서 취소하면 삭제 요청이 없다 (AC-11-4)', async () => {
    const { onDelete } = setup({ dueDates: [due({})] })
    fireEvent.click(screen.getByRole('button', { name: '보험 만기 삭제' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: '삭제 확인' })).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onDelete).not.toHaveBeenCalled()
  })
})

describe('일정 반영 실패·로딩·오류', () => {
  it('일정 쓰기에 실패한 행에만 MSG-11 버튼이 있고 누르면 그 만기일로 재시도한다 (F-08)', async () => {
    const { onRetryCalendar } = setup({ dueDates: [due({ calendarFailed: true }), due({ id: 'd2', kind: 'inspection' })] })
    const buttons = screen.getAllByRole('button', { name: /^캘린더 반영 실패, 다시 시도/ })
    expect(buttons).toHaveLength(1)
    expect(within(row('보험 만기')).getByRole('button', { name: /^캘린더 반영 실패/ })).toBe(buttons[0])
    await act(async () => fireEvent.click(buttons[0]))
    expect(onRetryCalendar).toHaveBeenCalledWith('d1')
  })

  it('재시도에 성공해 버튼이 사라지면 포커스가 같은 행의 첫 버튼으로 간다 (2.4.3)', async () => {
    const { rerender } = setup({ dueDates: [due({ calendarFailed: true })] })
    const retry = screen.getByRole('button', { name: /^캘린더 반영 실패/ })
    retry.focus()
    await act(async () => fireEvent.click(retry))
    rerender({ dueDates: [due({ calendarFailed: false })] })
    await waitFor(() => expect(screen.getByRole('button', { name: '보험 만기 수정' })).toHaveFocus())
  })

  it('로딩이면 status 뼈대, 오류면 MSG-04와 다시 시도(누르면 재시도하고 main으로 포커스)', () => {
    const main = document.createElement('main')
    main.id = 'main-content'
    main.tabIndex = -1
    document.body.appendChild(main)
    const loading = setup({ state: 'loading' })
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
    loading.rerender({ state: 'error' })
    expect(screen.getByRole('alert')).toHaveTextContent('차계부 데이터를 불러오지 못했습니다')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(loading.onRetry).toHaveBeenCalledTimes(1)
    expect(main).toHaveFocus()
    main.remove()
  })
})

describe('닫힌 뒤 포커스 복구 (Auditor F1)', () => {
  it('둘째 행(자동차세) 입력을 저장하면 포커스가 맨 위가 아니라 그 행의 버튼으로 간다', async () => {
    const { rerender } = setup()
    fireEvent.click(screen.getByRole('button', { name: '자동차세 납부 입력' }))
    fireEvent.change(screen.getByLabelText('만기일 (필수)'), { target: { value: '2026-12-31' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '저장' })))
    rerender({ dueDates: [due({ id: 'd2', kind: 'car_tax', dueDate: '2026-12-31' })] }) // 입력 버튼이 수정·삭제로 바뀐다
    await waitFor(() => expect(screen.getByRole('button', { name: '자동차세 납부 수정' })).toHaveFocus(), { timeout: 5000 })
  })

  it('셋째 행(정기검사) 삭제 뒤에는 그 행의 "입력" 버튼으로 간다', async () => {
    const { rerender } = setup({ dueDates: [due({ id: 'd3', kind: 'inspection' })] })
    fireEvent.click(screen.getByRole('button', { name: '정기검사 삭제' }))
    await act(async () => fireEvent.click(within(screen.getByRole('dialog', { name: '삭제 확인' })).getByRole('button', { name: '삭제' })))
    rerender({ dueDates: [] })
    await waitFor(() => expect(screen.getByRole('button', { name: '정기검사 입력' })).toHaveFocus(), { timeout: 5000 })
  })
})
