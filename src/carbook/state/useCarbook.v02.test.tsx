// useCarbook v0.2 테스트: 기본 차량 선택·지정(AC-19-1~4·6~8·12), 추천 되돌리기(AC-20-2·3·6·7·9), 미입력 항목(AC-24-2~4·7), 일정 메모(AC-26-1·2) (data/*는 모의)
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError } from '../data/request'
import { addDays, today } from '../domain/dateKey'
import { MSG_01_SAVE_FAILED, MSG_28_KM_BASIS_MEMO } from '../domain/messages'
import type { CarRecord, MaintenanceItem, Vehicle } from '../domain/types'

const m = vi.hoisted(() => ({
  api: {} as Record<string, ReturnType<typeof vi.fn>>, showToast: vi.fn(), reload: vi.fn(),
  link: { ensureCategoryId: vi.fn(), fetchEvents: vi.fn(), syncEvent: vi.fn(), deleteEvent: vi.fn(), rebindCategory: vi.fn() },
}))
vi.mock('../data/carbookApi', () => {
  for (const n of ['listVehicles', 'listItems', 'listDueDates', 'listRecords', 'getSettings', 'setDefaultVehicle', 'resetItemCycles', 'deleteVehicle', 'updateItem', 'clearEventId', 'fillMissingItemOdometer']) m.api[n] = vi.fn()
  return m.api
})
vi.mock('../data/calendarLink', () => ({ createCalendarLink: () => m.link }))
vi.mock('../../state/useCalendar', () => ({ useCalendar: () => ({ reload: m.reload }) }))
vi.mock('../../state/useToast', () => ({ useToast: () => ({ showToast: m.showToast }) }))

import { useCarbook } from './useCarbook'

const veh = (id: string, o: Partial<Vehicle> = {}): Vehicle => ({ id, name: `차${id}`, model: null, year: null, plate: null, odometerKm: 48000, createdAt: id, ...o })
const item = (id: string, o: Partial<MaintenanceItem> = {}): MaintenanceItem => ({ id, vehicleId: 'v1', name: '엔진오일', intervalKm: 10000, intervalMonths: 12, lastDate: today(), lastOdometerKm: null, eventId: null, createdAt: id, ...o })
const rec = (id: string, date: string, odometerKm: number): CarRecord => ({ id, vehicleId: 'v1', kind: 'other', date, amountWon: 1, odometerKm, liters: null, fullTank: false, memo: null, createdAt: id })
const fail = () => new CarbookError('network')

async function setup(o: { vehicles?: Vehicle[]; items?: MaintenanceItem[]; records?: CarRecord[]; settings?: { defaultVehicleId: string | null } | Error } = {}) {
  m.api.listVehicles.mockResolvedValue(o.vehicles ?? [veh('v1'), veh('v2')]); m.api.listItems.mockResolvedValue(o.items ?? [])
  m.api.listDueDates.mockResolvedValue([]); m.api.listRecords.mockResolvedValue(o.records ?? [])
  const s = o.settings ?? { defaultVehicleId: null }
  if (s instanceof Error) m.api.getSettings.mockRejectedValue(s); else m.api.getSettings.mockResolvedValue(s)
  const hook = renderHook(() => useCarbook('user-1'))
  await waitFor(() => expect(hook.result.current.recordsState).toBe('ready'))
  return hook
}

beforeEach(() => {
  for (const f of [...Object.values(m.api), m.showToast, m.reload, ...Object.values(m.link)]) f.mockReset()
  m.link.syncEvent.mockResolvedValue('written'); m.link.deleteEvent.mockResolvedValue(true)
  m.link.ensureCategoryId.mockResolvedValue('cat')
  m.link.fetchEvents.mockImplementation(async (ids: string[]) => new Map(ids.map((id) => [id, { id, title: '', start_at: '', category_id: 'cat', memo: null }])))
  m.reload.mockResolvedValue(undefined)
  m.api.fillMissingItemOdometer.mockResolvedValue([])
})

