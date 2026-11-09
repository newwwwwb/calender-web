// MaintenanceTab 테스트(F-06·F-12·F-08, AC-06-1·6~11·16, AC-12-1~4): 목록·배지·안내 문구·빈/로딩/오류·양식과 교체 완료 연결·캘린더 재시도
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemView } from '../domain/types'
import MaintenanceTab from './MaintenanceTab'

type Props = Partial<React.ComponentProps<typeof MaintenanceTab>>

const view = (patch: Partial<ItemView>): ItemView => ({
  id: 'i1', vehicleId: 'v1', name: '엔진오일', intervalKm: 10000, intervalMonths: 12, lastDate: '2026-05-12', lastOdometerKm: 31200, eventId: 'e1', createdAt: '2026-05-12T00:00:00Z',
  nextDate: '2026-11-12', remainingKm: 1200, status: 'ok', calendarFailed: false, ...patch,
})

function setup(props: Props = {}) {
  const fns = {
    onRetry: vi.fn(), onSave: vi.fn(() => Promise.resolve(true)), onDelete: vi.fn(() => Promise.resolve(true)),
    onComplete: vi.fn(() => Promise.resolve(true)), onRetryCalendar: vi.fn(() => Promise.resolve()),
  }
  const ui = (p: Props) => <MaintenanceTab items={[view({})]} currentKm={48000} recordsState="ready" {...fns} {...p} />
  const { rerender } = render(ui(props))
  return { ...fns, rerender: (p: Props) => rerender(ui({ ...props, ...p })) }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T09:00:00+09:00'))
})
afterEach(() => vi.useRealTimers())

