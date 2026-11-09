// MPR-26 QA 임시 스크립트: useCarbook을 상태를 가진 가짜 백엔드(data/carbookApi 대체, 실패·지연 조절 가능)에 물려 AC-03·04·06-15·10 항목을 정상·경계·실패로 확인한다(npm test 미포함).
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError } from '../../../src/carbook/data/request'
import type { CarRecord, DueDate, MaintenanceItem, RecordInput, RecordKind, Vehicle, VehicleInput } from '../../../src/carbook/domain/types'

interface Be { vehicles: Vehicle[]; items: MaintenanceItem[]; dues: DueDate[]; records: CarRecord[]; calls: string[]; fail: Record<string, unknown>; gate: Record<string, Promise<void> | undefined>; seq: number }
const be = vi.hoisted((): Be => ({ vehicles: [], items: [], dues: [], records: [], calls: [], fail: {}, gate: {}, seq: 0 }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))
const ts = () => `2026-11-05T00:00:${String(Math.floor(be.seq / 1000)).padStart(2, '0')}.${String(be.seq++ % 1000).padStart(3, '0')}000+00:00`

vi.mock('../../../src/carbook/data/carbookApi', () => {
  const enter = async (name: string, detail = '') => {
    be.calls.push(detail ? `${name}:${detail}` : name)
    if (be.gate[name]) await be.gate[name]
    const f = be.fail[name]; if (f) throw f
  }
  return {
    listVehicles: async () => { await enter('listVehicles'); return be.vehicles.map((x) => ({ ...x })) },
    listItems: async () => { await enter('listItems'); return be.items.map((x) => ({ ...x })) },
    listDueDates: async () => { await enter('listDueDates'); return be.dues.map((x) => ({ ...x })) },
    listRecords: async (vid: string) => { await enter('listRecords', vid); return be.records.filter((r) => r.vehicleId === vid).map((x) => ({ ...x })) },
    createVehicle: async (id: string, i: VehicleInput) => { await enter('createVehicle', id); const v = { id, ...i, createdAt: ts() } as Vehicle; be.vehicles.push(v); return { ...v } },
    updateVehicle: async (id: string, i: VehicleInput) => { await enter('updateVehicle', id); const v = be.vehicles.find((x) => x.id === id)!; Object.assign(v, i); return { ...v } },
    deleteVehicle: async (id: string) => { await enter('deleteVehicle', id); be.vehicles = be.vehicles.filter((x) => x.id !== id); be.items = be.items.filter((x) => x.vehicleId !== id); be.records = be.records.filter((x) => x.vehicleId !== id) },
    createItems: async (vid: string, rows: Array<Omit<MaintenanceItem, 'vehicleId' | 'createdAt'>>) => { await enter('createItems', vid); const made = rows.map((r) => ({ ...r, vehicleId: vid, createdAt: ts() })) as MaintenanceItem[]; be.items.push(...made); return made.map((x) => ({ ...x })) },
    createRecord: async (id: string, vid: string, i: RecordInput) => { await enter('createRecord', id); const r = { id, vehicleId: vid, ...i, createdAt: ts() } as CarRecord; be.records.push(r); return { ...r } },
    updateRecord: async (id: string, i: RecordInput) => { await enter('updateRecord', id); const r = be.records.find((x) => x.id === id)!; Object.assign(r, i); return { ...r } },
    deleteRecord: async (id: string) => { await enter('deleteRecord', id); be.records = be.records.filter((x) => x.id !== id) },
    fillMissingItemOdometer: async (vid: string, km: number) => {
      await enter('fillMissingItemOdometer', `${vid}:${km}`)
      const changed = be.items.filter((i) => i.vehicleId === vid && i.lastOdometerKm === null); changed.forEach((i) => { i.lastOdometerKm = km }); return changed.map((x) => ({ ...x }))
    },
  }
})
vi.mock('../../../src/carbook/data/calendarLink', () => ({ createCalendarLink: () => { be.calls.push('calendarLink'); throw new Error('캘린더 연동은 이 티켓 범위가 아님') } }))
vi.mock('../../../src/state/useToast', () => ({ useToast: () => ({ showToast: toast.show }) }))

