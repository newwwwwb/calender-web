// MPR-35·36 QA 임시 스크립트: 진짜 useCarbook 훅(가짜 백엔드·진짜 calendarLink)에 진짜 DueDatesTab·DueDateForm을 물려 AC-07·15의 화면 동작을 확인한다(npm test 미포함). MPR-27·33·34 스크립트와 같은 틀.
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
import DueDatesTab from '../../../src/carbook/components/DueDatesTab'
import type { CarbookState } from '../../../src/carbook/state/useCarbook'

afterEach(cleanup)
let ctl: CarbookState
function Host() {
  const c = useCarbook('user-1'); ctl = c
  return <DueDatesTab dueDates={c.dueDates} state={c.loadState} onRetry={c.retryLoad} onSave={c.saveDueDate} onDelete={c.deleteDueDate} onRetryCalendar={(id) => c.retryCalendar({ type: 'due', id })} />
}
const open = async () => { render(<Host />); await screen.findByText('보험 만기') }
const rowOf = (label: string) => screen.getAllByRole('listitem').find((li) => li.querySelector('span')!.textContent === label)!
const btns = (label: string) => within(rowOf(label)).queryAllByRole('button').map((b) => b.textContent)
const shown = () => screen.queryAllByRole('dialog').filter((d) => (d.parentElement as HTMLElement).style.pointerEvents !== 'none')
const gone = () => waitFor(() => expect(shown()).toHaveLength(0), { timeout: 3000 })
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const dateInput = () => screen.getByLabelText(/만기일 \(필수\)/) as HTMLInputElement
const put = (v: string) => fireEvent.change(dateInput(), { target: { value: v } })
const saveBtn = () => within(shown()[0]).getByRole('button', { name: '저장' })
const ISO = /\d{4}-\d{2}-\d{2}/

describe('AC-07-3 자동 추정 없음', () => {
  it('만기일이 하나도 없는 차량: 세 종류 모두 "날짜 없음", 날짜 문자열 없음, "입력" 버튼만', async () => {
    await open(); for (const l of ['보험 만기', '자동차세 납부', '정기검사']) { expect(rowOf(l).textContent).toContain('날짜 없음'); expect(rowOf(l).textContent).not.toMatch(ISO); expect(btns(l)).toEqual(['입력']) }
    expect(screen.getAllByRole('listitem')).toHaveLength(3); expect(db.log.filter((l: string) => l.startsWith('events:'))).toEqual([])
  })
})

