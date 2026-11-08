// RecordsTab 테스트(F-04·F-05): 연비 요약(AC-05-1·2·4), 목록·행 내용·순서, 빈 상태(UA-11), 추가·수정·삭제 연결(AC-04-2), 현재 주행거리 계산, 로딩·오류, 삭제 뒤 포커스
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CarRecord, EconomySegment, RecordKind } from '../domain/types'
import RecordsTab from './RecordsTab'

let n = 0
const rec = (over: Partial<CarRecord> & { kind?: RecordKind } = {}): CarRecord => ({
  id: `r${++n}`, vehicleId: 'v1', kind: 'other', date: '2026-11-03', amountWon: 10000, odometerKm: null, liters: null, fullTank: false, memo: null, createdAt: '2026-11-03T00:00:00Z', ...over,
})

function setup(over: Partial<React.ComponentProps<typeof RecordsTab>> = {}) {
  const props = {
    records: [] as CarRecord[],
    economy: [] as EconomySegment[],
    vehicleOdometerKm: null,
    recordsState: 'ready' as const,
    onRetry: vi.fn(),
    onSave: vi.fn(() => Promise.resolve(true)),
    onDelete: vi.fn(() => Promise.resolve(true)),
    ...over,
  }
  const view = render(<RecordsTab {...props} />)
  return { ...props, rerender: (next: Partial<typeof props>) => view.rerender(<RecordsTab {...props} {...next} />) }
}

const rows = () => within(screen.getByRole('region', { name: '기록' })).getAllByRole('listitem')

describe('연비 요약 (AC-05-1·2·4)', () => {
  it('가장 최근 구간의 연비를 "연비 10.0km/L"로 보인다', () => {
    setup({ economy: [{ endRecordId: 'a', endDate: '2026-10-20', kmPerL: 10 }] })
    expect(screen.getByText('10.0km/L')).toBeInTheDocument()
  })

  it('구간이 더 생기면 최근 구간 값으로 바뀌고, 이전 구간 행의 연비는 그대로다', () => {
    const b = rec({ id: 'b', kind: 'fuel', date: '2026-10-20', odometerKm: 10500, liters: 30, fullTank: true })
    const c = rec({ id: 'c', kind: 'fuel', date: '2026-11-01', odometerKm: 11100, liters: 40, fullTank: true })
    setup({
      records: [c, b],
      economy: [
        { endRecordId: 'b', endDate: '2026-10-20', kmPerL: 10 },
        { endRecordId: 'c', endDate: '2026-11-01', kmPerL: 15 },
      ],
    })
    expect(screen.getByText('15.0km/L', { selector: 'strong' })).toBeInTheDocument()
    expect(rows()[1]).toHaveTextContent('연비 10.0km/L') // b 행
  })

  it('구간이 없으면 안내 문구가 보이고 연비 숫자는 없다', () => {
    setup({ records: [rec()] })
    expect(screen.getByText('연비: 가득 주유 기록이 2건 이상 필요합니다')).toBeInTheDocument()
    expect(screen.queryByText(/km\/L/)).not.toBeInTheDocument()
  })
})

describe('목록', () => {
  it('받은 순서(날짜 내림차순)대로 행이 보이고 행마다 날짜·종류·금액·세부·메모가 있다', () => {
    const records = [
      rec({ date: '2026-11-05', kind: 'fuel', amountWon: 52000, odometerKm: 12345, liters: 35.2, memo: '출퇴근용 주유소' }),
      rec({ date: '2026-11-03', kind: 'wash', amountWon: 8000 }),
    ]
    setup({ records })
    const list = rows()
    expect(list).toHaveLength(2)
    expect(list[0]).toHaveTextContent('2026-11-05 · 주유52,000원12,345km · 35.2L출퇴근용 주유소')
    expect(list[1]).toHaveTextContent('2026-11-03 · 세차8,000원')
    expect(list[1].querySelector('span[class*="detail"]')).toBeNull() // 세부가 없으면 줄이 없다
  })

  it('행의 이름(스크린리더용)에 모든 정보가 문장으로 들어 있다', () => {
    setup({ records: [rec({ date: '2026-11-05', kind: 'fuel', amountWon: 52000, odometerKm: 12345, liters: 35.2, memo: '메모' })] })
    expect(screen.getByRole('button', { name: '2026-11-05 주유 52,000원, 12,345km, 35.2L, 메모 메모, 수정' })).toBeInTheDocument()
  })

  it('기록이 있으면 상단에 "기록 추가"가 하나 있다', () => {
    setup({ records: [rec()] })
    expect(screen.getAllByRole('button', { name: '기록 추가' })).toHaveLength(1)
  })
})

