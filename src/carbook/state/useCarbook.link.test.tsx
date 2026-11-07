// useCarbook 캘린더 연동 테스트: 항목·만기일 쓰기와 일정 생성/수정(AC-08-1·2·5·6·8·9·15), 삭제 순서(AC-08-7, AC-03-6·8), 선점 결과 사용, 재시도 (data/*는 모의)
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError } from '../data/request'
import { addDays, addMonths, today } from '../domain/dateKey'
import type { CarRecord, DueDate, ItemInput, MaintenanceItem, Vehicle } from '../domain/types'

const m = vi.hoisted(() => ({
  api: {} as Record<string, ReturnType<typeof vi.fn>>, showToast: vi.fn(), reload: vi.fn(),
  link: { ensureCategoryId: vi.fn(), fetchEvents: vi.fn(), syncEvent: vi.fn(), deleteEvent: vi.fn(), rebindCategory: vi.fn() },
}))
vi.mock('../data/carbookApi', () => {
  for (const n of ['listVehicles', 'listItems', 'listDueDates', 'listRecords', 'deleteVehicle', 'createRecord', 'deleteRecord', 'updateVehicle', 'createItems', 'updateItem', 'deleteItem', 'createDueDate', 'updateDueDate', 'deleteDueDate', 'clearEventId', 'fillMissingItemOdometer']) m.api[n] = vi.fn()
  return m.api
})
vi.mock('../data/calendarLink', () => ({ createCalendarLink: () => m.link }))
vi.mock('../../state/useCalendar', () => ({ useCalendar: () => ({ reload: m.reload }) }))
vi.mock('../../state/useToast', () => ({ useToast: () => ({ showToast: m.showToast }) }))

import { useCarbook } from './useCarbook'

const veh: Vehicle = { id: 'v1', name: '내 차', model: null, year: null, plate: '12가3456', odometerKm: 48000, createdAt: 'a' }
const item = (o: Partial<MaintenanceItem> = {}): MaintenanceItem => ({ id: 'i1', vehicleId: 'v1', name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: today(), lastOdometerKm: null, eventId: 'e1', createdAt: 'a', ...o })
const due = (o: Partial<DueDate> = {}): DueDate => ({ id: 'd1', vehicleId: 'v1', kind: 'insurance', dueDate: '2027-03-10', eventId: 'ed1', createdAt: 'a', ...o })
const rec = (id: string, date: string, odometerKm: number): CarRecord => ({ id, vehicleId: 'v1', kind: 'other', date, amountWon: 1, odometerKm, liters: null, fullTank: false, memo: null, createdAt: id })
const input: ItemInput = { name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: today(), lastOdometerKm: null }
const fail = () => new CarbookError('network')
const nextYear = () => addMonths(today(), 12)

async function setup(items: MaintenanceItem[] = [], dues: DueDate[] = [], records: CarRecord[] = []) {
  m.api.listVehicles.mockResolvedValue([veh]); m.api.listItems.mockResolvedValue(items)
  m.api.listDueDates.mockResolvedValue(dues); m.api.listRecords.mockResolvedValue(records)
  const hook = renderHook(() => useCarbook('user-1'))
  await waitFor(() => expect(hook.result.current.recordsState).toBe('ready'))
  return hook
}

beforeEach(() => {
  for (const f of [...Object.values(m.api), m.showToast, m.reload, ...Object.values(m.link)]) f.mockReset()
  m.link.syncEvent.mockResolvedValue('written'); m.link.deleteEvent.mockResolvedValue(true)
  m.link.fetchEvents.mockResolvedValue(new Map()); m.reload.mockResolvedValue(undefined)
  m.api.fillMissingItemOdometer.mockResolvedValue([])
})

