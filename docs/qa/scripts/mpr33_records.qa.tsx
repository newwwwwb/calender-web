// MPR-33 QA 임시 스크립트: 진짜 useCarbook 훅(가짜 백엔드)에 진짜 RecordsTab·RecordForm·ConfirmDialog를 물려 AC-04·05·10의 화면 동작을 확인한다(npm test 미포함). MPR-27 스크립트와 같은 틀.
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError } from '../../../src/carbook/data/request'
import type { CarRecord, DueDate, DueKind, ItemInput, MaintenanceItem, Vehicle } from '../../../src/carbook/domain/types'

interface Row { [k: string]: any }
const db = vi.hoisted(() => {
  const d: any = {
    vehicles: [] as Row[], items: [] as Row[], dues: [] as Row[], records: [] as Row[], events: [] as Row[], categories: [] as Row[],
    cnt: {} as Record<string, number>, fail: {} as Record<string, boolean>, failAt: {} as Record<string, number[]>, rpcCode: '' as string, log: [] as string[], gate: {} as Record<string, Promise<void>>,
    reload: undefined as any, toast: undefined as any, signOut: undefined as any,
  }
  const hit = (key: string) => { const n = (d.cnt[key] = (d.cnt[key] ?? 0) + 1); return d.fail[key] === true || (d.failAt[key] ?? []).includes(n) }
  d.hit = hit
  const exec = (st: any) => {
    const key = `ev.${st.op}`; d.log.push(`${st.table}:${st.op}`)
    if (hit(key)) return { data: null, error: { code: 'XX000', message: 'boom' }, status: 500 }
    const rows = (st.table === 'events' ? d.events : d.categories) as Row[]
    const match = rows.filter((r) => st.f.every((f: any) => f(r)))
    if (st.op === 'select') return { data: match.map((r) => ({ ...r })), error: null, status: 200 }
    if (st.op === 'delete') { for (const r of match) rows.splice(rows.indexOf(r), 1); return { data: match.map((r) => ({ id: r.id })), error: null, status: 200 } }
    if (st.op === 'update') { for (const r of match) Object.assign(r, st.row); return { data: null, error: null, status: 204 } }
    if (st.op === 'upsert') {
      if (!d.categories.some((c: Row) => c.id === st.row.category_id)) return { data: null, error: { code: '23503', message: 'fk' }, status: 409 }
      const at = rows.findIndex((r) => r.id === st.row.id); if (at >= 0) rows[at] = { ...st.row }; else rows.push({ ...st.row })
      return { data: null, error: null, status: 201 }
    }
    return { data: null, error: { code: 'unsupported' }, status: 400 }
  }
  const builder = (table: string) => {
    const st: any = { table, op: 'select', f: [] as any[], row: null }
    const b: any = {
      select: () => b, retry: () => b, abortSignal: () => b,
      eq: (k: string, v: unknown) => { st.f.push((r: Row) => r[k] === v); return b },
      in: (k: string, vs: unknown[]) => { st.f.push((r: Row) => vs.includes(r[k])); return b },
      upsert: (row: Row) => { st.op = 'upsert'; st.row = row; return b },
      delete: () => { st.op = 'delete'; return b },
      update: (row: Row) => { st.op = 'update'; st.row = row; return b },
      then: (res: any, rej: any) => Promise.resolve(exec(st)).then(res, rej),
    }
    return b
  }
  const CAT = 'cat-fixed-user-1'
  d.CAT = CAT
  d.client = {
    from: (t: string) => builder(t),
    auth: { signOut: (...a: unknown[]) => d.signOut(...a) },
    rpc: (name: string) => {
      const res = () => {
        d.log.push(`rpc:${name}`)
        if (hit('rpc')) return { data: null, error: { code: d.rpcCode || 'XX000', message: 'rpc' }, status: d.rpcCode ? 403 : 500 }
        if (!d.categories.some((c: Row) => c.id === CAT)) d.categories.push({ id: CAT, user_id: 'user-1', name: '차계부' })
        return { data: CAT, error: null, status: 200 }
      }
      const b: any = { abortSignal: () => b, then: (r: any, j: any) => Promise.resolve(res()).then(r, j) }
      return b
    },
  }
  return d
})