import { useCarbook } from '../../../src/carbook/state/useCarbook'

const veh = (id: string, o: Partial<Vehicle> = {}): Vehicle => ({ id, name: id, model: null, year: null, plate: null, odometerKm: null, createdAt: `2026-01-0${id.length}T00:00:00+00:00`, ...o })
const rin = (kind: RecordKind, o: Partial<RecordInput> = {}): RecordInput => ({ kind, date: '2026-11-05', amountWon: 1000, odometerKm: null, liters: null, fullTank: false, memo: null, ...o })
const vin = (name: string, odometerKm: number | null = null): VehicleInput => ({ name, model: null, year: null, plate: null, odometerKm })
const net = () => new CarbookError('network')
const MSG01 = '저장하지 못했습니다. 다시 시도해 주세요', MSG03 = '삭제하지 못했습니다. 다시 시도해 주세요'
const count = (name: string) => be.calls.filter((c) => c === name || c.startsWith(name + ':')).length
const toasts = () => toast.show.mock.calls.map((c) => c[0] as { message: string; tone?: string })

async function mount() {
  const hook = renderHook(() => useCarbook('user-1'))
  await waitFor(() => expect(hook.result.current.loadState).not.toBe('loading'))
  return hook
}
async function ready() { const h = await mount(); await waitFor(() => expect(h.result.current.recordsState).toBe('ready')); return h }

beforeEach(() => {
  Object.assign(be, { vehicles: [], items: [], dues: [], records: [], calls: [], fail: {}, gate: {}, seq: 0 }); toast.show.mockReset()
})

describe('AC-10-7 불러오기 실패', () => {
  it('목록 읽기 실패 → loadState error, 다시 시도하면 loading을 거쳐 다시 읽고 ready', async () => {
    be.vehicles = [veh('v1')]; be.fail.listVehicles = net()
    const h = await mount(); expect(h.result.current.loadState).toBe('error'); expect(count('listVehicles')).toBe(1)
    delete be.fail.listVehicles; act(() => h.result.current.retryLoad()); expect(h.result.current.loadState).toBe('loading')
    await waitFor(() => expect(h.result.current.loadState).toBe('ready')); expect(count('listVehicles')).toBe(2); expect(h.result.current.vehicles.map((v) => v.id)).toEqual(['v1'])
  })
  it('세 목록 중 하나(교체 항목)만 실패해도 error, 다시 시도 때 셋 다 다시 읽음', async () => {
    be.fail.listItems = new CarbookError('timeout'); const h = await mount(); expect(h.result.current.loadState).toBe('error')
    delete be.fail.listItems; act(() => h.result.current.retryLoad()); await waitFor(() => expect(h.result.current.loadState).toBe('ready'))
    expect([count('listVehicles'), count('listItems'), count('listDueDates')]).toEqual([2, 2, 2])
  })
  it('실패가 반복되면 계속 error(무한 로딩 아님)', async () => {
    be.fail.listVehicles = net(); const h = await mount(); act(() => h.result.current.retryLoad()); await waitFor(() => expect(h.result.current.loadState).toBe('error')); expect(count('listVehicles')).toBe(2)
  })
  it('기록 읽기 실패 → recordsState error(목록은 ready), retryRecords는 기록만 다시 읽음', async () => {
    be.vehicles = [veh('v1')]; be.fail.listRecords = net(); const h = await mount()
    await waitFor(() => expect(h.result.current.recordsState).toBe('error')); expect(h.result.current.loadState).toBe('ready'); const lv = count('listVehicles')
    delete be.fail.listRecords; act(() => h.result.current.retryRecords()); await waitFor(() => expect(h.result.current.recordsState).toBe('ready'))
    expect(count('listVehicles')).toBe(lv); expect(count('listRecords')).toBe(2)
  })
  it('세 목록은 병렬로 요청(하나가 끝나기 전에 셋 다 시작)', async () => {
    be.vehicles = [veh('v1')]; let open!: () => void; be.gate.listVehicles = new Promise<void>((r) => { open = r })
    const h = renderHook(() => useCarbook('user-1')); await waitFor(() => expect(count('listItems')).toBe(1)); expect(count('listDueDates')).toBe(1); expect(h.result.current.loadState).toBe('loading'); open()
    await waitFor(() => expect(h.result.current.loadState).toBe('ready'))
  })
})