describe('교체 항목', () => {
  it('새 항목은 연결 id와 함께 저장하고 일정을 만든 뒤 캘린더를 1번 다시 불러온다(AC-08-1·10)', async () => {
    const { result } = await setup()
    m.api.createItems.mockImplementation(async (_v: string, rows: { id: string; eventId: string }[]) => [item({ id: rows[0].id, eventId: rows[0].eventId })])
    await act(async () => { expect(await result.current.saveItem(input)).toBe(true) })
    const [, rows] = m.api.createItems.mock.calls[0]
    expect(m.link.syncEvent).toHaveBeenCalledWith({ eventId: rows[0].eventId, title: '[내 차] 엔진오일 교체 예정', date: nextYear() }, null)
    expect(JSON.stringify(m.link.syncEvent.mock.calls)).not.toContain('12가3456')
    expect(m.reload).toHaveBeenCalledTimes(1)
  })

  it('다음 교체일을 구할 수 없으면 일정을 만들지 않는다(AC-08-8)', async () => {
    const { result } = await setup()
    m.api.createItems.mockResolvedValue([item({ intervalKm: 10000, intervalMonths: null, lastOdometerKm: 40000 })])
    await act(async () => { await result.current.saveItem({ ...input, intervalKm: 10000, intervalMonths: null, lastOdometerKm: 40000 }) })
    expect(m.link.syncEvent).not.toHaveBeenCalled()
    expect(m.link.deleteEvent).not.toHaveBeenCalled()
    expect(m.reload).not.toHaveBeenCalled()
  })

  it('연결 id가 없던 항목은 새 id를 선점하고, 돌려받은 행의 event_id로 일정을 쓴다', async () => {
    const { result } = await setup([item({ eventId: null })])
    m.api.updateItem.mockResolvedValue(item({ eventId: 'winner' }))
    await act(async () => { await result.current.saveItem(input, 'i1') })
    expect(typeof m.api.updateItem.mock.calls[0][2]).toBe('string')
    expect(m.link.syncEvent.mock.calls[0][0].eventId).toBe('winner')
  })

  it('돌려받은 event_id가 null이면 캘린더를 건드리지 않고 저장은 성공이다', async () => {
    const { result } = await setup([item()])
    m.api.updateItem.mockResolvedValue(item({ eventId: null }))
    await act(async () => { expect(await result.current.saveItem(input, 'i1')).toBe(true) })
    expect(m.link.syncEvent).not.toHaveBeenCalled()
    expect(m.link.deleteEvent).not.toHaveBeenCalled()
  })

  it('일정 쓰기가 실패해도 저장은 true·토스트 없음이고 버튼 상태가 켜지며, 두 번 재시도해도 같은 id다(AC-08-5·6)', async () => {
    const { result } = await setup([item()])
    m.api.updateItem.mockResolvedValue(item())
    m.link.syncEvent.mockRejectedValueOnce(fail())
    await act(async () => { expect(await result.current.saveItem(input, 'i1')).toBe(true) })
    expect(m.showToast).not.toHaveBeenCalled()
    expect(result.current.items[0].calendarFailed).toBe(true)
    await act(async () => { await result.current.retryCalendar({ type: 'item', id: 'i1' }); await result.current.retryCalendar({ type: 'item', id: 'i1' }) })
    expect(result.current.items[0].calendarFailed).toBe(false)
    expect(m.link.syncEvent.mock.calls.slice(1).map((c) => c[0].eventId)).toEqual(['e1', 'e1'])
  })

  it('항목 저장 자체가 실패하면 MSG-01·false이고 일정은 건드리지 않는다', async () => {
    const { result } = await setup([item()])
    m.api.updateItem.mockRejectedValue(fail())
    await act(async () => { expect(await result.current.saveItem(input, 'i1')).toBe(false) })
    expect(m.showToast).toHaveBeenCalledTimes(1)
    expect(m.link.syncEvent).not.toHaveBeenCalled()
  })

  it('교체 완료는 날짜·주행거리를 바꿔 저장하고 일정을 맞춘다(AC-06-10)', async () => {
    const { result } = await setup([item()])
    m.api.updateItem.mockResolvedValue(item({ lastDate: today() }))
    await act(async () => { await result.current.completeItem('i1', { date: today(), odometerKm: 48000 }) })
    expect(m.api.updateItem.mock.calls[0][1]).toMatchObject({ name: '엔진오일', lastDate: today(), lastOdometerKm: 48000 })
    expect(m.api.updateItem.mock.calls[0][2]).toBeUndefined() // 이미 연결 id가 있으면 선점 id를 보내지 않는다
    expect(m.link.syncEvent).toHaveBeenCalledTimes(1)
  })

  it('삭제는 일정을 먼저 지우고 성공하면 행을 지운다(AC-08-7)', async () => {
    const { result } = await setup([item()])
    m.api.deleteItem.mockResolvedValue(undefined)
    await act(async () => { expect(await result.current.deleteItem('i1')).toBe(true) })
    expect(m.link.deleteEvent.mock.invocationCallOrder[0]).toBeLessThan(m.api.deleteItem.mock.invocationCallOrder[0])
    expect(result.current.items).toEqual([])
  })

  it('일정 삭제가 실패하면 행이 남고 MSG-03이다(AC-08-7)', async () => {
    const { result } = await setup([item()])
    m.link.deleteEvent.mockRejectedValue(fail())
    await act(async () => { expect(await result.current.deleteItem('i1')).toBe(false) })
    expect(m.api.deleteItem).not.toHaveBeenCalled()
    expect(result.current.items).toHaveLength(1)
    expect(m.showToast).toHaveBeenCalledWith({ message: '삭제하지 못했습니다. 다시 시도해 주세요', tone: 'error' })
  })
})