const net = () => new CarbookError('network')
const nextId = (() => { let n = 0; return () => `gen-${++n}` })()

vi.mock('../../../src/lib/supabaseClient', () => ({ supabase: db.client }))
vi.mock('../../../src/carbook/data/carbookApi', () => {
  const enter = async (name: string) => { const bad = db.hit(`api.${name}`); await db.gate[`api.${name}`]; if (bad) throw net() }
  const clone = (x: Row) => ({ ...x })
  return {
    listVehicles: async () => { await enter('listVehicles'); return db.vehicles.map(clone) },
    listItems: async () => { await enter('listItems'); return db.items.map(clone) },
    listDueDates: async () => { await enter('listDueDates'); return db.dues.map(clone) },
    listRecords: async (vid: string) => { await enter('listRecords'); return db.records.filter((r: Row) => r.vehicleId === vid).map(clone) },
    createVehicle: async (id: string, i: Row) => { await enter('createVehicle'); const v = { id, ...i, createdAt: `t${db.vehicles.length}` }; db.vehicles.push(v); return clone(v) },
    updateVehicle: async (id: string, i: Row) => { await enter('updateVehicle'); const v = db.vehicles.find((x: Row) => x.id === id); Object.assign(v, i); return clone(v) },
    deleteVehicle: async (id: string) => {
      await enter('deleteVehicle')
      db.vehicles = db.vehicles.filter((x: Row) => x.id !== id); for (const k of ['items', 'dues', 'records']) db[k] = db[k].filter((x: Row) => x.vehicleId !== id)
    },
    createItems: async (vid: string, rows: Row[]) => { await enter('createItems'); const made = rows.map((r) => ({ ...r, vehicleId: vid, createdAt: `t${db.items.length}${r.id}` })); db.items.push(...made); return made.map(clone) },
    createRecord: async (id: string, vid: string, i: Row) => { await enter('createRecord'); const r = { id, vehicleId: vid, ...i, createdAt: `t${String(db.records.length).padStart(4, '0')}z` }; db.records.push(r); return clone(r) },
    updateRecord: async (id: string, i: Row) => { await enter('updateRecord'); const r = db.records.find((x: Row) => x.id === id); Object.assign(r, i); return clone(r) },
    deleteRecord: async (id: string) => { await enter('deleteRecord'); db.records = db.records.filter((x: Row) => x.id !== id) },
    fillMissingItemOdometer: async (vid: string, km: number) => {
      await enter('fillMissingItemOdometer'); const ch = db.items.filter((i: Row) => i.vehicleId === vid && i.intervalKm !== null && i.lastOdometerKm === null); ch.forEach((i: Row) => { i.lastOdometerKm = km }); return ch.map(clone)
    },
    // event_id 선점: 비어 있을 때만 채운다(행 수는 보지 않음). 돌려주는 행의 eventId가 정본. db.claimBlocked면 선점이 막혀 null 그대로(RLS 등)
    updateItem: async (id: string, i: Row, claim?: string) => {
      await enter('updateItem'); const r = db.items.find((x: Row) => x.id === id)
      if (claim && r.eventId === null && !db.claimBlocked) r.eventId = claim
      Object.assign(r, i); return clone(r)
    },
    deleteItem: async (id: string) => { await enter('deleteItem'); db.items = db.items.filter((x: Row) => x.id !== id) },
    createDueDate: async (row: Row) => {
      await enter('createDueDate')
      if (db.dues.some((d: Row) => d.vehicleId === row.vehicleId && d.kind === row.kind)) throw new CarbookError('conflict', '23505')
      const d = { id: row.id, vehicleId: row.vehicleId, kind: row.kind, dueDate: row.dueDate, eventId: row.eventId, createdAt: `t${db.dues.length}d` }; db.dues.push(d); return clone(d)
    },
    updateDueDate: async (id: string, dueDate: string, claim?: string) => {
      await enter('updateDueDate'); const r = db.dues.find((x: Row) => x.id === id)
      if (claim && r.eventId === null && !db.claimBlocked) r.eventId = claim
      r.dueDate = dueDate; return clone(r)
    },
    deleteDueDate: async (id: string) => { await enter('deleteDueDate'); db.dues = db.dues.filter((x: Row) => x.id !== id) },
    clearEventId: async (t: 'item' | 'due', id: string) => { await enter('clearEventId'); const r = (t === 'item' ? db.items : db.dues).find((x: Row) => x.id === id); if (r) r.eventId = null },
  }
})
vi.mock('../../../src/state/useCalendar', () => ({ useCalendar: () => ({ reload: db.reload }) }))
vi.mock('../../../src/state/useToast', () => ({ useToast: () => ({ showToast: db.toast }) }))