describe('AC-03-1 여러 대 등록·선택', () => {
  it("'출퇴근'·'가족' 2대 추가(추가한 차량이 선택됨) → '가족' 선택 시 가족의 기록·교체 항목만 보임, 다시 출퇴근", async () => {
    const h = await ready()
    await act(async () => { expect(await h.result.current.saveVehicle(vin('출퇴근'))).toBe(true) }); const a = h.result.current.selectedVehicleId!
    await act(async () => { await h.result.current.saveRecord(rin('fuel', { amountWon: 50000 })) })
    await act(async () => { expect(await h.result.current.saveVehicle(vin('가족'))).toBe(true) }); const b = h.result.current.selectedVehicleId!
    expect(b).not.toBe(a); expect(h.result.current.vehicles.map((v) => v.name)).toEqual(['출퇴근', '가족'])
    await waitFor(() => expect(h.result.current.recordsState).toBe('ready')); expect(h.result.current.records).toEqual([])
    await act(async () => { await h.result.current.saveRecord(rin('wash', { amountWon: 7000 })) })
    expect(h.result.current.records.map((r) => r.kind)).toEqual(['wash']); expect(h.result.current.items).toHaveLength(7); expect(h.result.current.items.every((i) => i.vehicleId === b)).toBe(true)
    act(() => h.result.current.selectVehicle(a)); await waitFor(() => expect(h.result.current.records.map((r) => r.kind)).toEqual(['fuel']))
    expect(h.result.current.items.every((i) => i.vehicleId === a)).toBe(true)
  })
  it('차량을 바꾸면 새 기록이 도착하기 전까지 이전 차량 기록이 보이지 않고 recordsState는 loading', async () => {
    be.vehicles = [veh('v1'), veh('v2')]; be.records = [{ id: 'r1', vehicleId: 'v1', ...rin('fuel'), createdAt: 'a' } as CarRecord, { id: 'r2', vehicleId: 'v2', ...rin('wash'), createdAt: 'b' } as CarRecord]
    const h = await ready(); expect(h.result.current.records.map((r) => r.id)).toEqual(['r1'])
    let open!: () => void; be.gate.listRecords = new Promise<void>((r) => { open = r })
    act(() => h.result.current.selectVehicle('v2')); expect(h.result.current.records).toEqual([]); expect(h.result.current.recordsState).toBe('loading')
    open(); await waitFor(() => expect(h.result.current.records.map((r) => r.id)).toEqual(['r2']))
  })
  it('경계: 읽기가 느린 차량 A를 고른 뒤 곧바로 B를 고르면 A의 늦은 응답이 B 화면을 덮지 않음', async () => {
    be.vehicles = [veh('v1'), veh('v2'), veh('v3')]; be.records = [{ id: 'r1', vehicleId: 'v1', ...rin('fuel'), createdAt: 'a' } as CarRecord, { id: 'r3', vehicleId: 'v3', ...rin('wash'), createdAt: 'c' } as CarRecord]
    const h = await ready(); let open!: () => void; be.gate.listRecords = new Promise<void>((r) => { open = r })
    act(() => h.result.current.selectVehicle('v2')); act(() => h.result.current.selectVehicle('v3')); open()
    await waitFor(() => expect(h.result.current.recordsState).toBe('ready')); expect(h.result.current.selectedVehicleId).toBe('v3'); expect(h.result.current.records.map((r) => r.id)).toEqual(['r3'])
  })
  it('기본 선택은 가장 먼저 만든 차량, 존재하지 않는 id를 고르면 기본값으로', async () => {
    be.vehicles = [veh('v1'), veh('v2')]; const h = await ready(); expect(h.result.current.selectedVehicleId).toBe('v1')
    act(() => h.result.current.selectVehicle('없는id')); expect(h.result.current.selectedVehicleId).toBe('v1')
  })
})

