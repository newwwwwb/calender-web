// CarbookApp 통합 테스트(MPR-38): 실제 useCarbook과 실제 패널을 연결하고 데이터 계층(carbookApi·calendarLink)·useAuth·useCalendar·useToast만 모의한다.
// AC-02-1(비로그인 무요청), AC-04 목록 표시, 선택 차량 기록만 계산, 하위 탭 연결, AC-08-12 저장 → 캘린더 다시 읽기, 차량 0대 빈 상태
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarRecord, DueDate, MaintenanceItem, Vehicle } from './domain/types'

const m = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() },
  api: {} as Record<string, ReturnType<typeof vi.fn>>,
  showToast: vi.fn(),
  reload: vi.fn(),
  link: { ensureCategoryId: vi.fn(), fetchEvents: vi.fn(), syncEvent: vi.fn(), deleteEvent: vi.fn(), rebindCategory: vi.fn() },
}))
vi.mock('../state/useAuth', () => ({ useAuth: () => m.auth }))
vi.mock('./data/carbookApi', () => {
  for (const n of ['listVehicles', 'listItems', 'listDueDates', 'listRecords', 'deleteVehicle', 'createRecord', 'deleteRecord', 'updateVehicle', 'createItems', 'updateItem', 'deleteItem', 'createDueDate', 'updateDueDate', 'deleteDueDate', 'clearEventId', 'fillMissingItemOdometer', 'createVehicle', 'updateRecord']) m.api[n] = vi.fn()
  return m.api
})
vi.mock('./data/calendarLink', () => ({ createCalendarLink: () => m.link }))
vi.mock('../state/useCalendar', () => ({ useCalendar: () => ({ reload: m.reload }) }))
vi.mock('../state/useToast', () => ({ useToast: () => ({ showToast: m.showToast }) }))

import CarbookApp from './CarbookApp'

const vehicle = (id: string, name: string, odometerKm: number | null = null): Vehicle => ({ id, name, model: null, year: null, plate: null, odometerKm, createdAt: id })
const record = (id: string, vehicleId: string, amountWon: number, date = '2026-11-03'): CarRecord => ({ id, vehicleId, kind: 'other', date, amountWon, odometerKm: null, liters: null, fullTank: false, memo: null, createdAt: id })
const item = (o: Partial<MaintenanceItem> = {}): MaintenanceItem => ({ id: 'i1', vehicleId: 'v1', name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: '2026-05-12', lastOdometerKm: null, eventId: 'e1', createdAt: 'a', ...o })
const due = (o: Partial<DueDate> = {}): DueDate => ({ id: 'd1', vehicleId: 'v1', kind: 'insurance', dueDate: '2027-03-10', eventId: 'ed1', createdAt: 'a', ...o })

function load(opts: { vehicles?: Vehicle[]; records?: Record<string, CarRecord[]>; items?: MaintenanceItem[]; dues?: DueDate[] } = {}) {
  m.api.listVehicles.mockResolvedValue(opts.vehicles ?? [vehicle('v1', '출퇴근', 48000)])
  m.api.listItems.mockResolvedValue(opts.items ?? [])
  m.api.listDueDates.mockResolvedValue(opts.dues ?? [])
  m.api.listRecords.mockImplementation(async (vehicleId: string) => opts.records?.[vehicleId] ?? [])
}

const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))

beforeEach(() => {
  for (const f of [...Object.values(m.api), m.showToast, m.reload, m.auth.signInWithGoogle, ...Object.values(m.link)]) f.mockReset()
  m.auth.user = { id: 'user-1' }
  m.auth.loading = false
  m.link.ensureCategoryId.mockResolvedValue('cat')
  m.link.fetchEvents.mockImplementation(async (ids: string[]) => new Map(ids.map((id) => [id, { id, title: '', start_at: '', category_id: 'cat' }])))
  m.link.syncEvent.mockResolvedValue('written')
  m.link.deleteEvent.mockResolvedValue(true)
  m.reload.mockResolvedValue(undefined)
  m.api.fillMissingItemOdometer.mockResolvedValue([])
})