import { useCarbook } from '../../../src/carbook/state/useCarbook'

const MSG01 = '저장하지 못했습니다. 다시 시도해 주세요', MSG03 = '삭제하지 못했습니다. 다시 시도해 주세요'
const CAT: string = db.CAT
const veh = (id = 'v1', o: Partial<Vehicle> = {}): Vehicle => ({ id, name: '내 차', model: null, year: null, plate: '12가3456', odometerKm: 48000, createdAt: `c-${id}`, ...o })
const iin = (o: Partial<ItemInput> = {}): ItemInput => ({ name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: '2026-11-05', lastOdometerKm: null, ...o })
const titleOf = (v: string, n: string) => `[${v}] ${n} 교체 예정`
const addCat = () => { if (!db.categories.some((c: Row) => c.id === CAT)) db.categories.push({ id: CAT, user_id: 'user-1', name: '차계부' }) }
// 연결 일정이 이미 캘린더에 있는 상태를 만든다
const seedEvent = (id: string, title: string, date: string, cat: string | null = CAT) => { addCat(); db.events.push({ id, user_id: 'user-1', title, memo: null, category_id: cat, color: null, all_day: true, start_at: date, end_at: date, recurrence: null, excluded_dates: null }) }
const seedItem = (id: string, o: Partial<MaintenanceItem> = {}, ev?: { date: string }) => {
  const it = { ...iin(), id, vehicleId: 'v1', eventId: `ev-${id}`, createdAt: `s${id}`, ...o } as MaintenanceItem; db.items.push(it)
  if (ev && it.eventId) seedEvent(it.eventId, titleOf('내 차', it.name), ev.date); return it
}
const seedDue = (id: string, kind: DueKind, date: string, eventId: string | null = `ev-${id}`) => { db.dues.push({ id, vehicleId: 'v1', kind, dueDate: date, eventId, createdAt: `d${id}` } as DueDate) }
const seedRec = (id: string, date: string, odometerKm: number | null, vid = 'v1') => { db.records.push({ id, vehicleId: vid, kind: 'other', date, amountWon: 1, odometerKm, liters: null, fullTank: false, memo: null, createdAt: `r${id}` } as CarRecord) }
const toasts = () => db.toast.mock.calls.map((c: any[]) => c[0].message as string)
const logCount = (p: string) => db.log.filter((l: string) => l.startsWith(p)).length

async function mount(userId = 'user-1') {
  const h = renderHook(() => useCarbook(userId))
  await waitFor(() => expect(h.result.current.recordsState).toBe('ready'))
  return h
}
const call = async <T,>(f: () => Promise<T>) => { let r!: T; await act(async () => { r = await f() }); return r }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T12:00:00'))
  Object.assign(db, { vehicles: [veh('v1')], items: [], dues: [], records: [], events: [], categories: [], cnt: {}, fail: {}, failAt: {}, rpcCode: '', log: [], gate: {}, claimBlocked: false })
  db.reload = vi.fn(async () => {}); db.toast = vi.fn(); db.signOut = vi.fn()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import RecordsTab from '../../../src/carbook/components/RecordsTab'