describe('AC-07-1·2·4·5·6 입력·수정·삭제·오류·실패', () => {
  it('AC-07-1 보험 만기 2027-03-10 입력·저장 → 만기일 탭에 2027-03-10, 일정 "[내 차] 보험 만기"가 그 날짜에', async () => {
    await open(); click('보험 만기 입력'); await screen.findByRole('dialog', { name: '보험 만기 만기일 입력' }); expect(dateInput().value).toBe(''); put('2027-03-10'); fireEvent.click(saveBtn()); await gone()
    expect(rowOf('보험 만기').textContent).toContain('2027-03-10'); expect([db.dues.length, db.events[0].title, db.events[0].start_at]).toEqual([1, '[내 차] 보험 만기', '2027-03-10'])
  })
  it('AC-07-6 값이 있는 종류는 "입력"이 없고 "수정"·"삭제"만. 나머지 두 종류는 "입력"만', async () => {
    seedDue('d1', 'insurance', '2027-03-10', null); await open(); expect(btns('보험 만기')).toEqual(['수정', '삭제']); expect(btns('자동차세 납부')).toEqual(['입력']); expect(btns('정기검사')).toEqual(['입력'])
  })
  it('AC-07-2 2027-04-01로 수정 → 화면·일정 날짜 변경, 값이 미리 채워져 있음. 삭제: 취소하면 그대로, "삭제"하면 "날짜 없음"·"입력"으로 돌아가고 일정도 사라짐', async () => {
    seedDue('d1', 'insurance', '2027-03-10'); seedEvent('ev-d1', '[내 차] 보험 만기', '2027-03-10'); await open()
    click('보험 만기 수정'); await screen.findByRole('dialog', { name: '보험 만기 만기일 수정' }); expect(dateInput().value).toBe('2027-03-10'); put('2027-04-01'); fireEvent.click(saveBtn()); await gone()
    expect(rowOf('보험 만기').textContent).toContain('2027-04-01'); expect(db.events.map((e: Row) => e.start_at)).toEqual(['2027-04-01'])
    click('보험 만기 삭제'); const c = await screen.findByRole('dialog', { name: '삭제 확인' }); expect(within(c).getByText(/만기일\(보험 만기\)을\(를\) 삭제할까요/)).toBeTruthy(); fireEvent.click(within(c).getByRole('button', { name: '취소' })); await gone()
    expect([rowOf('보험 만기').textContent!.includes('2027-04-01'), db.dues.length, db.events.length]).toEqual([true, 1, 1])
    click('보험 만기 삭제'); fireEvent.click(within(await screen.findByRole('dialog', { name: '삭제 확인' })).getByRole('button', { name: '삭제' })); await gone()
    expect([rowOf('보험 만기').textContent!.includes('날짜 없음'), btns('보험 만기'), db.dues.length, db.events.length]).toEqual([true, ['입력'], 0, 0])
  })
  it('AC-07-4 날짜를 비우고 저장 → 칸 아래 오류(연결됨, aria-invalid), 저장 요청 0건, 양식 유지', async () => {
    await open(); click('보험 만기 입력'); await screen.findByRole('dialog'); fireEvent.click(saveBtn()); const e = screen.getByText(/을\(를\) (입력|올바른)/); expect(e.textContent).toContain('입력해 주세요')
    expect(dateInput().getAttribute('aria-invalid')).toBe('true'); expect(document.getElementById(dateInput().getAttribute('aria-describedby')!)?.textContent).toContain('입력해 주세요'); expect(db.cnt['api.createDueDate']).toBeUndefined(); expect(shown()).toHaveLength(1)
  })
  it('AC-07-5 올바른 날짜를 넣고 네트워크가 끊긴 채 저장 → MSG-01 토스트, 입력값 유지, 양식 열림, 만기일 탭 값 그대로(날짜 없음), 일정 없음', async () => {
    await open(); db.fail['api.createDueDate'] = true; click('보험 만기 입력'); await screen.findByRole('dialog'); put('2027-03-10'); fireEvent.click(saveBtn()); await waitFor(() => expect(toasts()).toEqual([MSG01]))
    expect([dateInput().value, shown().length, rowOf('보험 만기').textContent!.includes('날짜 없음'), db.events.length]).toEqual(['2027-03-10', 1, true, 0]); await waitFor(() => expect((saveBtn() as HTMLButtonElement).disabled).toBe(false))
  })
  it('AC-07-5 수정 저장 실패: 기존 값(2027-03-10) 그대로·입력값 유지', async () => {
    seedDue('d1', 'insurance', '2027-03-10', null); await open(); db.fail['api.updateDueDate'] = true; click('보험 만기 수정'); await screen.findByRole('dialog'); put('2027-04-01'); fireEvent.click(saveBtn()); await waitFor(() => expect(toasts()).toEqual([MSG01]))
    expect([dateInput().value, rowOf('보험 만기').textContent!.includes('2027-03-10')]).toEqual(['2027-04-01', true])
  })
  it('삭제 실패 → MSG-03, 확인창 유지, 만기일 그대로', async () => {
    seedDue('d1', 'insurance', '2027-03-10', null); await open(); db.fail['api.deleteDueDate'] = true; click('보험 만기 삭제'); fireEvent.click(within(await screen.findByRole('dialog', { name: '삭제 확인' })).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(toasts()).toEqual([MSG03])); expect([shown().length, db.dues.length]).toEqual([1, 1])
  })
  it('같은 저장 버튼을 연달아 눌러도 요청은 1번', async () => {
    await open(); let release!: () => void; db.gate['api.createDueDate'] = new Promise<void>((r) => { release = r }); click('보험 만기 입력'); await screen.findByRole('dialog'); put('2027-03-10'); const b = saveBtn(); fireEvent.click(b); fireEvent.click(b); fireEvent.submit(b.closest('form')!)
    await waitFor(() => expect(db.cnt['api.createDueDate']).toBe(1)); release(); await gone(); expect(db.cnt['api.createDueDate']).toBe(1)
  })
  it('AC-08-5(만기일) 일정 쓰기 실패 → 그 행에 "캘린더 반영 실패, 다시 시도"(이름에 보험 만기), 누르면 사라지고 일정 1건, 포커스가 같은 행으로', async () => {
    seedDue('d1', 'insurance', '2027-03-10', 'ev-d1'); db.fail['ev.upsert'] = true; await open(); const btn = await screen.findByRole('button', { name: /캘린더 반영 실패, 다시 시도, 보험 만기/ }); db.fail['ev.upsert'] = false; btn.focus(); fireEvent.click(btn)
    await waitFor(() => expect(screen.queryByRole('button', { name: /캘린더 반영 실패/ })).toBeNull()); expect(db.events).toHaveLength(1); await waitFor(() => expect(rowOf('보험 만기').contains(document.activeElement)).toBe(true))
  })
  it('불러오기 실패 → MSG-04와 "다시 시도"', async () => {
    db.fail['api.listVehicles'] = true; render(<Host />); await screen.findByText('차계부 데이터를 불러오지 못했습니다'); db.fail['api.listVehicles'] = false; fireEvent.click(screen.getByRole('button', { name: '다시 시도' })); await screen.findByText('보험 만기')
  })
})