describe('AC-03-4 / AC-10-1 저장 실패 (차량)', () => {
  it('차량 저장 실패(네트워크) → false, MSG-01 토스트 1번, 차량 목록 그대로, 교체 항목 요청 없음', async () => {
    const h = await ready(); be.fail.createVehicle = net()
    await act(async () => { expect(await h.result.current.saveVehicle(vin('새차'))).toBe(false) })
    expect(toasts()).toEqual([{ message: MSG01, tone: 'error' }]); expect(h.result.current.vehicles).toEqual([]); expect(count('createItems')).toBe(0)
  })
  it('추천 7행 저장이 실패하면 방금 만든 차량을 보상 삭제하고 false, MSG-01만 보임', async () => {
    const h = await ready(); be.fail.createItems = net()
    await act(async () => { expect(await h.result.current.saveVehicle(vin('새차'))).toBe(false) })
    expect(count('deleteVehicle')).toBe(1); expect(be.vehicles).toEqual([]); expect(h.result.current.vehicles).toEqual([]); expect(toasts().map((t) => t.message)).toEqual([MSG01])
  })
  it('보상 삭제까지 실패해도 사용자에게는 MSG-01 하나만, 화면 목록에는 차량이 없음(서버에는 항목 없는 차량이 남는 한계)', async () => {
    const h = await ready(); be.fail.createItems = net(); be.fail.deleteVehicle = net()
    await act(async () => { expect(await h.result.current.saveVehicle(vin('새차'))).toBe(false) })
    expect(toasts().map((t) => t.message)).toEqual([MSG01]); expect(h.result.current.vehicles).toEqual([]); expect(be.vehicles).toHaveLength(1)
  })
  it('차량 수정 실패 → false, MSG-01, 값 그대로(낙관적 갱신 없음)', async () => {
    be.vehicles = [veh('v1', { name: '원래' })]; const h = await ready(); be.fail.updateVehicle = net()
    await act(async () => { expect(await h.result.current.saveVehicle(vin('바꿈'), 'v1')).toBe(false) }); expect(h.result.current.vehicles[0].name).toBe('원래')
  })
  it('차량 추가 성공 시 추천 7개 항목이 생기고 새 차량이 선택됨(AC-06-1 연계)', async () => {
    const h = await ready(); await act(async () => { await h.result.current.saveVehicle(vin('새차', 5000)) })
    // 화면 목록은 AC-06-16 정렬(상태 → 다음 교체일 오름차순, 같은 날은 만든 순서, 날짜 없음 맨 뒤)이다. 추천 7개의 구성은 BR-06 그대로
    expect([...h.result.current.items.map((i) => i.name)].sort()).toEqual(['배터리 점검', '브레이크 패드 점검', '에어 필터', '에어컨 필터', '엔진오일', '와이퍼', '타이어 위치 교환'])
    expect(h.result.current.items.map((i) => i.name)).toEqual(['에어컨 필터', '엔진오일', '에어 필터', '와이퍼', '배터리 점검', '타이어 위치 교환', '브레이크 패드 점검'])
    expect(h.result.current.items.every((i) => i.lastOdometerKm === 5000 && i.eventId === null)).toBe(true); expect(be.calls).not.toContain('calendarLink')
  })
})