afterEach(cleanup)
function Host() {
  const c = useCarbook('user-1')
  return <RecordsTab records={c.records} economy={c.economy} vehicleOdometerKm={c.vehicles.find((v) => v.id === c.selectedVehicleId)?.odometerKm ?? null} recordsState={c.recordsState} onRetry={c.retryRecords} onSave={c.saveRecord} onDelete={c.deleteRecord} />
}
const open = async () => { render(<Host />); await screen.findAllByRole('button', { name: '기록 추가' }) }
const addBtn = () => screen.getByRole('button', { name: '기록 추가' })
const rows = () => screen.queryAllByRole('listitem').map((li) => within(li).getByRole('button').getAttribute('aria-label') as string)
const dlg = (name?: string) => screen.getByRole('dialog', name ? { name } : undefined)
// 창이 닫혔다: DOM에서 사라졌거나 퇴장이 끝나 안 보이는 상태(scrim이 opacity 0·pointer-events none). jsdom에서는 중첩 확인창이 있는 양식의 퇴장 제거가 가끔 늦어 DOM 제거는 브라우저 검사(mpr33_browser.mjs)가 따로 본다
const shown = () => screen.queryAllByRole('dialog').filter((d) => (d.parentElement as HTMLElement).style.pointerEvents !== 'none')
const gone = () => waitFor(() => expect(shown()).toHaveLength(0), { timeout: 3000 })
const put = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } })
const saveBtn = () => within(dlg()).getByRole('button', { name: '저장' })
const rin = (o: Row) => ({ kind: 'fuel', date: '2026-11-05', amountWon: 1000, odometerKm: null, liters: null, fullTank: false, memo: null, ...o })
async function addVia(o: { kind: string; date?: string; amount: string; km?: string; liters?: string; full?: boolean }) {
  fireEvent.click(addBtn()); await screen.findByRole('dialog')
  put(/종류/, o.kind); if (o.date) put(/날짜/, o.date); put(/금액/, o.amount); if (o.km) put(/주행거리/, o.km); if (o.liters) put(/주유량/, o.liters)
  if (o.full) fireEvent.click(screen.getByLabelText('가득 주유'))
  fireEvent.click(saveBtn())
}

describe('AC-04-1·2·3 추가·수정·삭제·정렬', () => {
  it('AC-04-1 주유·정비·세차·보험·세금·주차·기타를 날짜·금액만으로 저장 → 7건이 목록에 있고 종류 이름이 맞음', async () => {
    await open(); const kinds = [['fuel', '주유'], ['maintenance', '정비'], ['wash', '세차'], ['insurance', '보험'], ['tax', '세금'], ['parking', '주차'], ['other', '기타']]
    for (const [i, [k]] of kinds.entries()) { await addVia({ kind: k, date: `2026-11-0${i + 1}`, amount: `${(i + 1) * 100}` }); await gone() }
    expect(db.records.map((r: Row) => r.kind).sort()).toEqual(kinds.map(([k]) => k).sort()); const r = rows(); expect(r).toHaveLength(7)
    kinds.forEach(([, label], i) => expect(r.find((x) => x.startsWith(`2026-11-0${i + 1} ${label} `))).toBeTruthy())
  })
  it('AC-04-2 수정: 금액 변경 → 목록 금액이 바뀜. 삭제: 취소하면 그대로(양식도 남음), "삭제"하면 목록에서 사라짐', async () => {
    seedRec('r1', '2026-11-05', null); db.records[0].kind = 'fuel'; db.records[0].amountWon = 50000; await open()
    fireEvent.click(screen.getByRole('button', { name: /주유 50,000원.*수정/ })); await screen.findByRole('dialog', { name: '기록 수정' }); put(/금액/, '55000'); fireEvent.click(saveBtn()); await gone()
    expect(rows()[0]).toContain('55,000원'); expect(db.records[0].amountWon).toBe(55000)
    fireEvent.click(screen.getByRole('button', { name: /55,000원/ })); await screen.findByRole('dialog', { name: '기록 수정' }); fireEvent.click(within(dlg('기록 수정')).getByRole('button', { name: '삭제' }))
    const confirm = await screen.findByRole('dialog', { name: '삭제 확인' }); expect(within(confirm).getByRole('heading', { name: '삭제할까요?' })).toBeTruthy(); expect(within(confirm).getByText(/기록\(2026-11-05·주유\)을\(를\) 삭제할까요/)).toBeTruthy(); fireEvent.click(within(confirm).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '삭제 확인' })).toBeNull()); expect(screen.getByRole('dialog', { name: '기록 수정' })).toBeTruthy(); expect(db.records).toHaveLength(1)
    fireEvent.click(within(dlg('기록 수정')).getByRole('button', { name: '삭제' })); fireEvent.click(within(await screen.findByRole('dialog', { name: '삭제 확인' })).getByRole('button', { name: '삭제' })); await gone()
    expect(db.records).toHaveLength(0); expect(screen.getByText('기록이 없습니다')).toBeTruthy()
  })
  it('AC-04-3 정렬: 11-01, 11-05, 11-03 기록 + 같은 11-05에 나중에 만든 기록 → 11-05(나중), 11-05(먼저), 11-03, 11-01', async () => {
    for (const [id, d, a] of [['r1', '2026-11-01', 1], ['r2', '2026-11-05', 111], ['r3', '2026-11-03', 3]] as const) { seedRec(id, d, null); const r = db.records.at(-1); r.kind = 'other'; r.amountWon = a }
    await open(); await addVia({ kind: 'other', date: '2026-11-05', amount: '222' }); await gone()
    expect(rows().map((x) => x.split(' ').slice(0, 1).concat(x.match(/[\d,]+원/)![0]))).toEqual([['2026-11-05', '222원'], ['2026-11-05', '111원'], ['2026-11-03', '3원'], ['2026-11-01', '1원']])
  })
})

