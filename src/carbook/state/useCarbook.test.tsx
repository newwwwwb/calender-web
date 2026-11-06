// useCarbook 1단계 테스트: 읽기·차량 선택·차량/기록 쓰기·실패 시 상태 유지·중복 제출 방지 (data/carbookApi와 토스트는 모의)
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError } from '../data/request'
import type { CarRecord, MaintenanceItem, RecordInput, Vehicle, VehicleInput } from '../domain/types'

const m = vi.hoisted(() => ({
  api: {} as Record<string, ReturnType<typeof vi.fn>>, showToast: vi.fn(),
}))
vi.mock('../data/carbookApi', () => {
  for (const n of ['listVehicles', 'listItems', 'listDueDates', 'listRecords', 'createVehicle', 'updateVehicle', 'deleteVehicle', 'createRecord', 'updateRecord', 'deleteRecord', 'createItems', 'fillMissingItemOdometer']) m.api[n] = vi.fn()
  return m.api
})
vi.mock('../../state/useToast', () => ({ useToast: () => ({ showToast: m.showToast }) }))

import { useCarbook } from './useCarbook'

const veh = (id: string, o: Partial<Vehicle> = {}): Vehicle => ({ id, name: id, model: null, year: null, plate: null, odometerKm: null, createdAt: id, ...o })
const rec = (id: string, o: Partial<CarRecord> = {}): CarRecord => ({ id, vehicleId: 'v1', kind: 'other', date: '2026-11-01', amountWon: 1000, odometerKm: null, liters: null, fullTank: false, memo: null, createdAt: id, ...o })
const item = (id: string, o: Partial<MaintenanceItem> = {}): MaintenanceItem => ({ id, vehicleId: 'v1', name: id, intervalKm: 10000, intervalMonths: null, lastDate: '2026-11-05', lastOdometerKm: null, eventId: null, createdAt: id, ...o })
const vInput: VehicleInput = { name: '새차', model: null, year: null, plate: null, odometerKm: 5000 }
const rInput: RecordInput = { kind: 'other', date: '2026-11-05', amountWon: 2000, odometerKm: null, liters: null, fullTank: false, memo: null }
const networkError = () => new CarbookError('network')

async function setup(vehicles = [veh('v1'), veh('v2')], records: CarRecord[] | Error = []) {
  m.api.listVehicles.mockResolvedValue(vehicles)
  m.api.listItems.mockResolvedValue([item('i1')])
  m.api.listDueDates.mockResolvedValue([])
  if (records instanceof Error) m.api.listRecords.mockRejectedValue(records)
  else m.api.listRecords.mockResolvedValue(records)
  const hook = renderHook(() => useCarbook('user-1'))
  await waitFor(() => expect(hook.result.current.loadState).not.toBe('loading'))
  return hook
}

beforeEach(() => {
  for (const f of Object.values(m.api)) f.mockReset()
  m.showToast.mockReset()
})

describe('읽기', () => {
  it('처음 읽으면 가장 먼저 만든 차량이 선택되고 그 차량 기록을 읽는다(AC-03-1)', async () => {
    const { result } = await setup([veh('v1'), veh('v2')], [rec('r1')])
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    expect(result.current.selectedVehicleId).toBe('v1')
    expect(m.api.listRecords).toHaveBeenCalledWith('v1')
    expect(result.current.records.map((r) => r.id)).toEqual(['r1'])
    expect(result.current.items.map((i) => i.id)).toEqual(['i1'])
  })

  it('차량을 바꾸면 그 차량의 기록·교체 항목만 보인다', async () => {
    const { result } = await setup()
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    m.api.listRecords.mockResolvedValue([rec('r9', { vehicleId: 'v2' })])
    act(() => result.current.selectVehicle('v2'))
    await waitFor(() => expect(result.current.records.map((r) => r.id)).toEqual(['r9']))
    expect(result.current.items).toEqual([])
  })

  it('읽기가 실패하면 error이고 retryLoad로 다시 읽는다(AC-10-7)', async () => {
    m.api.listVehicles.mockRejectedValue(networkError())
    m.api.listItems.mockResolvedValue([]); m.api.listDueDates.mockResolvedValue([])
    const { result } = renderHook(() => useCarbook('user-1'))
    await waitFor(() => expect(result.current.loadState).toBe('error'))
    m.api.listVehicles.mockResolvedValue([veh('v1')]); m.api.listRecords.mockResolvedValue([])
    act(() => result.current.retryLoad())
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
  })

  it('기록 읽기만 실패하면 recordsState만 error이고 retryRecords로 다시 읽는다', async () => {
    const { result } = await setup([veh('v1'), veh('v2')], networkError())
    await waitFor(() => expect(result.current.recordsState).toBe('error'))
    expect(result.current.loadState).toBe('ready')
    m.api.listRecords.mockResolvedValue([rec('r1')])
    act(() => result.current.retryRecords())
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    expect(result.current.records).toHaveLength(1)
  })
})

