// MPR-37 QA 임시 스크립트: StatsTab의 AC-09-1~7 화면 동작(월 선택·합계·빈 달·최근 12개월·연비 목록·즉시 갱신)을 오늘 2026-11-05로 고정해 확인한다(npm test 미포함).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StatsTab from '../../../src/carbook/components/StatsTab'
import type { CarRecord, EconomySegment, RecordKind } from '../../../src/carbook/domain/types'

let n = 0
const rec = (kind: RecordKind, date: string, amountWon: number, vehicleId = 'v1'): CarRecord => ({ id: `r${n++}`, vehicleId, kind, date, amountWon, odometerKm: null, liters: null, fullTank: false, memo: null, createdAt: `t${n}` })
const seg = (endDate: string, kmPerL: number, id = endDate): EconomySegment => ({ endRecordId: id, endDate, kmPerL })
type Props = Parameters<typeof StatsTab>[0]
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T12:00:00')) })
afterEach(() => { cleanup(); vi.useRealTimers() })
const R = (records: CarRecord[], economy: EconomySegment[] = [], extra: Partial<Props> = {}) => render(<StatsTab records={records} economy={economy} recordsState="ready" onRetry={vi.fn()} {...extra} />)
const section = (name: string) => screen.getByRole('region', { name })
const rows = (s: HTMLElement) => within(s).getAllByRole('listitem').map((li) => li.textContent)
// 월 선택 영역의 현재 달 표시(최근 12개월 목록에도 같은 글자가 있어 영역을 좁혀 찾는다)
const picked = (m: string) => within(section('월 선택')).getByText(m)
const total = (text: string) => screen.getByText(text, { selector: 'p' })

describe('AC-09-1 합계 일치 / 기본은 이번 달', () => {
  const nov = [rec('fuel', '2026-11-03', 50000), rec('fuel', '2026-11-10', 40000), rec('wash', '2026-11-12', 10000), rec('insurance', '2026-11-20', 100000)]
  it('2026-11: 총 지출 200,000원, 종류별 보험 100,000 · 주유 90,000 · 세차 10,000', () => {
    R(nov); expect(picked('2026-11')).toBeTruthy(); expect(total('200,000원')).toBeTruthy()
    expect(rows(section('종류별 합계'))).toEqual(['보험100,000원', '주유90,000원', '세차10,000원'])
  })
  it('기록이 있는 종류만 보임, 금액 0 기록도 보임', () => {
    R([...nov, rec('parking', '2026-11-01', 0)]); const r = rows(section('종류별 합계')); expect(r).toHaveLength(4); expect(r.at(-1)).toBe('주차0원')
  })
})

describe('AC-09-2 월 경계 / 이전·다음 달 이동', () => {
  it('11월 20,000, 이전 달 → 10월 30,000, 다음 달 → 11월', () => {
    R([rec('fuel', '2026-10-31', 30000), rec('fuel', '2026-11-01', 20000)]); expect(total('20,000원')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '이전 달' })); expect(picked('2026-10')).toBeTruthy(); expect(total('30,000원')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다음 달' })); expect(picked('2026-11')).toBeTruthy()
  })
  it('연도 경계: 2026-01 → 이전 달 → 2025-12', () => {
    R([rec('fuel', '2025-12-31', 7), rec('fuel', '2026-01-01', 9)])
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: '이전 달' }))
    expect(picked('2026-01')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: '이전 달' })); expect(picked('2025-12')).toBeTruthy(); expect(total('7원')).toBeTruthy()
  })
  it('이동 범위 끝(스펙에 없는 안전장치, 판정 보조): 다음 달은 이번 달+12개월에서 aria-disabled', () => {
    R([]); const next = screen.getByRole('button', { name: '다음 달' }); for (let i = 0; i < 20; i++) fireEvent.click(next)
    expect(picked('2027-11')).toBeTruthy(); expect(next.getAttribute('aria-disabled')).toBe('true')
  })
})

describe('AC-09-3 차량 분리(화면 범위)', () => {
  it('화면은 받은 records만 합산: 차량 B 기록만 넘기면 5,000원. 선택 차량 필터는 호출 쪽(MPR-38)에서 확인', () => {
    R([rec('fuel', '2026-11-05', 5000, 'B')]); expect(total('5,000원')).toBeTruthy(); cleanup(); R([rec('fuel', '2026-11-05', 100000, 'A')]); expect(total('100,000원')).toBeTruthy()
  })
})