describe('AC-15-1~4 자동차세 빠른 선택', () => {
  const carTax = async () => { await open(); click('자동차세 납부 입력'); await screen.findByRole('dialog', { name: '자동차세 납부 만기일 입력' }) }
  it('AC-15-1 "12월 31일" → 날짜 칸 2026-12-31(오늘 2026-11-05 기준), 낭독 알림 "만기일 칸 값: 2026-12-31", 요청 0건', async () => {
    await carTax(); fireEvent.click(screen.getByRole('button', { name: '12월 31일' })); expect(dateInput().value).toBe('2026-12-31'); await waitFor(() => expect(screen.getByRole('status').textContent).toBe('만기일 칸 값: 2026-12-31')); expect(db.cnt['api.createDueDate']).toBeUndefined()
  })
  it('AC-15-2 "6월 30일" → 2027-06-30(이미 지나 다음 해)', async () => {
    await carTax(); fireEvent.click(screen.getByRole('button', { name: '6월 30일' })); expect(dateInput().value).toBe('2027-06-30')
  })
  it('AC-15-3 버튼을 누르고 저장하지 않고 닫으면(취소) 만기일·일정 없음, 요청 0건, 탭은 "날짜 없음"', async () => {
    await carTax(); fireEvent.click(screen.getByRole('button', { name: '12월 31일' })); fireEvent.click(within(shown()[0]).getByRole('button', { name: '취소' })); await gone()
    expect([db.dues.length, db.events.length, db.cnt['api.createDueDate'], rowOf('자동차세 납부').textContent!.includes('날짜 없음')]).toEqual([0, 0, undefined, true])
  })
  it('AC-15-3 Esc로 닫아도 미저장', async () => {
    await carTax(); fireEvent.click(screen.getByRole('button', { name: '6월 30일' })); fireEvent.keyDown(document, { key: 'Escape' }); await gone(); expect([db.dues.length, db.events.length]).toEqual([0, 0])
  })
  it('빠른 선택 뒤 "저장" → 그 날짜로 저장되고 일정 "[내 차] 자동차세 납부"', async () => {
    await carTax(); fireEvent.click(screen.getByRole('button', { name: '12월 31일' })); fireEvent.click(saveBtn()); await gone(); expect([db.dues[0].dueDate, db.events[0].title, db.events[0].start_at]).toEqual(['2026-12-31', '[내 차] 자동차세 납부', '2026-12-31'])
  })
  it('AC-15-4 보험·정기검사 입력 양식에는 빠른 선택 버튼이 없음(수정 양식도)', async () => {
    seedDue('d2', 'inspection', '2027-05-01', null); await open()
    for (const n of ['보험 만기 입력', '정기검사 수정']) { click(n); await screen.findByRole('dialog'); expect([screen.queryByRole('group', { name: '빠른 선택' }), screen.queryByRole('button', { name: '12월 31일' }), screen.queryByRole('button', { name: '6월 30일' })]).toEqual([null, null, null]); fireEvent.click(within(shown()[0]).getByRole('button', { name: '취소' })); await gone() }
  })
  it('자동차세 수정 양식에는 빠른 선택이 있고 기존 값이 채워져 있음', async () => {
    seedDue('d3', 'car_tax', '2027-01-15', null); await open(); click('자동차세 납부 수정'); await screen.findByRole('dialog'); expect([dateInput().value, !!screen.queryByRole('group', { name: '빠른 선택' })]).toEqual(['2027-01-15', true])
  })
})

import { validateDueDate } from '../../../src/carbook/domain/validation'
describe('AC-07-4 존재하지 않는 날짜(검증 함수 직접)', () => {
  it('2027-02-30 → MSG-15, 빈 값 → MSG-05, 2027-03-10 → 통과. (Chrome 날짜 칸은 2027-02-30을 값으로 만들지 못해 화면에서는 빈 값·범위 밖 연도로 같은 오류가 나온다)', () => {
    expect(validateDueDate('2027-02-30')).toEqual({ ok: false, error: '만기일을(를) 올바른 날짜로 입력해 주세요' }); expect(validateDueDate('')).toEqual({ ok: false, error: '만기일을(를) 입력해 주세요' }); expect(validateDueDate('2027-03-10')).toEqual({ ok: true, value: '2027-03-10' })
  })
})