describe('AC-03-7 선택 차량 삭제 후 / AC-10-8 삭제 실패', () => {
  it('첫째 선택 중 삭제 → 둘째 선택. 둘째까지 삭제하면 차량 0개·선택 null', async () => {
    be.vehicles = [veh('v1'), veh('v2')]; const h = await ready()
    await act(async () => { expect(await h.result.current.deleteVehicle('v1')).toBe(true) }); expect(h.result.current.selectedVehicleId).toBe('v2')
    await waitFor(() => expect(h.result.current.recordsState).toBe('ready'))
    await act(async () => { await h.result.current.deleteVehicle('v2') }); expect(h.result.current.vehicles).toEqual([]); expect(h.result.current.selectedVehicleId).toBeNull(); expect(h.result.current.recordsState).toBe('ready')
  })
  it('선택하지 않은 차량을 지워도 선택은 그대로, 그 차량의 항목·만기일이 상태에서 사라짐', async () => {
    be.vehicles = [veh('v1'), veh('v2')]; be.items = [{ id: 'i2', vehicleId: 'v2', name: 'x', intervalKm: 1, intervalMonths: null, lastDate: '2026-11-05', lastOdometerKm: 1, eventId: null, createdAt: 'a' }]
    be.dues = [{ id: 'd2', vehicleId: 'v2', kind: 'insurance', dueDate: '2027-01-01', eventId: null, createdAt: 'a' }]
    const h = await ready(); await act(async () => { await h.result.current.deleteVehicle('v2') }); expect(h.result.current.selectedVehicleId).toBe('v1')
    act(() => h.result.current.selectVehicle('v2')); expect(h.result.current.selectedVehicleId).toBe('v1')
  })
  it('AC-10-8 삭제 실패 → MSG-03 토스트, 차량이 목록에 남고 선택도 그대로', async () => {
    be.vehicles = [veh('v1'), veh('v2')]; const h = await ready(); be.fail.deleteVehicle = net()
    await act(async () => { expect(await h.result.current.deleteVehicle('v1')).toBe(false) })
    expect(toasts()).toEqual([{ message: MSG03, tone: 'error' }]); expect(h.result.current.vehicles.map((v) => v.id)).toEqual(['v1', 'v2']); expect(h.result.current.selectedVehicleId).toBe('v1')
  })
  it('AC-10-8 기록 삭제 실패 → MSG-03, 기록이 목록에 남음', async () => {
    be.vehicles = [veh('v1')]; be.records = [{ id: 'r1', vehicleId: 'v1', ...rin('fuel'), createdAt: 'a' } as CarRecord]; const h = await ready(); be.fail.deleteRecord = net()
    await act(async () => { expect(await h.result.current.deleteRecord('r1')).toBe(false) }); expect(toasts()).toEqual([{ message: MSG03, tone: 'error' }]); expect(h.result.current.records.map((r) => r.id)).toEqual(['r1'])
  })
})

describe('AC-04-1 7종 추가 / AC-04-2 수정·삭제', () => {
  it('7종을 날짜·금액만 넣어 저장 → 7건이 목록에 있고 종류가 맞음, 다시 불러오기 없음', async () => {
    be.vehicles = [veh('v1')]; const h = await ready(); const kinds: RecordKind[] = ['fuel', 'maintenance', 'wash', 'insurance', 'tax', 'parking', 'other']; const reads = count('listRecords')
    for (const [i, k] of kinds.entries()) await act(async () => { expect(await h.result.current.saveRecord(rin(k, { date: `2026-11-0${i + 1}`, amountWon: 1000 * (i + 1) }))).toBe(true) })
    expect(h.result.current.records.map((r) => r.kind)).toEqual([...kinds].reverse()); expect(count('listRecords')).toBe(reads)
    expect(h.result.current.records.map((r) => r.amountWon)).toEqual([7000, 6000, 5000, 4000, 3000, 2000, 1000])
  })
  it('BR-09 같은 날짜는 나중에 만든 기록이 위', async () => {
    be.vehicles = [veh('v1')]; const h = await ready()
    await act(async () => { await h.result.current.saveRecord(rin('fuel', { amountWon: 1 })) }); await act(async () => { await h.result.current.saveRecord(rin('wash', { amountWon: 2 })) })
    expect(h.result.current.records.map((r) => r.amountWon)).toEqual([2, 1])
  })
  it('금액을 고쳐 저장 → 목록 금액 변경(1건 유지). 삭제하면 사라짐', async () => {
    be.vehicles = [veh('v1')]; const h = await ready(); await act(async () => { await h.result.current.saveRecord(rin('fuel', { amountWon: 1000 })) }); const id = h.result.current.records[0].id
    await act(async () => { expect(await h.result.current.saveRecord(rin('fuel', { amountWon: 2500 }), id)).toBe(true) }); expect(h.result.current.records.map((r) => r.amountWon)).toEqual([2500])
    await act(async () => { expect(await h.result.current.deleteRecord(id)).toBe(true) }); expect(h.result.current.records).toEqual([])
  })
  it('수정으로 날짜가 바뀌면 목록 순서가 다시 정해짐', async () => {
    be.vehicles = [veh('v1')]; const h = await ready()
    await act(async () => { await h.result.current.saveRecord(rin('fuel', { date: '2026-11-01', amountWon: 1 })) }); await act(async () => { await h.result.current.saveRecord(rin('wash', { date: '2026-11-03', amountWon: 2 })) })
    const first = h.result.current.records.find((r) => r.amountWon === 1)!.id
    await act(async () => { await h.result.current.saveRecord(rin('fuel', { date: '2026-11-09', amountWon: 1 }), first) }); expect(h.result.current.records.map((r) => r.amountWon)).toEqual([1, 2])
  })
  it('차량이 없으면 saveRecord는 요청 없이 false', async () => {
    const h = await ready(); await act(async () => { expect(await h.result.current.saveRecord(rin('fuel'))).toBe(false) }); expect(count('createRecord')).toBe(0)
  })
})