describe('목록과 안내 문구', () => {
  it('MSG-12 안내가 목록 위에 있고 닫기 버튼이 없다 (AC-12-1·4)', () => {
    setup()
    const hint = screen.getByText('참고용 값입니다. 차량 매뉴얼을 우선하세요')
    const list = screen.getByRole('heading', { name: '교체 항목' })
    expect(hint.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(hint.closest('p')!).queryByRole('button')).not.toBeInTheDocument()
  })

  it('한 줄에 이름·주기·마지막 교체·다음 교체일·남은 거리가 보인다', () => {
    setup()
    const row = screen.getByRole('listitem')
    expect(row).toHaveTextContent('엔진오일')
    expect(row).toHaveTextContent('10,000km / 12개월')
    expect(row).toHaveTextContent('2026-05-12 · 31,200km')
    expect(row).toHaveTextContent('2026-11-12')
    expect(row).toHaveTextContent('1,200km')
    expect(within(row).queryByText(/곧 교체|교체 시기 지남/)).not.toBeInTheDocument() // 정상은 배지 없음
  })

  it('주기가 한 가지뿐이면 그것만, 마지막 주행거리가 없으면 날짜만 보인다', () => {
    setup({ items: [view({ intervalKm: null, lastOdometerKm: null, remainingKm: null })] })
    const row = screen.getByRole('listitem')
    expect(row).toHaveTextContent('12개월')
    expect(row).not.toHaveTextContent('/')
    expect(row).toHaveTextContent('마지막 교체 2026-05-12')
    expect(row).not.toHaveTextContent('남은 거리')
  })

  it('상태 배지는 글자로 보이고 이름 버튼 이름에도 상태가 들어간다 (AC-06-6·8)', () => {
    setup({ items: [view({ id: 'a', name: '타이어', status: 'overdue', remainingKm: -300 }), view({ id: 'b', name: '와이퍼', status: 'soon' })] })
    expect(screen.getByText('교체 시기 지남')).toBeInTheDocument()
    expect(screen.getByText('곧 교체')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '타이어, 교체 시기 지남, 수정' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '와이퍼, 곧 교체, 수정' })).toBeInTheDocument()
    expect(screen.getByText('300km 초과')).toBeInTheDocument()
  })

  it('받은 순서(훅이 정렬한 순서)를 그대로 보인다 (AC-06-16)', () => {
    setup({ items: [view({ id: 'a', name: '지남항목', status: 'overdue' }), view({ id: 'b', name: '정상항목' })] })
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('button')!.textContent)
    expect(names[0]).toContain('지남항목')
    expect(names[1]).toContain('정상항목')
  })

  it('다음 교체일을 구할 수 없으면 MSG-18을 보이고 오류 표시가 아니다 (AC-06-5)', () => {
    setup({ items: [view({ nextDate: null, remainingKm: 8000 })] })
    expect(screen.getByText('주행거리 기록 부족')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('빈·로딩·오류 상태', () => {
  it('항목이 0개면 안내 문구와 "교체 항목이 없습니다", 항목 추가 버튼은 하나뿐이다 (AC-12-3, UA-11)', () => {
    setup({ items: [] })
    expect(screen.getByText('참고용 값입니다. 차량 매뉴얼을 우선하세요')).toBeInTheDocument()
    expect(screen.getByText('교체 항목이 없습니다')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '항목 추가' })).toHaveLength(1)
  })

  it('항목이 있으면 상단에 항목 추가 버튼이 있다', () => {
    setup()
    expect(screen.getAllByRole('button', { name: '항목 추가' })).toHaveLength(1)
    expect(screen.queryByText('교체 항목이 없습니다')).not.toBeInTheDocument()
  })

  it('기록을 읽는 동안은 status 뼈대를 보인다', () => {
    setup({ recordsState: 'loading' })
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('오류면 MSG-04와 다시 시도, 누르면 재시도하고 main으로 포커스를 옮긴다', () => {
    const main = document.createElement('main')
    main.id = 'main-content'
    main.tabIndex = -1
    document.body.appendChild(main)
    const { onRetry } = setup({ recordsState: 'error' })
    expect(screen.getByRole('alert')).toHaveTextContent('차계부 데이터를 불러오지 못했습니다')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(main).toHaveFocus()
    main.remove()
  })
})

describe('양식·교체 완료·캘린더 연결', () => {
  it('항목 추가 → 저장하면 onSave가 한 번, 창이 닫힌다 (AC-06-11)', async () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: '항목 추가' }))
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: '타이어' } })
    fireEvent.change(screen.getByLabelText(/^개월 주기/), { target: { value: '48' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '저장' })))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: '타이어', intervalMonths: 48 }), undefined)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '교체 항목 추가' })).not.toBeInTheDocument())
  })

  it('이름 버튼을 누르면 값이 채워진 수정 양식이 열리고 삭제가 확인을 거친다', async () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByRole('button', { name: '엔진오일, 수정' }))
    expect(screen.getByLabelText(/^이름/)).toHaveValue('엔진오일')
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(onDelete).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: '삭제 확인' })
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '삭제' })))
    expect(onDelete).toHaveBeenCalledWith('i1')
  })

  it('"교체 완료"는 현재 주행거리를 기본값으로 대화상자를 열고 확인하면 onComplete에 전달한다 (AC-06-10)', async () => {
    const { onComplete } = setup({ items: [view({ status: 'overdue' })] })
    fireEvent.click(screen.getByRole('button', { name: '교체 완료, 엔진오일' }))
    const dialog = screen.getByRole('dialog', { name: '교체 완료' })
    expect(within(dialog).getByLabelText(/^마지막 교체 주행거리/)).toHaveValue('48000')
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '확인' })))
    expect(onComplete).toHaveBeenCalledWith('i1', { date: '2026-11-05', odometerKm: 48000 })
  })

  it('재시도에 성공해 버튼이 사라지면 포커스가 같은 행의 "교체 완료"로 간다 (2.4.3)', async () => {
    const failed = [view({ calendarFailed: true })]
    const { rerender } = setup({ items: failed })
    const retry = screen.getByRole('button', { name: /^캘린더 반영 실패/ })
    retry.focus()
    await act(async () => fireEvent.click(retry))
    rerender({ items: [view({ calendarFailed: false })] }) // 훅이 calendarFailed를 지운다
    await waitFor(() => expect(screen.getByRole('button', { name: '교체 완료, 엔진오일' })).toHaveFocus(), { timeout: 5000 })
  })

  it('일정 쓰기에 실패한 항목에만 MSG-11 버튼이 있고, 누르면 그 항목으로 재시도한다 (F-08)', async () => {
    const { onRetryCalendar } = setup({ items: [view({ id: 'a', name: '타이어', calendarFailed: true }), view({ id: 'b', name: '와이퍼' })] })
    const buttons = screen.getAllByRole('button', { name: /^캘린더 반영 실패, 다시 시도/ })
    expect(buttons).toHaveLength(1)
    await act(async () => fireEvent.click(buttons[0]))
    expect(onRetryCalendar).toHaveBeenCalledWith('a')
  })
})
