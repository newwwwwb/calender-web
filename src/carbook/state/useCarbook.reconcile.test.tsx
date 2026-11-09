// useCarbook 열 때 점검 테스트: 지운 일정 재생성(AC-08-3), 카테고리 재묶기(AC-08-14·AC-16-6), 직접 만든 일정 제외(AC-16-8), 실패·1회 규칙 (data/*는 모의)
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError } from '../data/request'
import { addMonths, today } from '../domain/dateKey'
import type { CarRecord, DueDate, MaintenanceItem, Vehicle } from '../domain/types'

const m = vi.hoisted(() => ({
  api: {} as Record<string, ReturnType<typeof vi.fn>>, showToast: vi.fn(), reload: vi.fn(),
  link: { ensureCategoryId: vi.fn(), fetchEvents: vi.fn(), syncEvent: vi.fn(), deleteEvent: vi.fn(), rebindCategory: vi.fn() },
}))
vi.mock('../data/carbookApi', () => {
  for (const n of ['listVehicles', 'listItems', 'listDueDates', 'listRecords', 'fillMissingItemOdometer']) m.api[n] = vi.fn()
  return m.api
})
vi.mock('../data/calendarLink', () => ({ createCalendarLink: () => m.link }))
vi.mock('../../state/useCalendar', () => ({ useCalendar: () => ({ reload: m.reload }) }))
vi.mock('../../state/useToast', () => ({ useToast: () => ({ showToast: m.showToast }) }))

import { useCarbook } from './useCarbook'

const veh: Vehicle = { id: 'v1', name: '내 차', model: null, year: null, plate: null, odometerKm: 48000, createdAt: 'a' }
const item = (o: Partial<MaintenanceItem> = {}): MaintenanceItem => ({ id: 'i1', vehicleId: 'v1', name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: today(), lastOdometerKm: null, eventId: 'e1', createdAt: 'a', ...o })
const due = (o: Partial<DueDate> = {}): DueDate => ({ id: 'd1', vehicleId: 'v1', kind: 'insurance', dueDate: '2027-03-10', eventId: 'ed1', createdAt: 'a', ...o })
const ev = (id: string, category_id: string | null = 'cat') => ({ id, title: 't', start_at: '2027-01-01', category_id })
const found = (...events: ReturnType<typeof ev>[]) => new Map(events.map((e) => [e.id, e]))

async function open(items: MaintenanceItem[], dues: DueDate[], events: Map<string, ReturnType<typeof ev>> | Error, records: CarRecord[] | Error = []) {
  m.api.listVehicles.mockResolvedValue([veh]); m.api.listItems.mockResolvedValue(items); m.api.listDueDates.mockResolvedValue(dues)
  if (records instanceof Error) m.api.listRecords.mockRejectedValue(records); else m.api.listRecords.mockResolvedValue(records)
  if (events instanceof Error) m.link.fetchEvents.mockRejectedValue(events); else m.link.fetchEvents.mockResolvedValue(events)
  const hook = renderHook(() => useCarbook('user-1'))
  await waitFor(() => expect(hook.result.current.recordsState).toBe(records instanceof Error ? 'error' : 'ready'))
  return hook
}

beforeEach(() => {
  for (const f of [...Object.values(m.api), m.showToast, m.reload, ...Object.values(m.link)]) f.mockReset()
  m.link.ensureCategoryId.mockResolvedValue('cat'); m.link.syncEvent.mockResolvedValue('written'); m.link.rebindCategory.mockResolvedValue(undefined)
  m.reload.mockResolvedValue(undefined); m.api.fillMissingItemOdometer.mockResolvedValue([])
})

describe('없는 일정 다시 만들기(AC-08-3)', () => {
  it('지워진 항목·만기일 일정을 같은 id·제목·날짜로 만들고 캘린더를 1번 다시 불러온다', async () => {
    await open([item()], [due()], found())
    await waitFor(() => expect(m.link.syncEvent).toHaveBeenCalledTimes(2))
    expect(m.link.fetchEvents).toHaveBeenCalledTimes(1)
    expect(m.link.fetchEvents.mock.calls[0][0]).toEqual(['e1', 'ed1'])
    expect(m.link.syncEvent).toHaveBeenCalledWith({ eventId: 'e1', title: '[내 차] 엔진오일 교체 예정', date: addMonths(today(), 12) }, null)
    expect(m.link.syncEvent).toHaveBeenCalledWith({ eventId: 'ed1', title: '[내 차] 보험 만기', date: '2027-03-10' }, null)
    await waitFor(() => expect(m.reload).toHaveBeenCalledTimes(1))
  })

  it('다음 교체일을 구할 수 없는 항목은 건너뛰고 쓰기·재불러오기가 없다', async () => {
    const { result } = await open([item({ intervalKm: 10000, intervalMonths: null, lastOdometerKm: 40000 })], [], found())
    await waitFor(() => expect(m.link.fetchEvents).toHaveBeenCalledTimes(1))
    expect(m.link.syncEvent).not.toHaveBeenCalled()
    expect(m.reload).not.toHaveBeenCalled()
    expect(result.current.items[0].calendarFailed).toBe(false)
  })

  it('기록을 못 읽은 차량의 km 항목은 만들지 않고, 개월 항목·만기일만 만든다', async () => {
    await open([item({ id: 'k', eventId: 'ek', intervalKm: 10000, intervalMonths: null, lastOdometerKm: 40000 }), item()], [due()], found(), new CarbookError('network'))
    await waitFor(() => expect(m.link.syncEvent).toHaveBeenCalledTimes(2))
    expect(m.link.syncEvent.mock.calls.map((c) => c[0].eventId).sort()).toEqual(['e1', 'ed1'])
  })

  it('기록을 못 읽어 보류한 km 항목은 기록 다시 읽기가 성공한 뒤 일정을 만든다', async () => {
    const km = item({ id: 'k', eventId: 'ek', intervalKm: 10000, intervalMonths: 12, lastOdometerKm: 40000 })
    const { result } = await open([km], [], found(), new CarbookError('network'))
    await waitFor(() => expect(m.link.fetchEvents).toHaveBeenCalledTimes(1))
    expect(m.link.syncEvent).not.toHaveBeenCalled()
    m.api.listRecords.mockResolvedValue([])
    await act(async () => { result.current.retryRecords() })
    await waitFor(() => expect(m.link.syncEvent).toHaveBeenCalledTimes(1))
    expect(m.link.syncEvent.mock.calls[0][0]).toMatchObject({ eventId: 'ek', title: '[내 차] 엔진오일 교체 예정' })
    expect(m.link.syncEvent.mock.calls[0][1]).toBeNull()
  })

  it('일정 만들기가 실패하면 그 행만 calendarFailed이고 토스트는 없다', async () => {
    m.link.syncEvent.mockRejectedValueOnce(new CarbookError('network'))
    const { result } = await open([item()], [due()], found())
    await waitFor(() => expect(result.current.items[0].calendarFailed).toBe(true))
    expect(result.current.dueDates[0].calendarFailed).toBe(false)
    expect(m.showToast).not.toHaveBeenCalled()
  })
})