describe('AC-04-7 / AC-10-1 저장 실패 시 상태 유지', () => {
  it('기록 저장 실패 → false, MSG-01 1번, 목록에 새 기록 없음, 다시 읽기 없음, 이후 재시도 성공', async () => {
    be.vehicles = [veh('v1')]; const h = await ready(); const reads = count('listRecords'); be.fail.createRecord = net()
    await act(async () => { expect(await h.result.current.saveRecord(rin('fuel', { amountWon: 3000 }))).toBe(false) })
    expect(toasts()).toEqual([{ message: MSG01, tone: 'error' }]); expect(h.result.current.records).toEqual([]); expect(count('listRecords')).toBe(reads)
    delete be.fail.createRecord; await act(async () => { expect(await h.result.current.saveRecord(rin('fuel', { amountWon: 3000 }))).toBe(true) }); expect(h.result.current.records).toHaveLength(1)
  })
  it('timeout·conflict·unknown 오류도 모두 같은 MSG-01, 수정 실패는 기존 값 유지', async () => {
    be.vehicles = [veh('v1')]; const h = await ready(); await act(async () => { await h.result.current.saveRecord(rin('fuel', { amountWon: 1000 })) }); const id = h.result.current.records[0].id
    for (const e of [new CarbookError('timeout'), new CarbookError('unknown', '42501'), new CarbookError('conflict', '23505')]) {
      toast.show.mockReset(); be.fail.updateRecord = e
      await act(async () => { expect(await h.result.current.saveRecord(rin('fuel', { amountWon: 9999 }), id)).toBe(false) }); expect(toasts().map((t) => t.message)).toEqual([MSG01]); expect(h.result.current.records[0].amountWon).toBe(1000)
    }
  })
  it('차량이 다른 탭에서 지워져 FK 23503이 나면 MSG-01 뒤 목록을 다시 읽음', async () => {
    be.vehicles = [veh('v1')]; const h = await ready(); const lv = count('listVehicles'); be.fail.createRecord = new CarbookError('conflict', '23503')
    await act(async () => { expect(await h.result.current.saveRecord(rin('fuel'))).toBe(false) }); await waitFor(() => expect(count('listVehicles')).toBe(lv + 1)); expect(toasts().map((t) => t.message)).toEqual([MSG01])
  })
})