describe('로그인 게이트와 빈 상태', () => {
  it('AC-02-1: 비로그인이면 차계부 데이터·캘린더 연동으로 가는 요청이 0건이다', () => {
    m.auth.user = null
    render(<CarbookApp />)
    expect(screen.getByText('로그인하면 사용할 수 있습니다')).toBeInTheDocument()
    for (const f of [...Object.values(m.api), ...Object.values(m.link)]) expect(f).not.toHaveBeenCalled()
  })

  it('차량 0대면 차량 영역의 빈 상태만 보이고 하위 탭은 없다 (SCR-03)', async () => {
    load({ vehicles: [] })
    render(<CarbookApp />)
    expect(await screen.findByText('차량을 추가해 주세요')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})

describe('패널 연결', () => {
  it('차량이 있으면 차량 영역과 하위 탭 4개가 보이고 기록 탭이 처음 열린다(선택 차량의 기록, AC-04)', async () => {
    load({ records: { v1: [record('r1', 'v1', 12000)] } })
    render(<CarbookApp />)
    expect(await screen.findByRole('tablist', { name: '차계부 보기' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '기록', selected: true })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /12,000원/ })).toBeInTheDocument()
    expect(m.api.listRecords).toHaveBeenCalledWith('v1')
  })

  it('선택 차량의 기록만 계산에 넘긴다: 다른 차량의 기록은 목록과 통계에 나오지 않는다', async () => {
    load({ vehicles: [vehicle('v1', '출퇴근'), vehicle('v2', '가족')], records: { v1: [record('r1', 'v1', 12000, '2026-11-03')], v2: [record('r2', 'v2', 777000, '2026-11-04')] } })
    render(<CarbookApp />)
    await screen.findByRole('button', { name: /12,000원/ })
    expect(screen.queryByRole('button', { name: /777,000원/ })).not.toBeInTheDocument()
    openTab('통계')
    expect((await screen.findAllByText(/12,000원/)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/777,000원/)).not.toBeInTheDocument()
    // 차량을 바꾸면 하위 탭은 유지되고 그 차량의 기록으로 계산된다(AC-03-9)
    fireEvent.change(screen.getByLabelText('차량'), { target: { value: 'v2' } })
    expect((await screen.findAllByText(/777,000원/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: '통계', selected: true })).toBeInTheDocument()
    expect(m.api.listRecords).toHaveBeenCalledWith('v2')
  })

  it('교체 알림 탭과 만기일 탭이 훅의 값을 보인다 (F-06·F-07)', async () => {
    load({ items: [item()], dues: [due()] })
    render(<CarbookApp />)
    await screen.findByRole('tablist')
    openTab('교체 알림')
    expect(await screen.findByRole('button', { name: '엔진오일, 수정' })).toBeInTheDocument()
    expect(screen.getByText('참고용 값입니다. 차량 매뉴얼을 우선하세요')).toBeInTheDocument()
    openTab('만기일')
    expect(await screen.findByText('2027-03-10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '보험 만기 수정' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '정기검사 입력' })).toBeInTheDocument()
  })
})

describe('저장 → 캘린더 반영 (AC-08-12)', () => {
  it('만기일을 저장하면 일정을 만들고 캘린더를 60초 폴링을 기다리지 않고 바로 다시 읽는다', async () => {
    load()
    m.api.createDueDate.mockImplementation(async (row: { id: string; vehicleId: string; kind: DueDate['kind']; dueDate: string; eventId: string }) => ({ ...row, createdAt: 'n' }))
    render(<CarbookApp />)
    await screen.findByRole('tablist')
    openTab('만기일')
    fireEvent.click(await screen.findByRole('button', { name: '보험 만기 입력' }))
    fireEvent.change(screen.getByLabelText('만기일 (필수)'), { target: { value: '2027-03-10' } })
    const startedAt = Date.now()
    await act(async () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' })))
    await waitFor(() => expect(m.reload).toHaveBeenCalledTimes(1))
    expect(m.api.createDueDate).toHaveBeenCalledTimes(1)
    expect(m.link.syncEvent.mock.calls[0][0]).toMatchObject({ title: '[출퇴근] 보험 만기', date: '2027-03-10' })
    expect(Date.now() - startedAt).toBeLessThan(3000) // 모의 계층 기준의 코드 경로 시간(실서버 3초 실측은 별도)
    expect(await screen.findByText('2027-03-10')).toBeInTheDocument()
  })
})