describe('카테고리 다시 묶기(AC-08-14, AC-16-6·8)', () => {
  it('분류가 없어졌거나 다른 연결 일정만 한 번에 다시 묶고, 맞는 일정은 건드리지 않는다', async () => {
    await open([item(), item({ id: 'i2', eventId: 'e2' })], [due()], found(ev('e1', null), ev('e2', 'other'), ev('ed1', 'cat')))
    await waitFor(() => expect(m.link.rebindCategory).toHaveBeenCalledTimes(1))
    expect(m.link.rebindCategory).toHaveBeenCalledWith(['e1', 'e2'])
    expect(m.link.syncEvent).not.toHaveBeenCalled()
    await waitFor(() => expect(m.reload).toHaveBeenCalledTimes(1))
  })

  it('연결 id가 있는 행의 일정만 조회·재묶기 대상이다(직접 만든 일정 제외)', async () => {
    await open([item(), item({ id: 'i2', eventId: null })], [], found(ev('e1', null), ev('hand-made', null)))
    await waitFor(() => expect(m.link.rebindCategory).toHaveBeenCalledTimes(1))
    expect(m.link.fetchEvents.mock.calls[0][0]).toEqual(['e1'])
    expect(m.link.rebindCategory).toHaveBeenCalledWith(['e1'])
  })

  it('다시 묶기가 실패하면 그 행들이 calendarFailed이고 캘린더는 다시 불러오지 않는다', async () => {
    m.link.rebindCategory.mockRejectedValue(new CarbookError('network'))
    const { result } = await open([item()], [], found(ev('e1', null)))
    await waitFor(() => expect(result.current.items[0].calendarFailed).toBe(true))
    expect(m.reload).not.toHaveBeenCalled()
  })
})

describe('점검 규칙', () => {
  it('모두 맞으면 쓰지도 다시 불러오지도 않는다', async () => {
    await open([item()], [due()], found(ev('e1'), ev('ed1')))
    await waitFor(() => expect(m.link.fetchEvents).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(m.link.rebindCategory).not.toHaveBeenCalled()
    expect(m.link.syncEvent).not.toHaveBeenCalled()
    expect(m.reload).not.toHaveBeenCalled()
  })

  it('연결 일정이 하나도 없으면 조회도 카테고리 보장도 하지 않는다', async () => {
    await open([item({ eventId: null })], [], found())
    await act(async () => {})
    expect(m.link.fetchEvents).not.toHaveBeenCalled()
    expect(m.link.ensureCategoryId).not.toHaveBeenCalled()
  })

  it('일정 조회가 실패하면 연결 행이 calendarFailed이고 토스트는 없다', async () => {
    const { result } = await open([item()], [due()], new CarbookError('network'))
    await waitFor(() => expect(result.current.items[0].calendarFailed).toBe(true))
    expect(result.current.dueDates[0].calendarFailed).toBe(true)
    expect(m.showToast).not.toHaveBeenCalled()
  })

  it('같은 화면 수명에서 행마다 한 번만 점검한다(기록 다시 읽기에도 다시 조회하지 않는다)', async () => {
    const { result } = await open([item()], [due()], found(ev('e1'), ev('ed1')))
    await waitFor(() => expect(m.link.fetchEvents).toHaveBeenCalledTimes(1))
    await act(async () => { result.current.retryRecords() })
    await waitFor(() => expect(result.current.recordsState).toBe('ready'))
    await act(async () => {})
    expect(m.link.fetchEvents).toHaveBeenCalledTimes(1)
  })

  it('점검이 끝나지 않아도 화면 데이터는 이미 그려진다', async () => {
    m.link.fetchEvents.mockReturnValue(new Promise(() => {}))
    const { result } = await open([item()], [due()], found())
    expect(result.current.loadState).toBe('ready')
    expect(result.current.items).toHaveLength(1)
    expect(result.current.dueDates).toHaveLength(1)
  })
})
