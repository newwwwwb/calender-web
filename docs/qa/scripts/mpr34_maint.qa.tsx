// MPR-34 QA 임시 스크립트: 진짜 useCarbook 훅(가짜 백엔드·진짜 calendarLink)에 진짜 MaintenanceTab·MaintenanceForm·CompleteDialog를 물려 AC-06·08-5·12의 화면 동작을 확인한다(npm test 미포함). MPR-27·33 스크립트와 같은 틀.
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
import MaintenanceTab from '../../../src/carbook/components/MaintenanceTab'
import type { CarbookState } from '../../../src/carbook/state/useCarbook'

afterEach(cleanup)
let ctl: CarbookState
function Host() {
  const c = useCarbook('user-1'); ctl = c
  return <MaintenanceTab items={c.items} currentKm={c.currentOdometerKm} recordsState={c.recordsState} onRetry={c.retryRecords} onSave={c.saveItem} onDelete={c.deleteItem} onComplete={c.completeItem} onRetryCalendar={(id) => c.retryCalendar({ type: 'item', id })} />
}
const open = async () => { render(<Host />); await screen.findAllByRole('button', { name: /항목 추가/ }) }
const rowsEl = () => screen.queryAllByRole('listitem')
const rowOf = (name: string) => rowsEl().find((li) => within(li).queryByText(name, { selector: 'span' }))!
const names = () => rowsEl().map((li) => li.querySelector('button')!.textContent!.replace('›', '').trim())
const BADGE_SOON = '곧 교체', BADGE_OVER = '교체 시기 지남'
const badgeOf = (name: string) => { const t = rowOf(name).textContent!; return t.includes(BADGE_OVER) ? BADGE_OVER : t.includes(BADGE_SOON) ? BADGE_SOON : null }
const dlg = (name: string) => screen.getByRole('dialog', { name })
const shown = () => screen.queryAllByRole('dialog').filter((d) => (d.parentElement as HTMLElement).style.pointerEvents !== 'none')
const gone = () => waitFor(() => expect(shown()).toHaveLength(0), { timeout: 3000 })
const put = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } })
const saveBtn = (n = '교체 항목 추가') => within(dlg(n)).getByRole('button', { name: '저장' })
async function openAdd() { fireEvent.click(screen.getAllByRole('button', { name: '항목 추가' })[0]); await screen.findByRole('dialog', { name: '교체 항목 추가' }) }
const item = (id: string, o: Partial<MaintenanceItem> = {}) => seedItem(id, { eventId: null, ...o })

describe('AC-06-1·13 추천 항목', () => {
  it('AC-06-1 차량을 새로 등록하면 원본 4.1의 7개 항목이 km·개월 값으로 보임', async () => {
    db.vehicles.length = 0; await open(); await call(() => ctl.saveVehicle({ name: '새 차', model: null, year: null, plate: null, odometerKm: 48000 })); await waitFor(() => expect(rowsEl()).toHaveLength(7))
    const cyc = (n: string) => rowOf(n).querySelector('p')!.textContent!.replace('주기 ', '').trim()
    expect([['엔진오일', '10,000km / 12개월'], ['에어컨 필터', '10,000km / 6개월'], ['에어 필터', '20,000km / 12개월'], ['타이어 위치 교환', '10,000km'], ['브레이크 패드 점검', '20,000km'], ['와이퍼', '12개월'], ['배터리 점검', '36개월']].map(([n]) => cyc(n))).toEqual(['10,000km / 12개월', '10,000km / 6개월', '20,000km / 12개월', '10,000km', '20,000km', '12개월', '36개월'])
  })
  it('AC-06-13 주행거리 비운 새 차량: 엔진오일 2027-11-05·배지 없음, 타이어 위치·브레이크는 "주행거리 기록 부족"·남은 거리 없음·배지 없음, 캘린더 일정 0건', async () => {
    db.vehicles.length = 0; await open(); await call(() => ctl.saveVehicle({ name: '새 차', model: null, year: null, plate: null, odometerKm: null })); await waitFor(() => expect(rowsEl()).toHaveLength(7))
    expect(rowOf('엔진오일').textContent).toContain('2027-11-05'); expect(badgeOf('엔진오일')).toBeNull()
    for (const n of ['타이어 위치 교환', '브레이크 패드 점검']) { const t = rowOf(n).textContent!; expect([t.includes('주행거리 기록 부족'), t.includes('남은 거리'), badgeOf(n)]).toEqual([true, false, null]) }
    expect([db.events.length, db.log.filter((l: string) => l.startsWith('events:')).length]).toEqual([0, 0])
  })
})