describe('기본 차량 선택(BR-41~43)', () => {
  it('기본 차량이 목록에 있으면 처음 읽을 때 그 차량이 선택된다(AC-19-1)', async () => {
    const { result } = await setup({ settings: { defaultVehicleId: 'v2' } })
    expect(result.current.selectedVehicleId).toBe('v2')
    expect(result.current.defaultVehicleId).toBe('v2')
    expect(result.current.settingsFailed).toBe(false)
  })

  it('기본 차량이 목록에 없거나 지정이 없으면 가장 먼저 만든 차량이다(AC-19-2)', async () => {
    expect((await setup({ settings: { defaultVehicleId: 'gone' } })).result.current.selectedVehicleId).toBe('v1')
    expect((await setup()).result.current.selectedVehicleId).toBe('v1')
  })

  it('직접 고른 차량이 기본 차량보다 우선한다(BR-41)', async () => {
    const { result } = await setup({ settings: { defaultVehicleId: 'v2' } })
    act(() => result.current.selectVehicle('v1'))
    expect(result.current.selectedVehicleId).toBe('v1')
  })

  it('설정 읽기만 실패하면 settingsFailed이고 지정 없음으로 진행하며 MSG-04·토스트가 없다(AC-19-12·13)', async () => {
    const { result } = await setup({ settings: fail() })
    expect(result.current.loadState).toBe('ready')
    expect(result.current.settingsFailed).toBe(true)
    expect(result.current.defaultVehicleId).toBeNull()
    expect(result.current.selectedVehicleId).toBe('v1')
    expect(m.showToast).not.toHaveBeenCalled()
  })

  it('기본 차량을 지정하면 값만 바뀌고 지금 보는 차량은 그대로다(AC-19-3, BR-42)', async () => {
    const { result } = await setup({ settings: fail() })
    m.api.setDefaultVehicle.mockResolvedValue({ defaultVehicleId: 'v2' })
    let ok = false
    await act(async () => { ok = await result.current.setDefaultVehicle('v2') })
    expect(ok).toBe(true)
    expect(m.api.setDefaultVehicle).toHaveBeenCalledWith('v2')
    expect(result.current.defaultVehicleId).toBe('v2')
    expect(result.current.settingsFailed).toBe(false)
    expect(result.current.selectedVehicleId).toBe('v1')
  })

  it('지정 해제(null)도 저장하고, 실패하면 이전 값을 두고 MSG-01이다(AC-19-4)', async () => {
    const { result } = await setup({ settings: { defaultVehicleId: 'v2' } })
    m.api.setDefaultVehicle.mockRejectedValueOnce(fail())
    let ok = true
    await act(async () => { ok = await result.current.setDefaultVehicle(null) })
    expect(ok).toBe(false)
    expect(result.current.defaultVehicleId).toBe('v2')
    expect(m.showToast).toHaveBeenCalledWith(expect.objectContaining({ message: MSG_01_SAVE_FAILED }))
    m.api.setDefaultVehicle.mockResolvedValueOnce({ defaultVehicleId: null })
    await act(async () => { ok = await result.current.setDefaultVehicle(null) })
    expect(ok).toBe(true)
    expect(result.current.defaultVehicleId).toBeNull()
  })

  it('기본 차량을 지우면 defaultVehicleId가 null이 되고 선택은 첫 차량이다(AC-19-5, AC-03-7)', async () => {
    const { result } = await setup({ settings: { defaultVehicleId: 'v2' } })
    m.api.deleteVehicle.mockResolvedValue(undefined)
    await act(async () => { await result.current.deleteVehicle('v2') })
    expect(result.current.defaultVehicleId).toBeNull()
    expect(result.current.selectedVehicleId).toBe('v1')
  })
})