describe('AC-09-4 빈 달', () => {
  it('기록 없는 달: "0원"과 "이 달의 기록이 없습니다", 종류별 구역 없음, 오류 없음', () => {
    R([rec('fuel', '2026-10-05', 1)]); expect(total('0원')).toBeTruthy(); expect(screen.getByText('이 달의 기록이 없습니다')).toBeTruthy()
    expect(screen.queryByRole('region', { name: '종류별 합계' })).toBeNull(); expect(screen.queryByRole('alert')).toBeNull()
  })
  it('기록이 하나도 없어도 같은 화면, 금액 0 기록만 있는 달에는 "기록 없음" 문구가 없음', () => {
    R([]); expect(screen.getByText('이 달의 기록이 없습니다')).toBeTruthy(); cleanup(); R([rec('fuel', '2026-11-05', 0)]); expect(screen.queryByText('이 달의 기록이 없습니다')).toBeNull()
  })
  it('낭독용 status가 달·총액을 문장으로 알림(빈 달이면 문구 포함)', () => {
    R([]); expect(screen.getAllByRole('status').some((s) => s.textContent === '2026년 11월 총 지출 0원, 이 달의 기록이 없습니다')).toBe(true)
  })
})

describe('AC-09-5 연비 변화', () => {
  it('2026-10-20 — 10.0km/L, 2026-11-01 — 15.0km/L 순서', () => {
    R([], [seg('2026-10-20', 10), seg('2026-11-01', 15)]); expect(rows(section('연비 변화'))).toEqual(['2026-10-20 — 10.0km/L', '2026-11-01 — 15.0km/L'])
  })
  it('소수 첫째 자리 반올림, 구간이 없으면 "가득 주유 기록이 2건 이상 필요합니다"', () => {
    R([], [seg('2026-11-01', 12.34, 'a'), seg('2026-11-02', 9.96, 'b')]); expect(rows(section('연비 변화'))).toEqual(['2026-11-01 — 12.3km/L', '2026-11-02 — 10.0km/L']); cleanup()
    R([]); expect(screen.getByText('가득 주유 기록이 2건 이상 필요합니다')).toBeTruthy(); expect(within(section('연비 변화')).queryAllByRole('listitem')).toHaveLength(0)
  })
})

describe('AC-09-6 즉시 갱신', () => {
  it('기록 삭제(props 갱신) → 다시 불러오기 없이 합계가 삭제된 금액만큼 줄고 종류별에서 사라짐', () => {
    const a = rec('fuel', '2026-11-03', 50000), b = rec('wash', '2026-11-12', 10000); const { rerender } = R([a, b]); expect(total('60,000원')).toBeTruthy()
    rerender(<StatsTab records={[a]} economy={[]} recordsState="ready" onRetry={vi.fn()} />); expect(total('50,000원')).toBeTruthy(); expect(rows(section('종류별 합계'))).toEqual(['주유50,000원'])
    rerender(<StatsTab records={[]} economy={[]} recordsState="ready" onRetry={vi.fn()} />); expect(total('0원')).toBeTruthy()
  })
  it('달을 옮긴 뒤 기록이 바뀌어도 선택한 달은 유지', () => {
    const a = rec('fuel', '2026-10-03', 5); const { rerender } = R([a]); fireEvent.click(screen.getByRole('button', { name: '이전 달' }))
    rerender(<StatsTab records={[a, rec('fuel', '2026-10-04', 6)]} economy={[]} recordsState="ready" onRetry={vi.fn()} />); expect(picked('2026-10')).toBeTruthy(); expect(total('11원')).toBeTruthy()
  })
})

describe('AC-09-7 최근 12개월 목록', () => {
  it('2026-11부터 2025-12까지 12개, 기록 없는 달 0원, 선택한 달(2026-03)과 무관', () => {
    R([rec('fuel', '2026-11-02', 70000), rec('wash', '2026-11-04', 3000), rec('fuel', '2026-03-10', 20000)])
    const expected = ['2026-11', '2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01', '2025-12']
    const get = () => rows(section('월별 합계')); const before = get()
    expect(before.map((r) => r!.slice(0, 7))).toEqual(expected); expect(before[0]).toBe('2026-1173,000원'); expect(before[1]).toBe('2026-100원'); expect(before[8]).toBe('2026-0320,000원')
    for (let i = 0; i < 8; i++) fireEvent.click(screen.getByRole('button', { name: '이전 달' }))
    expect(picked('2026-03')).toBeTruthy(); expect(get()).toEqual(before)
  })
})

describe('불러오기 상태 (AC-10-7 화면 부분)', () => {
  const one = () => [rec('fuel', '2026-11-05', 1)]
  it('loading: 합계 대신 status "불러오는 중"', () => { R(one(), [], { recordsState: 'loading' }); expect(screen.getByRole('status').textContent).toBe('불러오는 중'); expect(screen.queryByText('총 지출')).toBeNull() })
  it('error: MSG-04와 "다시 시도", 누르면 onRetry 1회·포커스가 main으로', () => {
    const onRetry = vi.fn(); const main = document.createElement('main'); main.id = 'main-content'; main.tabIndex = -1; document.body.append(main)
    R(one(), [], { recordsState: 'error', onRetry }); expect(screen.getByText('차계부 데이터를 불러오지 못했습니다')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1); expect(document.activeElement).toBe(main); main.remove()
  })
})