describe('AC-06-6·7·8 상태 배지', () => {
  const nm = (id: string, nextMonthsBack: string, o: Partial<MaintenanceItem> = {}) => item(id, { name: id, intervalMonths: 12, lastDate: nextMonthsBack, ...o })
  it('AC-06-6 다음 교체일 2026-12-05(오늘+30일) → "곧 교체", 2026-12-06(+31일) → 배지 없음', async () => {
    nm('d30', '2025-12-05'); nm('d31', '2025-12-06'); await open(); expect([badgeOf('d30'), badgeOf('d31')]).toEqual([BADGE_SOON, null])
  })
  it('AC-06-7 남은 거리 1,000km → "곧 교체", 1,001km → 배지 없음(날짜 조건 없을 때)', async () => {
    item('k1000', { name: 'k1000', intervalMonths: null, intervalKm: 10000, lastOdometerKm: 39000 }); item('k1001', { name: 'k1001', intervalMonths: null, intervalKm: 10000, lastOdometerKm: 39001 }); await open()
    expect([badgeOf('k1000'), badgeOf('k1001'), rowOf('k1000').textContent!.includes('1,000km'), rowOf('k1001').textContent!.includes('1,001km')]).toEqual([BADGE_SOON, null, true, true])
  })
  it('AC-06-8 다음 교체일 2026-11-04 또는 남은 거리 −1km → "교체 시기 지남"만(곧 교체 없음), 초과 거리 표시', async () => {
    nm('d-1', '2025-11-04'); item('k-1', { name: 'k-1', intervalMonths: null, intervalKm: 10000, lastOdometerKm: 37999 }); await open()
    expect([badgeOf('d-1'), badgeOf('k-1'), rowOf('k-1').textContent!.includes('1km 초과'), rowOf('d-1').textContent!.includes(BADGE_SOON)]).toEqual([BADGE_OVER, BADGE_OVER, true, false])
  })
  it('배지는 색만이 아니라 글자로도 전달(행 이름 버튼의 접근 가능한 이름에 상태 포함)', async () => {
    nm('d-1', '2025-11-04'); nm('d30', '2025-12-05'); nm('ok', '2026-11-05'); await open()
    expect([...screen.getAllByRole('button', { name: /수정$/ })].map((b) => b.getAttribute('aria-label'))).toEqual(['d-1, 교체 시기 지남, 수정', 'd30, 곧 교체, 수정', 'ok, 수정'])
  })
})

describe('AC-06-16 정렬', () => {
  it('정상 2027-03-01 · 곧 11-20 · 지남 10-01 · 곧 11-10 · 날짜 없음(정상) → 지남(10-01), 곧(11-10), 곧(11-20), 정상(2027-03-01), 날짜 없음', async () => {
    item('ok-0301', { name: 'ok-0301', lastDate: '2026-03-01' }); item('soon-1120', { name: 'soon-1120', lastDate: '2025-11-20' }); item('over-1001', { name: 'over-1001', lastDate: '2025-10-01' }); item('soon-1110', { name: 'soon-1110', lastDate: '2025-11-10' })
    item('nodate', { name: 'nodate', intervalMonths: null, intervalKm: 10000, lastOdometerKm: 40000 }); await open()
    expect(names()).toEqual(['over-1001', 'soon-1110', 'soon-1120', 'ok-0301', 'nodate'])
  })
})