describe('추천 되돌리기(BR-44~47)', () => {
  const changed = (o: Partial<MaintenanceItem> = {}) => item('i1', { intervalKm: 5000, intervalMonths: 6, eventId: 'e1', ...o })

  it('바꿀 항목이 없으면 요청 없이 null이다(AC-20-6)', async () => {
    const { result } = await setup({ items: [item('i1')] })
    expect(result.current.resetPlan.changes).toEqual([])
    let r: unknown = 'x'
    await act(async () => { r = await result.current.resetRecommended() })
    expect(r).toBeNull()
    expect(m.api.resetItemCycles).not.toHaveBeenCalled()
  })

  it('한 요청으로 주기만 바꾸고 상태에 합치며 개수를 돌려준다(AC-20-2·3, BR-47)', async () => {
    const { result } = await setup({ items: [changed({ name: ' 엔진오일 ' }), item('i2', { name: '직접 추가', intervalKm: 777 })] })
    expect(result.current.resetPlan.changes).toHaveLength(1)
    m.api.resetItemCycles.mockResolvedValue([changed({ name: ' 엔진오일 ', intervalKm: 10000, intervalMonths: 12 })])
    let r: unknown
    await act(async () => { r = await result.current.resetRecommended() })
    expect(r).toEqual({ count: 1, calendarFailed: false })
    expect(m.api.resetItemCycles).toHaveBeenCalledTimes(1)
    expect(m.api.resetItemCycles).toHaveBeenCalledWith([{ id: 'i1', userId: 'user-1', vehicleId: 'v1', name: ' 엔진오일 ', intervalKm: 10000, intervalMonths: 12 }])
    expect(result.current.items.find((i) => i.id === 'i1')).toMatchObject({ intervalKm: 10000, intervalMonths: 12 })
    expect(result.current.items.find((i) => i.id === 'i2')?.intervalKm).toBe(777)
    expect(result.current.resetPlan.changes).toEqual([])
    expect(m.showToast).not.toHaveBeenCalled()
  })

  it('이미 일정이 있고 마지막 교체일이 있는 항목만 일정을 맞추고 새 연결은 만들지 않는다(BR-46)', async () => {
    const items = [changed(), item('i3', { name: '에어컨 필터', intervalMonths: 3, eventId: null }), item('i4', { name: '와이퍼', intervalKm: null, intervalMonths: 6, lastDate: null, eventId: null })]
    const { result } = await setup({ items })
    m.api.resetItemCycles.mockResolvedValue([
      changed({ intervalKm: 10000, intervalMonths: 12 }),
      item('i3', { name: '에어컨 필터', intervalMonths: 6, eventId: null }),
      item('i4', { name: '와이퍼', intervalKm: null, intervalMonths: 12, lastDate: null, eventId: null }),
    ])
    await act(async () => { await result.current.resetRecommended() })
    expect(m.link.syncEvent).toHaveBeenCalledTimes(1)
    expect(m.link.syncEvent.mock.calls[0][0]).toMatchObject({ eventId: 'e1', memo: null })
    expect(m.api.updateItem).not.toHaveBeenCalled()
    expect(m.reload).toHaveBeenCalledTimes(1)
  })

  it('일정 맞추기가 실패하면 그 행만 calendarFailed이고 결과의 calendarFailed가 true다(AC-20-9)', async () => {
    const { result } = await setup({ items: [changed()] })
    m.api.resetItemCycles.mockResolvedValue([changed({ intervalKm: 10000, intervalMonths: 12 })])
    m.link.syncEvent.mockRejectedValue(fail())
    let r: unknown
    await act(async () => { r = await result.current.resetRecommended() })
    expect(r).toEqual({ count: 1, calendarFailed: true })
    expect(result.current.items[0].calendarFailed).toBe(true)
    expect(m.showToast).not.toHaveBeenCalled()
  })

  it('요청이 실패하면 상태 불변·MSG-01·null이다(AC-20-7)', async () => {
    const { result } = await setup({ items: [changed()] })
    m.api.resetItemCycles.mockRejectedValue(fail())
    let r: unknown = 'x'
    await act(async () => { r = await result.current.resetRecommended() })
    expect(r).toBeNull()
    expect(result.current.items[0]).toMatchObject({ intervalKm: 5000, intervalMonths: 6 })
    expect(result.current.resetPlan.changes).toHaveLength(1)
    expect(m.showToast).toHaveBeenCalledWith(expect.objectContaining({ message: MSG_01_SAVE_FAILED }))
  })

  it('진행 중 같은 호출은 요청 1건이고 두 번째는 null이다', async () => {
    const { result } = await setup({ items: [changed()] })
    let release: (v: MaintenanceItem[]) => void = () => {}
    m.api.resetItemCycles.mockReturnValue(new Promise<MaintenanceItem[]>((r) => { release = r }))
    let first!: Promise<unknown>
    let second: unknown = 'x'
    await act(async () => {
      first = result.current.resetRecommended()
      second = await result.current.resetRecommended()
    })
    expect(second).toBeNull()
    await act(async () => { release([changed({ intervalKm: 10000, intervalMonths: 12 })]); await first })
    expect(m.api.resetItemCycles).toHaveBeenCalledTimes(1)
  })
})