describe('차량 쓰기', () => {
  it('추가하면 추천 7행을 만들고 그 차량을 선택한다', async () => {
    const { result } = await setup()
    m.api.createVehicle.mockImplementation(async (id: string, i: VehicleInput) => veh(id, i))
    m.api.createItems.mockImplementation(async (vid: string, rows: { id: string }[]) => rows.map((r) => item(r.id, { vehicleId: vid })))
    m.api.listRecords.mockResolvedValue([])
    let ok = false
    await act(async () => { ok = await result.current.saveVehicle(vInput) })
    expect(ok).toBe(true)
    const [vid, rows] = m.api.createItems.mock.calls[0]
    expect(rows).toHaveLength(7)
    expect(rows[0]).toMatchObject({ name: '엔진오일', lastOdometerKm: 5000, eventId: null })
    expect(result.current.selectedVehicleId).toBe(vid)
    expect(result.current.vehicles).toHaveLength(3)
  })

  it('저장 실패는 false+MSG-01이고 목록은 그대로다(AC-03-4)', async () => {
    const { result } = await setup()
    m.api.createVehicle.mockRejectedValue(networkError())
    let ok = true
    await act(async () => { ok = await result.current.saveVehicle(vInput) })
    expect(ok).toBe(false)
    expect(m.showToast).toHaveBeenCalledWith({ message: '저장하지 못했습니다. 다시 시도해 주세요', tone: 'error' })
    expect(result.current.vehicles).toHaveLength(2)
  })

  it('추천 항목 저장이 실패하면 방금 만든 차량을 지우고 false다', async () => {
    const { result } = await setup()
    m.api.createVehicle.mockImplementation(async (id: string, i: VehicleInput) => veh(id, i))
    m.api.createItems.mockRejectedValue(networkError())
    m.api.deleteVehicle.mockRejectedValue(networkError()) // 보상도 실패해도 삼킨다
    let ok = true
    await act(async () => { ok = await result.current.saveVehicle(vInput) })
    expect(ok).toBe(false)
    expect(m.api.deleteVehicle).toHaveBeenCalledWith(m.api.createVehicle.mock.calls[0][0])
    expect(result.current.vehicles).toHaveLength(2)
  })

  it('선택 차량을 지우면 남은 차량 중 처음 것이 선택되고, 모두 지우면 null이다(AC-03-7)', async () => {
    const { result } = await setup()
    m.api.deleteVehicle.mockResolvedValue(undefined)
    await act(async () => { await result.current.deleteVehicle('v1') })
    expect(result.current.selectedVehicleId).toBe('v2')
    await act(async () => { await result.current.deleteVehicle('v2') })
    expect(result.current.selectedVehicleId).toBeNull()
  })

  it('삭제 실패는 MSG-03이고 차량이 남는다(AC-10-8)', async () => {
    const { result } = await setup()
    m.api.deleteVehicle.mockRejectedValue(networkError())
    await act(async () => { expect(await result.current.deleteVehicle('v1')).toBe(false) })
    expect(m.showToast).toHaveBeenCalledWith({ message: '삭제하지 못했습니다. 다시 시도해 주세요', tone: 'error' })
    expect(result.current.vehicles).toHaveLength(2)
  })
})