describe('AC-04-4·5·8 / AC-10-3 입력 검사', () => {
  it('AC-04-4 금액·날짜·종류를 비우고 저장 → 칸 아래 오류(연결됨), 저장 요청 0건, 양식 유지', async () => {
    await open(); fireEvent.click(addBtn()); await screen.findByRole('dialog'); put(/날짜/, ''); fireEvent.click(saveBtn())
    expect(screen.getByText('금액을(를) 입력해 주세요')).toBeTruthy(); const amount = screen.getByLabelText(/금액/); expect(amount.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(amount.getAttribute('aria-describedby')!)?.textContent).toContain('금액을(를) 입력해 주세요'); expect(screen.getAllByText(/을\(를\) (입력|선택)해 주세요/).length).toBeGreaterThanOrEqual(3)
    expect(db.cnt['api.createRecord']).toBeUndefined(); expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('AC-04-5 금액 -100·12.5 → MSG-06, 주유량 abc → MSG-07, 주유량 10000 → MSG-17, 요청 0건', async () => {
    await open(); fireEvent.click(addBtn()); await screen.findByRole('dialog'); put(/종류/, 'fuel'); put(/금액/, '-100'); put(/주유량/, 'abc'); fireEvent.click(saveBtn())
    expect(screen.getByText('금액은(는) 0 이상의 정수로 입력해 주세요')).toBeTruthy(); expect(screen.getByText('주유량은 0 이상의 숫자(소수 둘째 자리까지)로 입력해 주세요')).toBeTruthy()
    put(/금액/, '12.5'); fireEvent.click(saveBtn()); expect(screen.getByText('금액은(는) 0 이상의 정수로 입력해 주세요')).toBeTruthy()
    put(/금액/, '1000'); put(/주유량/, '10000'); fireEvent.click(saveBtn()); expect(screen.getByText('주유량은(는) 9,999.99 이하로 입력해 주세요')).toBeTruthy(); expect(db.cnt['api.createRecord']).toBeUndefined()
  })
  it('AC-04-8 주유(30L·가득)로 입력 후 종류를 세차로 바꿔 저장 → 저장된 기록에 주유량·가득 값이 없음', async () => {
    await open(); fireEvent.click(addBtn()); await screen.findByRole('dialog'); put(/종류/, 'fuel'); put(/금액/, '1000'); put(/주유량/, '30'); fireEvent.click(screen.getByLabelText('가득 주유')); put(/종류/, 'wash')
    expect(screen.queryByLabelText(/주유량/)).toBeNull(); fireEvent.click(saveBtn()); await gone()
    expect([db.records[0].kind, db.records[0].liters, db.records[0].fullTank]).toEqual(['wash', null, false])
  })
})

describe('AC-04-6 / AC-10-6 주행거리 감소 경고', () => {
  const setup = async () => { db.vehicles[0].odometerKm = 50000; await open() }
  const fill = async () => { fireEvent.click(addBtn()); await screen.findByRole('dialog', { name: '기록 추가' }); put(/종류/, 'maintenance'); put(/금액/, '30000'); put(/주행거리/, '49000'); fireEvent.click(saveBtn()) }
  it('현재 50,000km에서 49,000 저장 → MSG-10(50,000km), "취소"하면 저장되지 않고 양식(입력값 포함)이 남음', async () => {
    await setup(); await fill(); const c = await screen.findByRole('dialog', { name: '주행거리 확인' }); expect(within(c).getByText(/50,000km/)).toBeTruthy(); expect(db.cnt['api.createRecord']).toBeUndefined()
    fireEvent.click(within(c).getByRole('button', { name: '취소' })); await waitFor(() => expect(screen.queryByRole('dialog', { name: '주행거리 확인' })).toBeNull())
    expect((screen.getByLabelText(/주행거리/) as HTMLInputElement).value).toBe('49000'); expect((screen.getByLabelText(/금액/) as HTMLInputElement).value).toBe('30000'); expect(db.records).toHaveLength(0)
  })
  it('AC-10-6 "저장"을 누르면 저장되고 양식과 확인창이 닫힘, 목록에 49,000km 기록', async () => {
    await setup(); await fill(); const c = await screen.findByRole('dialog', { name: '주행거리 확인' }); fireEvent.click(within(c).getByRole('button', { name: '저장' })); await gone()
    expect(db.records).toHaveLength(1); expect(db.records[0].odometerKm).toBe(49000); expect(rows()[0]).toContain('49,000km')
  })
  it('감소가 아니면(50,000 이상) 확인창 없이 바로 저장', async () => {
    await setup(); fireEvent.click(addBtn()); await screen.findByRole('dialog'); put(/종류/, 'other'); put(/금액/, '1'); put(/주행거리/, '50000'); fireEvent.click(saveBtn()); await gone(); expect(db.records).toHaveLength(1)
  })
})

describe('AC-04-7 / AC-10-1·2 저장 실패와 중복 제출', () => {
  it('저장 요청 실패(네트워크 끊김) → MSG-01 토스트, 양식 열린 채 모든 입력값 유지, 목록에 새 기록 없음, 저장 버튼 다시 활성', async () => {
    await open(); db.fail['api.createRecord'] = true; fireEvent.click(addBtn()); await screen.findByRole('dialog'); put(/종류/, 'fuel'); put(/날짜/, '2026-11-04'); put(/금액/, '45000'); put(/주행거리/, '48500'); put(/주유량/, '30.5'); fireEvent.click(screen.getByLabelText('가득 주유')); put(/메모/, '메모 입니다'); fireEvent.click(saveBtn())
    await waitFor(() => expect(toasts()).toEqual([MSG01])); const v = (l: RegExp) => (screen.getByLabelText(l) as HTMLInputElement).value
    expect([v(/종류/), v(/날짜/), v(/금액/), v(/주행거리/), v(/주유량/), v(/메모/), (screen.getByLabelText('가득 주유') as HTMLInputElement).checked]).toEqual(['fuel', '2026-11-04', '45000', '48500', '30.5', '메모 입니다', true])
    await waitFor(() => expect((saveBtn() as HTMLButtonElement).disabled).toBe(false)); expect(db.records).toHaveLength(0); expect(rows()).toHaveLength(0)
  })
  it('AC-10-2 요청이 진행 중일 때 저장을 다시(버튼 3번·Enter) 눌러도 요청은 1번', async () => {
    await open(); let release!: () => void; db.gate['api.createRecord'] = new Promise<void>((r) => { release = r })
    fireEvent.click(addBtn()); await screen.findByRole('dialog'); put(/종류/, 'other'); put(/금액/, '5'); const b = saveBtn(); fireEvent.click(b); fireEvent.click(b); fireEvent.click(b); fireEvent.submit(b.closest('form')!)
    await waitFor(() => expect(db.cnt['api.createRecord']).toBe(1)); release(); await gone(); expect(db.cnt['api.createRecord']).toBe(1); expect(db.records).toHaveLength(1)
  })
  it('수정 저장 실패도 같음: MSG-01, 양식과 입력값 유지, 목록 금액 그대로', async () => {
    seedRec('r1', '2026-11-05', null); db.records[0].kind = 'other'; db.records[0].amountWon = 777; await open(); db.fail['api.updateRecord'] = true
    fireEvent.click(screen.getByRole('button', { name: /777원/ })); await screen.findByRole('dialog', { name: '기록 수정' }); put(/금액/, '888'); fireEvent.click(saveBtn()); await waitFor(() => expect(toasts()).toEqual([MSG01]))
    expect((screen.getByLabelText(/금액/) as HTMLInputElement).value).toBe('888'); expect(db.records[0].amountWon).toBe(777)
  })
  it('삭제 실패 → MSG-03, 확인창 유지, 기록 그대로', async () => {
    seedRec('r1', '2026-11-05', null); db.records[0].kind = 'other'; await open(); db.fail['api.deleteRecord'] = true
    fireEvent.click(screen.getByRole('button', { name: /수정/ })); await screen.findByRole('dialog', { name: '기록 수정' }); fireEvent.click(within(dlg('기록 수정')).getByRole('button', { name: '삭제' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: '삭제 확인' })).getByRole('button', { name: '삭제' })); await waitFor(() => expect(toasts()).toEqual([MSG03])); expect(screen.getByRole('dialog', { name: '삭제 확인' })).toBeTruthy(); expect(db.records).toHaveLength(1)
  })
})

describe('AC-05-1·2·4 연비', () => {
  const seedFuel = (id: string, date: string, odo: number, liters: number, full: boolean) => { seedRec(id, date, odo); Object.assign(db.records.at(-1), { kind: 'fuel', liters, fullTank: full, amountWon: 1000 }); db.vehicles[0].odometerKm = null }
  it('AC-05-1 가득 A(10-01, 10,000km) · 중간 비가득 20L(10-10) · 가득 B(10-20, 10,500km, 30L) → "연비 10.0km/L"(B 행에도 10.0)', async () => {
    seedFuel('a', '2026-10-01', 10000, 35, true); seedFuel('m', '2026-10-10', 10300, 20, false); seedFuel('b', '2026-10-20', 10500, 30, true); await open()
    expect(screen.getByText('10.0km/L').closest('p')?.textContent).toBe('연비 10.0km/L'); expect(rows().find((r) => r.startsWith('2026-10-20'))).toContain('연비 10.0km/L'); expect(rows().find((r) => r.startsWith('2026-10-01'))).not.toContain('연비')
  })
  it('AC-05-2 가득 주유 1건뿐 → 연비 숫자 없음, "가득 주유 기록이 2건 이상 필요합니다"', async () => {
    seedFuel('a', '2026-10-01', 10000, 35, true); await open(); expect(screen.getByText(/가득 주유 기록이 2건 이상 필요합니다/)).toBeTruthy(); expect(screen.queryByText(/km\/L/)).toBeNull()
  })
  it('AC-05-4 C(2026-11-01, 11,100km, 40L, 가득)를 추가 → 최근 연비 15.0, B 행의 구간 연비 10.0은 그대로', async () => {
    seedFuel('a', '2026-10-01', 10000, 35, true); seedFuel('m', '2026-10-10', 10300, 20, false); seedFuel('b', '2026-10-20', 10500, 30, true); await open()
    await addVia({ kind: 'fuel', date: '2026-11-01', amount: '60000', km: '11100', liters: '40', full: true }); await gone()
    expect(screen.getByText('15.0km/L').closest('p')?.textContent).toBe('연비 15.0km/L'); expect(rows().find((r) => r.startsWith('2026-10-20'))).toContain('연비 10.0km/L'); expect(rows().find((r) => r.startsWith('2026-11-01'))).toContain('연비 15.0km/L')
  })
  it('AC-05-3 가득 기록 중 하나에 주행거리가 없으면 그 구간 연비는 안 보임', async () => {
    seedFuel('a', '2026-10-01', 10000, 35, true); seedFuel('b', '2026-10-20', 10500, 30, true); db.records[1].odometerKm = null; await open(); expect(screen.queryByText(/km\/L/)).toBeNull()
  })
})

describe('불러오기 상태 (AC-10-7 화면 부분)', () => {
  it('기록 읽기 실패 → MSG-04와 "다시 시도", 누르면 다시 읽어 목록이 나옴', async () => {
    seedRec('r1', '2026-11-05', null); db.records[0].kind = 'other'; db.fail['api.listRecords'] = true; render(<Host />); await screen.findByText('차계부 데이터를 불러오지 못했습니다')
    db.fail['api.listRecords'] = false; fireEvent.click(screen.getByRole('button', { name: '다시 시도' })); await waitFor(() => expect(rows()).toHaveLength(1))
  })
})