describe('AC-06-9·14·17 항목 양식 검사', () => {
  it('AC-06-9 km·개월 모두 비우고 저장 → MSG-09, 저장 요청 0건, 양식 유지. km 주기만 있고 마지막 교체 주행거리가 비면 MSG-19', async () => {
    await open(); await openAdd(); put(/이름/, '점검'); fireEvent.click(saveBtn()); expect(screen.getByText('교체 주기는 km 또는 개월 중 하나 이상 입력해 주세요')).toBeTruthy(); expect(db.cnt['api.createItems']).toBeUndefined(); expect(screen.getByRole('dialog', { name: '교체 항목 추가' })).toBeTruthy()
    put('km 주기', '10000'); fireEvent.click(saveBtn()); expect(screen.getByText('마지막 교체 주행거리를 입력해 주세요')).toBeTruthy(); expect(db.cnt['api.createItems']).toBeUndefined()
  })
  it('AC-06-14 마지막 교체일에 내일(2026-11-06) → MSG-20, 요청 0건. 오늘(2026-11-05)은 통과', async () => {
    await open(); await openAdd(); put(/이름/, '점검'); put(/개월 주기/, '12'); put(/마지막 교체일/, '2026-11-06'); fireEvent.click(saveBtn()); expect(screen.getByText('마지막 교체일은 오늘 또는 그 이전 날짜로 입력해 주세요')).toBeTruthy(); expect(db.cnt['api.createItems']).toBeUndefined()
    put(/마지막 교체일/, '2026-11-05'); fireEvent.click(saveBtn()); await gone(); expect(db.cnt['api.createItems']).toBe(1)
  })
  it('AC-06-17 km 0·개월 -1 → 각각 MSG-21, 요청 0건. km 1000000 → MSG-17', async () => {
    await open(); await openAdd(); put(/이름/, '점검'); put('km 주기', '0'); put(/개월 주기/, '-1'); put(/마지막 교체 주행거리/, '100'); fireEvent.click(saveBtn())
    expect(screen.getAllByText(/은\(는\) 1 이상의 정수로 입력해 주세요/)).toHaveLength(2); expect(db.cnt['api.createItems']).toBeUndefined()
    put('km 주기', '1000000'); put(/개월 주기/, ''); fireEvent.click(saveBtn()); expect(screen.getByText(/은\(는\) 999,999 이하로 입력해 주세요/)).toBeTruthy(); expect(db.cnt['api.createItems']).toBeUndefined()
  })
  it('AC-06-17 km 1과 999999는 통과(저장 요청 나감)', async () => {
    await open(); for (const v of ['1', '999999']) { await openAdd(); put(/이름/, `n${v}`); put('km 주기', v); put(/마지막 교체 주행거리/, '48000'); fireEvent.click(saveBtn()); await gone() }
    expect(db.items.map((i: Row) => i.intervalKm).sort()).toEqual([1, 999999].sort())
  })
  it('저장 실패 → MSG-01 토스트, 양식 열린 채 입력값 유지, 목록에 새 항목 없음', async () => {
    await open(); db.fail['api.createItems'] = true; await openAdd(); put(/이름/, '점검'); put(/개월 주기/, '12'); fireEvent.click(saveBtn()); await waitFor(() => expect(toasts()).toEqual([MSG01]))
    expect([(screen.getByLabelText(/이름/) as HTMLInputElement).value, (screen.getByLabelText(/개월 주기/) as HTMLInputElement).value, rowsEl().length]).toEqual(['점검', '12', 0])
  })
})