describe('AC-10-2 중복 제출 방지', () => {
  it('저장이 진행 중일 때 같은 새 기록을 다시 저장하면 요청은 1개, 둘째는 false·토스트 없음', async () => {
    be.vehicles = [veh('v1')]; const h = await ready(); let open!: () => void; be.gate.createRecord = new Promise<void>((r) => { open = r })
    let first!: Promise<boolean>, second!: boolean
    await act(async () => { first = h.result.current.saveRecord(rin('fuel')); second = await h.result.current.saveRecord(rin('fuel')) })
    expect(second).toBe(false); expect(count('createRecord')).toBe(1); expect(toast.show).not.toHaveBeenCalled()
    await act(async () => { open(); expect(await first).toBe(true) }); expect(h.result.current.records).toHaveLength(1); expect(be.records).toHaveLength(1)
  })
  it('같은 기록 수정 중복도 1요청. 다른 기록·다른 종류(차량 추가)는 막지 않음, 끝나면 다시 저장 가능', async () => {
    be.vehicles = [veh('v1')]; const h = await ready(); await act(async () => { await h.result.current.saveRecord(rin('fuel')) }); const id = h.result.current.records[0].id
    let open!: () => void; be.gate.updateRecord = new Promise<void>((r) => { open = r }); let p1!: Promise<boolean>, d = true
    await act(async () => { p1 = h.result.current.saveRecord(rin('fuel', { amountWon: 5 }), id); d = await h.result.current.saveRecord(rin('fuel', { amountWon: 6 }), id) })
    expect(d).toBe(false); expect(count('updateRecord')).toBe(1)
    let other = false; await act(async () => { other = await h.result.current.saveRecord(rin('wash')) }); expect(other).toBe(true)
    await act(async () => { open(); await p1 }); delete be.gate.updateRecord
    await act(async () => { expect(await h.result.current.saveRecord(rin('fuel', { amountWon: 7 }), id)).toBe(true) }); expect(count('updateRecord')).toBe(2)
  })
  it('차량 추가·삭제도 진행 중이면 두 번째 요청이 나가지 않음, 실패하면 잠금이 풀려 재시도 가능', async () => {
    const h = await ready(); let open!: () => void; be.gate.createVehicle = new Promise<void>((r) => { open = r }); let p!: Promise<boolean>
    await act(async () => { p = h.result.current.saveVehicle(vin('가')); expect(await h.result.current.saveVehicle(vin('가'))).toBe(false) }); expect(count('createVehicle')).toBe(1)
    be.fail.createVehicle = net(); await act(async () => { open(); expect(await p).toBe(false) }); delete be.fail.createVehicle; delete be.gate.createVehicle
    await act(async () => { expect(await h.result.current.saveVehicle(vin('가'))).toBe(true) }); expect(count('createVehicle')).toBe(2)
  })
})

describe('AC-04-10 저장 시간', () => {
  it('저장 호출부터 목록에 보일 때까지 10회, p95 ≤ 1초이고 다시 불러오기 없음(가짜 백엔드 지연 50ms 포함)', async () => {
    be.vehicles = [veh('v1')]; const h = await ready(); const reads = count('listRecords'); const ms: number[] = []
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now(); await act(async () => { await new Promise((r) => setTimeout(r, 50)); await h.result.current.saveRecord(rin('fuel', { amountWon: i + 1 })) })
      expect(h.result.current.records).toHaveLength(i + 1); ms.push(performance.now() - t0)
    }
    ms.sort((a, b) => a - b); console.log('AC-04-10 ms(정렬, 지연 50ms 포함):', ms.map((x) => x.toFixed(1)).join(', '), '| p95≈max =', ms[9].toFixed(1))
    expect(ms[9]).toBeLessThanOrEqual(1000); expect(count('listRecords')).toBe(reads)
  })
})

