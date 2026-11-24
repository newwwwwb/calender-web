// useCarbook 인증 만료(AC-27-4·6·10)와 저장 성공 안내 MSG-31·32(AC-28-1~8) 테스트 (data/*는 모의)
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError } from '../data/request'
import { today } from '../domain/dateKey'
import { MSG_03_DELETE_FAILED, MSG_31_EVENT_SAVED, MSG_32_SAVED } from '../domain/messages'
import type { DueDate, MaintenanceItem, RecordInput, Vehicle } from '../domain/types'

const m = vi.hoisted(() => ({
  api: {} as Record<string, ReturnType<typeof vi.fn>>, showToast: vi.fn(), reload: vi.fn(),
  link: { ensureCategoryId: vi.fn(), fetchEvents: vi.fn(), syncEvent: vi.fn(), deleteEvent: vi.fn(), rebindCategory: vi.fn() },
}))
vi.mock('../data/carbookApi', () => {
  for (const n of ['listVehicles', 'listItems', 'listDueDates', 'listRecords', 'getSettings', 'setDefaultVehicle', 'resetItemCycles', 'createRecord', 'deleteRecord', 'updateVehicle', 'updateItem', 'deleteItem', 'createDueDate', 'updateDueDate', 'fillMissingItemOdometer']) m.api[n] = vi.fn()
  return m.api
})
vi.mock('../data/calendarLink', () => ({ createCalendarLink: () => m.link }))
vi.mock('../../state/useCalendar', () => ({ useCalendar: () => ({ reload: m.reload }) }))
vi.mock('../../state/useToast', () => ({ useToast: () => ({ showToast: m.showToast }) }))

import { useCarbook } from './useCarbook'

const veh: Vehicle = { id: 'v1', name: '내 차', model: null, year: null, plate: null, odometerKm: 48000, createdAt: 'a' }
const item = (o: Partial<MaintenanceItem> = {}): MaintenanceItem => ({ id: 'i1', vehicleId: 'v1', name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: today(), lastOdometerKm: null, eventId: 'e1', createdAt: 'a', ...o })
const due = (o: Partial<DueDate> = {}): DueDate => ({ id: 'd1', vehicleId: 'v1', kind: 'insurance', dueDate: '2027-03-10', eventId: 'ed1', createdAt: 'a', ...o })
const rInput: RecordInput = { kind: 'other', date: '2026-11-05', amountWon: 2000, odometerKm: null, liters: null, fullTank: false, memo: null }
const iInput = { name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: '2026-11-10', lastOdometerKm: null }
const expired = () => new CarbookError('auth', 'PGRST301')
const network = () => new CarbookError('network')