describe('AC-06-2·10·11 수정·교체 완료·추가·삭제', () => {
  it('AC-06-2 주기를 12→6개월로 고쳐 저장하면 다음 교체일 2026-11-05+6개월=2027-05-05', async () => {
    item('oil', { name: '엔진오일', lastDate: '2026-11-05' }); await open(); expect(rowOf('엔진오일').textContent).toContain('2027-11-05')
    fireEvent.click(screen.getByRole('button', { name: /엔진오일.*수정/ })); await screen.findByRole('dialog', { name: '교체 항목 수정' }); put(/개월 주기/, '6'); fireEvent.click(saveBtn('교체 항목 수정')); await gone(); expect(rowOf('엔진오일').textContent).toContain('2027-05-05')
  })
  it('AC-06-10 지남 엔진오일 → "교체 완료"(기본값 오늘·현재 주행거리) 2026-11-05·48,000 → 마지막 교체 갱신, 배지 사라짐, 다음 교체일 재계산', async () => {
    item('oil', { name: '엔진오일', lastDate: '2025-01-05', lastOdometerKm: 30000, intervalKm: null }); await open(); expect(badgeOf('엔진오일')).toBe(BADGE_OVER)
    fireEvent.click(screen.getByRole('button', { name: '교체 완료, 엔진오일' })); await screen.findByRole('dialog', { name: '교체 완료' })
    expect([(screen.getByLabelText(/날짜|교체일/) as HTMLInputElement).value]).toEqual(['2026-11-05']); fireEvent.click(within(dlg('교체 완료')).getByRole('button', { name: '확인' })); await gone()
    const t = rowOf('엔진오일').textContent!; expect([badgeOf('엔진오일'), t.includes('2026-11-05'), t.includes('2027-11-05')]).toEqual([null, true, true])
  })
  it('AC-06-10 km 항목은 교체 완료에서 주행거리 필수(MSG-19), 기본값은 현재 주행거리 48,000', async () => {
    item('oil', { name: '엔진오일', intervalKm: 10000, intervalMonths: null, lastOdometerKm: 30000 }); await open(); fireEvent.click(screen.getByRole('button', { name: '교체 완료, 엔진오일' })); await screen.findByRole('dialog', { name: '교체 완료' })
    expect((screen.getByLabelText(/주행거리/) as HTMLInputElement).value).toBe('48000'); put(/주행거리/, ''); fireEvent.click(within(dlg('교체 완료')).getByRole('button', { name: '확인' })); expect(screen.getByText('마지막 교체 주행거리를 입력해 주세요')).toBeTruthy()
    put(/주행거리/, '48000'); fireEvent.click(within(dlg('교체 완료')).getByRole('button', { name: '확인' })); await gone(); expect(rowOf('엔진오일').textContent).toContain('48,000km')
  })
  it('AC-06-11 "타이어" 48개월 추가 → 목록에 나타남. 수정 양식 삭제 → 확인창 "삭제" → 목록에서 사라짐', async () => {
    await open(); await openAdd(); put(/이름/, '타이어'); put(/개월 주기/, '48'); put(/마지막 교체일/, '2026-11-05'); fireEvent.click(saveBtn()); await gone(); expect(names()).toEqual(['타이어']); expect(rowOf('타이어').textContent).toContain('48개월')
    fireEvent.click(screen.getByRole('button', { name: /타이어.*수정/ })); await screen.findByRole('dialog', { name: '교체 항목 수정' }); fireEvent.click(within(dlg('교체 항목 수정')).getByRole('button', { name: '삭제' }))
    const c = await screen.findByRole('dialog', { name: '삭제 확인' }); expect(within(c).getByText(/교체 항목 타이어을\(를\) 삭제할까요/)).toBeTruthy(); fireEvent.click(within(c).getByRole('button', { name: '삭제' })); await gone(); expect(rowsEl()).toHaveLength(0); expect(screen.getByText('교체 항목이 없습니다')).toBeTruthy()
  })
  it('삭제 실패 → MSG-03, 확인창 유지, 항목 그대로', async () => {
    item('a', { name: 'a' }); await open(); db.fail['api.deleteItem'] = true; fireEvent.click(screen.getByRole('button', { name: /a.*수정/ })); await screen.findByRole('dialog', { name: '교체 항목 수정' }); fireEvent.click(within(dlg('교체 항목 수정')).getByRole('button', { name: '삭제' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: '삭제 확인' })).getByRole('button', { name: '삭제' })); await waitFor(() => expect(toasts()).toEqual([MSG03])); expect(screen.getByRole('dialog', { name: '삭제 확인' })).toBeTruthy(); expect(db.items).toHaveLength(1)
  })
})