describe('만기일', () => {
  it('없던 종류는 추가하고 일정을 만든다(AC-07-1, AC-08-2)', async () => {
    const { result } = await setup()
    m.api.createDueDate.mockImplementation(async (r: { id: string; eventId: string; dueDate: string }) => due({ id: r.id, eventId: r.eventId, dueDate: r.dueDate }))
    await act(async () => { expect(await result.current.saveDueDate('insurance', '2027-03-10')).toBe(true) })
    expect(m.link.syncEvent.mock.calls[0][0]).toMatchObject({ title: '[내 차] 보험 만기', date: '2027-03-10' })
    expect(result.current.dueDates).toHaveLength(1)
  })

  it('있던 종류는 수정하고 일정 날짜를 바꾼다(AC-07-2, AC-08-2)', async () => {
    const { result } = await setup([], [due()])
    m.api.updateDueDate.mockResolvedValue(due({ dueDate: '2027-04-01' }))
    await act(async () => { await result.current.saveDueDate('insurance', '2027-04-01') })
    expect(m.api.createDueDate).not.toHaveBeenCalled()
    expect(m.link.syncEvent.mock.calls[0][0]).toMatchObject({ eventId: 'ed1', date: '2027-04-01' })
  })

  it('두 탭 동시 첫 저장의 23505는 목록을 다시 읽고 MSG-01이다', async () => {
    const { result } = await setup()
    m.api.createDueDate.mockRejectedValue(new CarbookError('conflict', '23505'))
    m.api.listDueDates.mockResolvedValue([due()])
    await act(async () => { expect(await result.current.saveDueDate('insurance', '2027-03-10')).toBe(false) })
    await waitFor(() => expect(result.current.dueDates).toHaveLength(1))
    expect(m.showToast).toHaveBeenCalledTimes(1)
  })

  it('삭제하면 일정이 먼저 사라지고 행이 지워진다(AC-08-2)', async () => {
    const { result } = await setup([], [due()])
    m.api.deleteDueDate.mockResolvedValue(undefined)
    await act(async () => { await result.current.deleteDueDate('insurance') })
    expect(m.link.deleteEvent).toHaveBeenCalledWith('ed1')
    expect(result.current.dueDates).toEqual([])
  })
})