describe('미입력 항목과 일정 메모(BR-51~55)', () => {
  it('마지막 교체 주행거리 채우기는 미입력 항목을 대상으로 보지 않는다(AC-24-7, BR-53)', async () => {
    const { result } = await setup({ items: [item('i1', { lastDate: null, lastOdometerKm: null })] })
    expect(result.current.items[0].status).toBe('unset')
    expect(result.current.items[0].basis).toBeNull()
    m.api.updateVehicle = vi.fn().mockResolvedValue(veh('v1', { odometerKm: 50000 }))
    await act(async () => { await result.current.saveVehicle({ name: '차v1', model: null, year: null, plate: null, odometerKm: 50000 }, 'v1') })
    expect(m.api.fillMissingItemOdometer).not.toHaveBeenCalled()
  })

  it('미입력 항목에 처음 날짜를 넣으면 새 id를 선점해 일정이 처음 생긴다(AC-24-3)', async () => {
    const { result } = await setup({ items: [item('i1', { lastDate: null, intervalKm: null })] })
    m.api.updateItem.mockImplementation(async (id: string, input: object, claim?: string) => item(id, { ...input, intervalKm: null, eventId: claim ?? null }))
    let ok = false
    await act(async () => { ok = await result.current.saveItem({ name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: today(), lastOdometerKm: null }, 'i1') })
    expect(ok).toBe(true)
    const claim = m.api.updateItem.mock.calls[0][2] as string
    expect(claim).toBeTruthy()
    expect(m.link.syncEvent.mock.calls[0][0]).toMatchObject({ eventId: claim, memo: null })
  })

  it('km 기준으로 정한 날짜의 일정 메모는 MSG-28이고 개월 기준은 null이다(AC-26-1·2)', async () => {
    const records = [rec('r1', addDays(today(), -60), 47000), rec('r2', today(), 48000)]
    const kmItem = item('i1', { intervalKm: 10000, intervalMonths: null, lastOdometerKm: 40000, eventId: 'e1' })
    const { result } = await setup({ items: [kmItem], records })
    expect(result.current.items[0].basis).toBe('km')
    m.api.updateItem.mockImplementation(async (id: string, input: object) => item(id, { ...input, eventId: 'e1' }))
    await act(async () => { await result.current.saveItem({ name: '엔진오일', intervalKm: 10000, intervalMonths: null, lastDate: addDays(today(), -5), lastOdometerKm: 40000 }, 'i1') })
    expect(m.link.syncEvent.mock.calls[0][0].memo).toBe(MSG_28_KM_BASIS_MEMO)
    m.link.syncEvent.mockClear()
    await act(async () => { await result.current.saveItem({ name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: today(), lastOdometerKm: null }, 'i1') })
    expect(m.link.syncEvent.mock.calls[0][0].memo).toBeNull()
  })
})