describe('AC-08-5 반영 실패 버튼(MSG-11)', () => {
  const RETRY = /캘린더 반영 실패, 다시 시도/
  it('항목 저장은 성공하고 일정 쓰기만 실패 → 그 행에 버튼, 누르면 성공해 버튼 사라지고 일정 1건, 포커스가 같은 행의 "교체 완료"로', async () => {
    await open(); db.failAt['ev.upsert'] = [1]; await openAdd(); put(/이름/, '엔진오일'); put(/개월 주기/, '12'); put(/마지막 교체일/, '2026-11-05'); fireEvent.click(saveBtn()); await gone()
    const btn = await screen.findByRole('button', { name: RETRY }); expect([rowsEl().length, db.events.length, toasts().length]).toEqual([1, 0, 0]); expect(btn.getAttribute('aria-label')).toContain('교체 항목 엔진오일')
    btn.focus(); fireEvent.click(btn); await waitFor(() => expect(screen.queryByRole('button', { name: RETRY })).toBeNull()); expect(db.events).toHaveLength(1); expect(db.events[0].title).toBe('[내 차] 엔진오일 교체 예정')
    await waitFor(() => expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('교체 완료, 엔진오일'))
  })
  it('AC-08-6 버튼을 연달아 눌러도 일정은 1건(요청 중 aria-disabled)', async () => {
    item('oil', { name: '엔진오일', eventId: 'ev-oil' }); db.fail['ev.upsert'] = true; await open(); const btn = await screen.findByRole('button', { name: RETRY }) // 열 때 점검이 지워진 일정을 다시 만들다 실패한 상태
    db.fail['ev.upsert'] = false; fireEvent.click(btn); fireEvent.click(btn); await waitFor(() => expect(screen.queryByRole('button', { name: RETRY })).toBeNull()); expect(db.events).toHaveLength(1)
  })
  it('재시도가 또 실패하면 버튼이 그대로 남고 다시 누를 수 있음', async () => {
    item('oil', { name: '엔진오일', eventId: 'ev-oil' }); db.fail['ev.upsert'] = true; await open(); const btn = await screen.findByRole('button', { name: RETRY }); fireEvent.click(btn)
    await waitFor(() => expect(btn.getAttribute('aria-disabled')).toBeNull()); expect(screen.getByRole('button', { name: RETRY })).toBeTruthy(); expect(db.events).toHaveLength(0)
  })
})

describe('AC-12-1~4 안내 문구(MSG-12)', () => {
  const HINT = '참고용 값입니다. 차량 매뉴얼을 우선하세요'
  it('AC-12-1 목록 위에 문구가 보이고 닫기 버튼이 없음', async () => {
    item('a', { name: 'a' }); await open(); const t = screen.getByText(HINT); expect(t).toBeTruthy(); expect(t.closest('p')!.querySelector('button')).toBeNull(); expect(t.compareDocumentPosition(screen.getByRole('list')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('AC-12-2 항목 추가 양식에서 주기 입력 위·옆에 문구가 보임', async () => {
    await open(); await openAdd(); const d = dlg('교체 항목 추가'); const t = within(d).getByText(HINT); expect(t).toBeTruthy(); expect(t.compareDocumentPosition(within(d).getByLabelText('km 주기')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('AC-12-3 교체 항목이 0개인 빈 목록에도 문구와 "교체 항목이 없습니다"가 보임', async () => {
    await open(); expect([rowsEl().length, !!screen.queryByText(HINT), !!screen.queryByText('교체 항목이 없습니다')]).toEqual([0, true, true])
  })
  it('AC-12-4(컴포넌트 범위) 탭을 떠났다(언마운트) 돌아와도(다시 마운트) 문구가 다시 보이고 닫기 버튼이 없음. 실제 하위 탭 전환은 MPR-38', async () => {
    item('a', { name: 'a' }); const v = render(<Host />); await screen.findAllByRole('button', { name: /항목 추가/ }); v.unmount(); expect(screen.queryByText(HINT)).toBeNull(); render(<Host />); await screen.findByText(HINT); expect(screen.getByText(HINT).closest('p')!.querySelector('button')).toBeNull()
  })
})

describe('불러오기 상태', () => {
  it('기록 읽기 실패 → MSG-04와 "다시 시도", 누르면 다시 읽어 목록 표시', async () => {
    item('a', { name: 'a' }); db.fail['api.listRecords'] = true; render(<Host />); await screen.findByText('차계부 데이터를 불러오지 못했습니다'); db.fail['api.listRecords'] = false; fireEvent.click(screen.getByRole('button', { name: '다시 시도' })); await waitFor(() => expect(rowsEl()).toHaveLength(1))
  })
})