describe('기록 쓰기', () => {
  it('추가하면 응답 행으로 바로 목록이 바뀐다(다시 읽기 없음, AC-04-1·10)', async () => {
    const { result } = await setup([veh('v1')], [rec('r1', { date: '2026-11-01' })])
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    m.api.createRecord.mockImplementation(async (id: string, vid: string, i: RecordInput) => rec(id, { ...i, vehicleId: vid }))
    await act(async () => { expect(await result.current.saveRecord(rInput)).toBe(true) })
    expect(result.current.records.map((r) => r.date)).toEqual(['2026-11-05', '2026-11-01'])
    expect(m.api.listRecords).toHaveBeenCalledTimes(1)
  })

  it('수정하면 같은 id의 행이 바뀐다(AC-04-2)', async () => {
    const { result } = await setup([veh('v1')], [rec('r1')])
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    m.api.updateRecord.mockResolvedValue(rec('r1', { amountWon: 7777 }))
    await act(async () => { await result.current.saveRecord({ ...rInput, amountWon: 7777 }, 'r1') })
    expect(result.current.records).toHaveLength(1)
    expect(result.current.records[0].amountWon).toBe(7777)
  })

  it('저장 실패는 false+MSG-01이고 목록 불변(AC-04-7, AC-10-1)', async () => {
    const { result } = await setup([veh('v1')], [rec('r1')])
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    m.api.createRecord.mockRejectedValue(networkError())
    await act(async () => { expect(await result.current.saveRecord(rInput)).toBe(false) })
    expect(m.showToast).toHaveBeenCalledTimes(1)
    expect(result.current.records).toHaveLength(1)
  })

  it('저장 중 같은 대상을 다시 저장하면 요청 1건이고 두 번째는 false(AC-10-2)', async () => {
    const { result } = await setup([veh('v1')])
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    let release!: (r: CarRecord) => void
    m.api.createRecord.mockReturnValue(new Promise<CarRecord>((res) => { release = res }))
    let first!: Promise<boolean>
    let second = true
    await act(async () => {
      first = result.current.saveRecord(rInput)
      second = await result.current.saveRecord(rInput)
    })
    expect(second).toBe(false)
    expect(m.api.createRecord).toHaveBeenCalledTimes(1)
    expect(m.showToast).not.toHaveBeenCalled()
    await act(async () => { release(rec('r1')); await first })
  })

  it('첫 주행거리가 적힌 기록을 저장하면 빈 교체 항목을 채운다(AC-06-15)', async () => {
    const { result } = await setup([veh('v1')])
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    m.api.createRecord.mockImplementation(async (id: string, vid: string, i: RecordInput) => rec(id, { ...i, vehicleId: vid }))
    m.api.fillMissingItemOdometer.mockResolvedValue([item('i1', { lastOdometerKm: 48000 })])
    await act(async () => { await result.current.saveRecord({ ...rInput, odometerKm: 48000 }) })
    expect(m.api.fillMissingItemOdometer).toHaveBeenCalledWith('v1', 48000)
    expect(result.current.items[0]).toMatchObject({ lastOdometerKm: 48000, remainingKm: 10000, status: 'ok' })
  })

  it('이미 주행거리가 있으면 채우기를 부르지 않는다', async () => {
    const { result } = await setup([veh('v1', { odometerKm: 100 })])
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    m.api.createRecord.mockImplementation(async (id: string, vid: string, i: RecordInput) => rec(id, { ...i, vehicleId: vid }))
    await act(async () => { await result.current.saveRecord({ ...rInput, odometerKm: 200 }) })
    expect(m.api.fillMissingItemOdometer).not.toHaveBeenCalled()
  })

  it('삭제 실패는 MSG-03이고 기록이 남는다', async () => {
    const { result } = await setup([veh('v1')], [rec('r1')])
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    m.api.deleteRecord.mockRejectedValue(networkError())
    await act(async () => { expect(await result.current.deleteRecord('r1')).toBe(false) })
    expect(result.current.records).toHaveLength(1)
    m.api.deleteRecord.mockResolvedValue(undefined)
    await act(async () => { await result.current.deleteRecord('r1') })
    expect(result.current.records).toHaveLength(0)
  })
})