async function setup(items: MaintenanceItem[] = [item()], dues: DueDate[] = []) {
  m.api.listVehicles.mockResolvedValue([veh]); m.api.listItems.mockResolvedValue(items); m.api.listDueDates.mockResolvedValue(dues)
  m.api.listRecords.mockResolvedValue([]); m.api.getSettings.mockResolvedValue({ defaultVehicleId: null })
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

describe('인증 만료(401)', () => {
  it('기록 저장이 401이면 false·토스트 없음·authExpired이고 상태는 그대로다(AC-27-4)', async () => {
    const { result } = await setup()
    m.api.createRecord.mockRejectedValue(expired())
    let ok = true
    await act(async () => { ok = await result.current.saveRecord(rInput) })
    expect(ok).toBe(false)
    expect(result.current.authExpired).toBe(true)
    expect(m.showToast).not.toHaveBeenCalled()
    expect(result.current.records).toEqual([])
  })

  it('삭제·교체 완료·되돌리기·기본 차량 지정도 401이면 같다(AC-27-4)', async () => {
    const { result } = await setup([item({ intervalKm: 5000, intervalMonths: 6 })])
    m.api.deleteRecord.mockRejectedValue(expired()); m.api.updateItem.mockRejectedValue(expired())
    m.api.resetItemCycles.mockRejectedValue(expired()); m.api.setDefaultVehicle.mockRejectedValue(expired())
    const out: unknown[] = []
    await act(async () => {
      out.push(await result.current.deleteRecord('r1'))
      out.push(await result.current.completeItem('i1', { date: '2026-11-10', odometerKm: null }))
      out.push(await result.current.resetRecommended())
      out.push(await result.current.setDefaultVehicle('v1'))
    })
    expect(out).toEqual([false, false, null, false])
    expect(result.current.authExpired).toBe(true)
    expect(m.showToast).not.toHaveBeenCalled()
    expect(result.current.defaultVehicleId).toBeNull()
    expect(result.current.items[0]).toMatchObject({ intervalKm: 5000, lastDate: today() })
  })

  it('dismissAuthExpired로 내리고, 같은 화면의 성공 쓰기가 자동으로 내리지는 않는다(AC-27-6)', async () => {
    const { result } = await setup()
    m.api.createRecord.mockRejectedValueOnce(expired())
    await act(async () => { await result.current.saveRecord(rInput) })
    expect(result.current.authExpired).toBe(true)
    m.api.createRecord.mockResolvedValue({ id: 'r1', vehicleId: 'v1', ...rInput, createdAt: 'x' })
    await act(async () => { await result.current.saveRecord(rInput) })
    expect(result.current.authExpired).toBe(true)
    act(() => result.current.dismissAuthExpired())
    expect(result.current.authExpired).toBe(false)
  })

  it('401이 아닌 실패는 토스트이고 authExpired가 아니다(403·42501 포함)', async () => {
    const { result } = await setup()
    m.api.createRecord.mockRejectedValue(new CarbookError('unknown', '42501'))
    await act(async () => { await result.current.saveRecord(rInput) })
    expect(result.current.authExpired).toBe(false)
    expect(m.showToast).toHaveBeenCalledTimes(1)
  })

  it('일정 쓰기가 401이면 행 저장은 성공이고 calendarFailed이며 authExpired가 아니다(AC-27-10)', async () => {
    const { result } = await setup()
    m.api.updateItem.mockResolvedValue(item({ lastDate: '2026-11-10' }))
    m.link.syncEvent.mockRejectedValue(expired())
    let ok = false
    await act(async () => { ok = await result.current.saveItem(iInput, 'i1') })
    expect(ok).toBe(true)
    expect(result.current.authExpired).toBe(false)
    expect(result.current.items[0].calendarFailed).toBe(true)
  })

  it('삭제 중 일정 삭제가 401이면 만료 안내가 아니라 삭제 실패 MSG-03이고 행이 남는다', async () => {
    const { result } = await setup()
    m.link.deleteEvent.mockRejectedValue(expired())
    let ok = true
    await act(async () => { ok = await result.current.deleteItem('i1') })
    expect(ok).toBe(false)
    expect(result.current.authExpired).toBe(false)
    expect(m.showToast).toHaveBeenCalledWith(expect.objectContaining({ message: MSG_03_DELETE_FAILED }))
    expect(m.api.deleteItem).not.toHaveBeenCalled()
  })
})

describe('저장 성공 안내(BR-59, VQ-12)', () => {
  it('항목 저장에서 일정을 새로 썼으면 MSG-31에 일정 날짜가 들어간다(AC-28-1)', async () => {
    const { result } = await setup()
    m.api.updateItem.mockResolvedValue(item({ lastDate: '2026-11-10' }))
    await act(async () => { await result.current.saveItem(iInput, 'i1') })
    expect(m.showToast).toHaveBeenCalledTimes(1)
    expect(m.showToast).toHaveBeenCalledWith({ message: MSG_31_EVENT_SAVED('2027-11-10') })
  })

  it('교체 완료도 같은 안내이고, 일정이 이미 같으면(unchanged) MSG-32다(AC-28-2·3)', async () => {
    const { result } = await setup()
    m.api.updateItem.mockResolvedValue(item({ lastDate: '2026-11-10' }))
    await act(async () => { await result.current.completeItem('i1', { date: '2026-11-10', odometerKm: null }) })
    expect(m.showToast).toHaveBeenLastCalledWith({ message: MSG_31_EVENT_SAVED('2027-11-10') })
    m.link.syncEvent.mockResolvedValue('unchanged')
    await act(async () => { await result.current.saveItem(iInput, 'i1') })
    expect(m.showToast).toHaveBeenLastCalledWith({ message: MSG_32_SAVED })
  })

  it('연결 일정이 없거나 날짜를 계산할 수 없거나 일정이 실패하면 MSG-32다(AC-28-4·5)', async () => {
    const { result } = await setup()
    m.api.updateItem.mockResolvedValue(item({ eventId: null }))
    await act(async () => { await result.current.saveItem(iInput, 'i1') })
    expect(m.showToast).toHaveBeenLastCalledWith({ message: MSG_32_SAVED })
    m.api.updateItem.mockResolvedValue(item({ lastDate: '2026-11-10' }))
    m.link.syncEvent.mockRejectedValue(network())
    await act(async () => { await result.current.saveItem(iInput, 'i1') })
    expect(m.showToast).toHaveBeenLastCalledWith({ message: MSG_32_SAVED })
    expect(m.showToast).toHaveBeenCalledTimes(2)
  })

  it('만기일 저장도 MSG-31에 만기일이 들어가고, 저장이 실패하면 성공 안내가 없다(AC-28-6)', async () => {
    const { result } = await setup([], [due()])
    m.api.updateDueDate.mockResolvedValue(due({ dueDate: '2027-04-01' }))
    await act(async () => { await result.current.saveDueDate('insurance', '2027-04-01') })
    expect(m.showToast).toHaveBeenCalledWith({ message: MSG_31_EVENT_SAVED('2027-04-01') })
    m.showToast.mockClear()
    m.api.updateDueDate.mockRejectedValue(network())
    await act(async () => { await result.current.saveDueDate('insurance', '2027-05-01') })
    expect(m.showToast).toHaveBeenCalledTimes(1)
    expect(m.showToast).not.toHaveBeenCalledWith({ message: MSG_32_SAVED })
  })

  it('기록 저장·삭제, 차량 저장, 되돌리기, 기본 차량 지정은 성공 안내가 없다(AC-28-7·8)', async () => {
    const { result } = await setup([item({ intervalKm: 5000, intervalMonths: 6 })])
    m.api.createRecord.mockResolvedValue({ id: 'r1', vehicleId: 'v1', ...rInput, createdAt: 'x' }); m.api.deleteRecord.mockResolvedValue(undefined)
    m.api.updateVehicle.mockResolvedValue(veh); m.api.setDefaultVehicle.mockResolvedValue({ defaultVehicleId: 'v1' })
    m.api.resetItemCycles.mockResolvedValue([item({ intervalKm: 10000, intervalMonths: 12 })])
    await act(async () => {
      await result.current.saveRecord(rInput)
      await result.current.deleteRecord('r1')
      await result.current.saveVehicle({ name: '내 차', model: null, year: null, plate: null, odometerKm: 48000 }, 'v1')
      await result.current.resetRecommended()
      await result.current.setDefaultVehicle('v1')
    })
    expect(m.showToast).not.toHaveBeenCalled()
  })
})