describe('빈 상태 (UA-11)', () => {
  it('"기록이 없습니다"와 "기록 추가" 버튼 하나만 보이고 연비 안내는 그대로 보인다', () => {
    setup()
    expect(screen.getByText('기록이 없습니다')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '기록 추가' })).toHaveLength(1)
    expect(screen.getByText('연비: 가득 주유 기록이 2건 이상 필요합니다')).toBeInTheDocument()
  })
})

describe('추가·수정·삭제 (AC-04-2)', () => {
  it('"기록 추가"가 추가 양식을 열고 저장하면 id 없이 onSave가 불린다', async () => {
    const { onSave } = setup({ records: [rec()] })
    fireEvent.click(screen.getByRole('button', { name: '기록 추가' }))
    fireEvent.change(screen.getByLabelText(/^종류/), { target: { value: 'wash' } })
    fireEvent.change(screen.getByLabelText(/^금액/), { target: { value: '8000' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }))
    })
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kind: 'wash', amountWon: 8000 }), undefined)
  })

  it('행을 누르면 수정 양식이 열리고 금액을 고쳐 저장하면 그 id로 onSave가 불린다', async () => {
    const r = rec({ amountWon: 52000 })
    const { onSave } = setup({ records: [r] })
    fireEvent.click(rows()[0].querySelector('button')!)
    expect(screen.getByRole('dialog', { name: '기록 수정' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^금액/), { target: { value: '53000' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }))
    })
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ amountWon: 53000 }), r.id)
  })

  it('수정 양식의 삭제는 확인 뒤 onDelete가 그 id로 불린다', async () => {
    const r = rec()
    const { onDelete } = setup({ records: [r] })
    fireEvent.click(rows()[0].querySelector('button')!)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('dialog', { name: '삭제 확인' }).querySelector('button')!)
    })
    expect(onDelete).toHaveBeenCalledWith(r.id)
  })

  it('마지막 기록을 삭제해 행이 사라져도 포커스가 body로 떨어지지 않는다', async () => {
    const r = rec()
    const { rerender } = setup({ records: [r] })
    fireEvent.click(rows()[0].querySelector('button')!)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('dialog', { name: '삭제 확인' }).querySelector('button')!)
    })
    rerender({ records: [] })
    await waitFor(() => expect(screen.getByRole('button', { name: '기록 추가' })).toHaveFocus())
  })
})

describe('현재 주행거리 확인에 쓰는 값 (BR-07·08)', () => {
  const records = [rec({ odometerKm: 50000 }), rec({ id: 'low', odometerKm: 40000 })]

  it('기록 추가에서는 차량·기록 중 최댓값보다 작으면 MSG-10 확인창이 뜬다', () => {
    setup({ records, vehicleOdometerKm: 30000 })
    fireEvent.click(screen.getByRole('button', { name: '기록 추가' }))
    fireEvent.change(screen.getByLabelText(/^종류/), { target: { value: 'other' } })
    fireEvent.change(screen.getByLabelText(/^금액/), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText(/^주행거리/), { target: { value: '49000' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByText('주행거리가 이전 최대 기록(50,000km)보다 작습니다. 그래도 저장할까요?')).toBeInTheDocument()
  })

  it('수정 중인 기록 자신은 제외하고 계산한다(최대 기록을 낮춰 고쳐도 자기 자신 때문에 경고하지 않는다)', async () => {
    const { onSave } = setup({ records: [records[0]], vehicleOdometerKm: null })
    fireEvent.click(rows()[0].querySelector('button')!)
    fireEvent.change(screen.getByLabelText(/^주행거리/), { target: { value: '49000' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }))
    })
    expect(screen.queryByText(/그래도 저장할까요/)).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})

describe('로딩·오류', () => {
  it('불러오는 중이면 로딩 표시만 보인다', () => {
    setup({ recordsState: 'loading' })
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
    expect(screen.queryByRole('button', { name: '기록 추가' })).not.toBeInTheDocument()
  })

  it('실패하면 MSG-04와 "다시 시도"만 보이고, 누르면 다시 읽고 main으로 포커스가 간다', () => {
    const { onRetry } = setup({ recordsState: 'error' })
    const main = document.createElement('main')
    main.id = 'main-content'
    main.tabIndex = -1
    document.body.appendChild(main)
    expect(screen.getByRole('alert')).toHaveTextContent('차계부 데이터를 불러오지 못했습니다')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(main).toHaveFocus()
    main.remove()
  })
})
