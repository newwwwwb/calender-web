// StatsTab 테스트(F-09): 합계·종류별(AC-09-1), 월 경계(02), 빈 달(04), 연비 변화(05), 즉시 갱신(06), 최근 12개월(07), 상태(로딩·오류)
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarRecord, EconomySegment, RecordKind } from '../domain/types'
import StatsTab from './StatsTab'

let n = 0
const rec = (kind: RecordKind, date: string, amountWon: number): CarRecord => ({
  id: `r${++n}`, vehicleId: 'v1', kind, date, amountWon, odometerKm: null, liters: null, fullTank: false, memo: null, createdAt: '2026-11-01T00:00:00Z',
})

function setup(records: CarRecord[], economy: EconomySegment[] = [], extra: Partial<React.ComponentProps<typeof StatsTab>> = {}) {
  const props = { records, economy, recordsState: 'ready' as const, onRetry: vi.fn(), ...extra }
  const view = render(<StatsTab {...props} />)
  return { ...props, rerender: (next: Partial<typeof props>) => view.rerender(<StatsTab {...props} {...next} />) }
}

const section = (name: string) => screen.getByRole('region', { name })
// 월 선택 줄 안의 선택 달 표시(같은 글자가 월별 합계 목록에도 있어 범위를 좁힌다)
const picked = (month: string) => within(screen.getByRole('button', { name: '이전 달' }).parentElement!).getByText(month)
const prev = () => fireEvent.click(screen.getByRole('button', { name: '이전 달' }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 5)) // 2026-11-05
})

afterEach(() => {
  vi.useRealTimers()
})

describe('선택한 달의 합계 (AC-09-1·02)', () => {
  const records = [rec('fuel', '2026-11-03', 50000), rec('fuel', '2026-11-10', 40000), rec('wash', '2026-11-12', 10000), rec('insurance', '2026-11-20', 100000)]

  it('기본은 이번 달이고 총합과 종류별 합계(금액 큰 순)가 보인다', () => {
    setup(records)
    expect(picked('2026-11')).toBeInTheDocument()
    expect(screen.getByText('200,000원', { selector: 'p' })).toBeInTheDocument()
    const rows = within(section('종류별 합계')).getAllByRole('listitem').map((li) => li.textContent)
    expect(rows).toEqual(['보험100,000원', '주유90,000원', '세차10,000원'])
  })

  it('월 경계: 10월 31일은 10월, 11월 1일은 11월이다', () => {
    setup([rec('other', '2026-10-31', 30000), rec('other', '2026-11-01', 20000)])
    expect(screen.getByText('20,000원', { selector: 'p' })).toBeInTheDocument()
    prev()
    expect(picked('2026-10')).toBeInTheDocument()
    expect(screen.getByText('30,000원', { selector: 'p' })).toBeInTheDocument()
  })

  it('이전·다음 달 버튼이 달을 옮기고 해를 넘어간다', () => {
    setup([])
    for (let i = 0; i < 11; i++) prev()
    expect(picked('2025-12')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
    expect(picked('2026-01')).toBeInTheDocument()
  })

  it('총합 영역은 aria-live polite라 달이 바뀌면 읽힌다', () => {
    setup(records)
    expect(screen.getByText('총 지출').parentElement).toHaveAttribute('aria-live', 'polite')
  })
})

describe('빈 달 (AC-09-4)', () => {
  it('"0원"과 "이 달의 기록이 없습니다"가 보이고 오류는 없다', () => {
    setup([rec('fuel', '2026-03-01', 1000)])
    expect(screen.getByText('0원', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('이 달의 기록이 없습니다')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '종류별 합계' })).not.toBeInTheDocument()
  })

  it('금액 0원 기록도 기록이므로 "이 달의 기록이 없습니다"가 아니다', () => {
    setup([rec('parking', '2026-11-02', 0)])
    expect(screen.queryByText('이 달의 기록이 없습니다')).not.toBeInTheDocument()
    expect(within(section('종류별 합계')).getByText('주차')).toBeInTheDocument()
  })
})

describe('월별 합계 목록 (AC-09-7)', () => {
  it('선택한 달과 무관하게 오늘이 속한 달부터 12개월, 최근 달이 위, 기록 없는 달은 0원', () => {
    setup([rec('fuel', '2026-11-02', 70000), rec('fuel', '2026-03-10', 5000)])
    for (let i = 0; i < 8; i++) prev() // 선택한 달 2026-03
    expect(picked('2026-03')).toBeInTheDocument()
    const rows = within(section('월별 합계')).getAllByRole('listitem').map((li) => li.textContent)
    expect(rows).toHaveLength(12)
    expect(rows[0]).toBe('2026-1170,000원')
    expect(rows[11]).toBe('2025-120원')
    expect(rows[8]).toBe('2026-035,000원')
    expect(rows[1]).toBe('2026-100원')
  })
})

describe('연비 변화 (AC-09-5)', () => {
  it('구간을 날짜 오름차순으로 `날짜 — 12.3km/L`로 보인다', () => {
    setup([], [
      { endRecordId: 'a', endDate: '2026-10-20', kmPerL: 10 },
      { endRecordId: 'b', endDate: '2026-11-01', kmPerL: 15.04 },
    ])
    const rows = within(section('연비 변화')).getAllByRole('listitem').map((li) => li.textContent)
    expect(rows).toEqual(['2026-10-20 — 10.0km/L', '2026-11-01 — 15.0km/L'])
  })

  it('구간이 없으면 안내 문구가 보인다', () => {
    setup([])
    expect(screen.getByText('가득 주유 기록이 2건 이상 필요합니다')).toBeInTheDocument()
  })
})

describe('즉시 갱신 (AC-09-6)', () => {
  it('기록이 줄어들면 다시 불러오기 없이 합계가 그만큼 줄어든다', () => {
    const keep = rec('fuel', '2026-11-03', 30000)
    const gone = rec('wash', '2026-11-04', 10000)
    const { rerender } = setup([keep, gone])
    expect(screen.getByText('40,000원', { selector: 'p' })).toBeInTheDocument()
    rerender({ records: [keep] })
    expect(screen.getByText('30,000원', { selector: 'p' })).toBeInTheDocument()
  })
})

describe('로딩·오류', () => {
  it('불러오는 중이면 로딩 표시만 보인다', () => {
    setup([], [], { recordsState: 'loading' })
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
    expect(screen.queryByText('총 지출')).not.toBeInTheDocument()
  })

  it('실패하면 MSG-04와 "다시 시도"만 보이고, 누르면 다시 읽는다', () => {
    const { onRetry } = setup([], [], { recordsState: 'error' })
    expect(screen.getByRole('alert')).toHaveTextContent('차계부 데이터를 불러오지 못했습니다')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('총 지출')).not.toBeInTheDocument()
  })
})