describe('기록·차량 변경에 따른 동기화', () => {
  const kmItem = item({ intervalKm: 10000, intervalMonths: null, lastOdometerKm: 40000 })
  const recs = [rec('r1', addDays(today(), -30), 47000), rec('r2', today(), 48000)]
  const existing = (title: string, date: string) => new Map([['e1', { id: 'e1', title, start_at: date, category_id: 'c' }]])

  it('기록 저장으로 다음 교체일이 바뀌면 일정을 고친다(AC-08-9)', async () => {
    const { result } = await setup([kmItem], [], recs)
    m.link.fetchEvents.mockResolvedValue(existing('[내 차] 엔진오일 교체 예정', '2099-01-01'))
    m.api.createRecord.mockImplementation(async (id: string, vid: string, i: object) => ({ ...rec(id, today(), 49000), ...i, vehicleId: vid }))
    await act(async () => { await result.current.saveRecord({ kind: 'other', date: today(), amountWon: 1, odometerKm: 49000, liters: null, fullTank: false, memo: null }) })
    expect(m.link.fetchEvents).toHaveBeenCalledWith(['e1'])
    expect(m.link.syncEvent.mock.calls[0][0]).toMatchObject({ eventId: 'e1', title: '[내 차] 엔진오일 교체 예정' })
    expect(m.reload).toHaveBeenCalledTimes(1)
  })

  it('기록을 지워 계산할 수 없게 되면 일정만 삭제하고 연결 id·MSG-11 상태는 유지하지 않는다(AC-08-15)', async () => {
    const { result } = await setup([kmItem], [], recs)
    m.link.fetchEvents.mockResolvedValue(existing('[내 차] 엔진오일 교체 예정', '2099-01-01'))
    m.api.deleteRecord.mockResolvedValue(undefined)
    await act(async () => { await result.current.deleteRecord('r2') })
    expect(m.link.syncEvent).not.toHaveBeenCalled()
    expect(m.link.deleteEvent).toHaveBeenCalledWith('e1')
    expect(result.current.items[0]).toMatchObject({ eventId: 'e1', nextDate: null, calendarFailed: false })
  })

  it('이미 같은 일정이면 쓰지 않고 캘린더를 다시 불러오지도 않는다', async () => {
    const { result } = await setup([item()], [])
    m.link.fetchEvents.mockResolvedValue(existing('x', 'y'))
    m.link.syncEvent.mockResolvedValue('unchanged')
    m.api.deleteRecord.mockResolvedValue(undefined)
    await act(async () => { await result.current.deleteRecord('none') })
    expect(m.reload).not.toHaveBeenCalled()
  })

  it('차량 별칭을 바꾸면 연결 일정 제목이 새 별칭이 된다(AC-03-5)', async () => {
    const { result } = await setup([item()])
    m.api.updateVehicle.mockResolvedValue({ ...veh, name: '출근차' })
    await act(async () => { await result.current.saveVehicle({ name: '출근차', model: null, year: null, plate: veh.plate, odometerKm: 48000 }, 'v1') })
    expect(m.link.syncEvent.mock.calls[0][0].title).toBe('[출근차] 엔진오일 교체 예정')
  })
})

describe('차량 삭제', () => {
  it('연결 일정을 하나씩 지우고 event_id를 비운 뒤 차량을 지운다(AC-03-6)', async () => {
    const { result } = await setup([item()], [due()])
    m.api.clearEventId.mockResolvedValue(undefined); m.api.deleteVehicle.mockResolvedValue(undefined)
    await act(async () => { expect(await result.current.deleteVehicle('v1')).toBe(true) })
    expect(m.link.deleteEvent.mock.calls.map((c) => c[0])).toEqual(['e1', 'ed1'])
    expect(m.api.clearEventId.mock.calls).toEqual([['item', 'i1'], ['due', 'd1']])
    expect(result.current.vehicles).toEqual([])
    expect(m.reload).toHaveBeenCalledTimes(1)
  })

  it('두 번째 일정 삭제가 실패하면 멈추고 MSG-03, 첫 연결만 비워진다(AC-03-8)', async () => {
    const { result } = await setup([item()], [due()])
    m.api.clearEventId.mockResolvedValue(undefined)
    m.link.deleteEvent.mockResolvedValueOnce(true).mockRejectedValueOnce(fail())
    await act(async () => { expect(await result.current.deleteVehicle('v1')).toBe(false) })
    expect(m.api.deleteVehicle).not.toHaveBeenCalled()
    expect(m.api.clearEventId.mock.calls).toEqual([['item', 'i1']])
    expect(result.current.vehicles).toHaveLength(1)
    expect(result.current.items[0].eventId).toBeNull()
    expect(result.current.dueDates[0].eventId).toBe('ed1')
    expect(m.showToast).toHaveBeenCalledWith({ message: '삭제하지 못했습니다. 다시 시도해 주세요', tone: 'error' })
  })
})