describe('AC-06-15 첫 기록이 기준이 됨 (BR-06a)', () => {
  it('주행거리 빈 차량을 새로 만들면 km 항목의 마지막 교체 주행거리가 비어 있고 지남·배지가 없음, 일정 요청 0', async () => {
    const h = await ready(); await act(async () => { await h.result.current.saveVehicle(vin('새차', null)) })
    expect(h.result.current.items.every((i) => i.lastOdometerKm === null)).toBe(true); expect(h.result.current.items.every((i) => i.status === 'ok')).toBe(true)
    const tire = h.result.current.items.find((i) => i.name === '타이어 위치 교환')!; expect([tire.nextDate, tire.remainingKm]).toEqual([null, null])
    expect(be.calls.some((c) => c === 'calendarLink')).toBe(false)
  })
  it('주행거리 48,000인 기록을 저장 → km 항목이 48,000으로 채워지고 엔진오일 남은 거리 10,000, 지남 없음, 일정 요청 0', async () => {
    const h = await ready(); await act(async () => { await h.result.current.saveVehicle(vin('새차', null)) })
    await act(async () => { expect(await h.result.current.saveRecord(rin('maintenance', { odometerKm: 48000 }))).toBe(true) })
    const by = (n: string) => h.result.current.items.find((i) => i.name === n)!
    expect(count('fillMissingItemOdometer')).toBe(1); expect(be.calls).toContain(`fillMissingItemOdometer:${h.result.current.selectedVehicleId}:48000`)
    for (const n of ['엔진오일', '에어컨 필터', '에어 필터', '타이어 위치 교환', '브레이크 패드 점검']) expect(by(n).lastOdometerKm).toBe(48000)
    expect(by('와이퍼').lastOdometerKm).toBe(48000) // 빈 값은 모두 채워짐(개월 항목도 값만 채우고 계산엔 안 씀)
    expect(by('엔진오일').remainingKm).toBe(10000); expect(h.result.current.items.some((i) => i.status === 'overdue')).toBe(false); expect(be.calls).not.toContain('calendarLink')
  })
  it('이미 채워진 뒤에는 다시 채우지 않음(요청 0), 주행거리 없는 기록은 채우지 않음', async () => {
    const h = await ready(); await act(async () => { await h.result.current.saveVehicle(vin('새차', null)) })
    await act(async () => { await h.result.current.saveRecord(rin('fuel')) }); expect(count('fillMissingItemOdometer')).toBe(0)
    await act(async () => { await h.result.current.saveRecord(rin('fuel', { odometerKm: 48000 })) }); await act(async () => { await h.result.current.saveRecord(rin('fuel', { odometerKm: 49000, date: '2026-11-06' })) })
    expect(count('fillMissingItemOdometer')).toBe(1); expect(h.result.current.items.find((i) => i.name === '엔진오일')!.lastOdometerKm).toBe(48000)
  })
  it('주행거리 없는 기록이라도 차량에 주행거리가 있으면 그 값으로 채움(둘 중 먼저 생긴 값)', async () => {
    be.vehicles = [veh('v1', { odometerKm: 30000 })]; be.items = [{ id: 'i1', vehicleId: 'v1', name: '엔진오일', intervalKm: 10000, intervalMonths: 12, lastDate: '2026-11-05', lastOdometerKm: null, eventId: null, createdAt: 'a' }]
    const h = await ready(); await act(async () => { await h.result.current.saveRecord(rin('wash')) }); expect(h.result.current.items[0].lastOdometerKm).toBe(30000)
  })
  it('차량 주행거리가 처음 입력되면(수정) 빈 항목을 채움', async () => {
    const h = await ready(); await act(async () => { await h.result.current.saveVehicle(vin('새차', null)) }); const id = h.result.current.selectedVehicleId!
    await act(async () => { await h.result.current.saveVehicle(vin('새차', 12000), id) }); expect(h.result.current.items.find((i) => i.name === '엔진오일')!.lastOdometerKm).toBe(12000)
  })
  it('채우기 요청이 실패해도 기록 저장은 성공(true)·토스트 없음, 다음 저장 때 다시 시도', async () => {
    const h = await ready(); await act(async () => { await h.result.current.saveVehicle(vin('새차', null)) }); be.fail.fillMissingItemOdometer = net(); toast.show.mockReset()
    await act(async () => { expect(await h.result.current.saveRecord(rin('fuel', { odometerKm: 48000 }))).toBe(true) }); expect(toast.show).not.toHaveBeenCalled(); expect(h.result.current.records).toHaveLength(1)
    expect(h.result.current.items.every((i) => i.lastOdometerKm === null)).toBe(true); delete be.fail.fillMissingItemOdometer
    await act(async () => { await h.result.current.saveRecord(rin('fuel', { odometerKm: 49000, date: '2026-11-06' })) }); expect(h.result.current.items.find((i) => i.name === '엔진오일')!.lastOdometerKm).toBe(49000)
  })
})
