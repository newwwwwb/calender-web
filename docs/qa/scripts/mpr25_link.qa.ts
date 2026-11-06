// MPR-25 QA 임시 스크립트: 실제 supabase-js + PostgREST 요청 번역기 + PGlite(RLS·정책 포함)로 calendarLink의 AC-08-1·4·6·10·13과 예외 흐름을 확인한다(실제 Supabase 아님, npm test 미포함).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { openDb, as } from './pg_env.mjs'

const PGLITE = process.env.QA_PGLITE as string
interface Req { method: string; url: URL; headers: Headers; body: unknown }
const h = vi.hoisted(() => ({
  reqs: [] as unknown[], uid: '' as string, client: true, db: null as null | { exec: (s: string) => Promise<unknown>; query: (q: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; affectedRows?: number }> },
  override: null as null | ((r: unknown) => Response | null), lock: Promise.resolve() as Promise<unknown>,
}))

const jres = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const STATUS: Record<string, number> = { '42501': 403, '23503': 409, '23505': 409, '28000': 401 }
const fail = (err: unknown) => jres(STATUS[String(err)] ?? 400, { code: String(err), message: 'db error ' + String(err) })
const filt = (u: URL, col: string) => { const v = u.searchParams.get(col); return v ?? null }

// PostgREST 요청 중 calendarLink가 쓰는 5가지 모양만 PGlite SQL로 번역한다(RLS는 사용자 역할로 실제 적용)
async function translate(req: Req): Promise<Response> {
  const uid = h.uid; const p = req.url.pathname.replace('/rest/v1', ''); const db = h.db!
  const run = (q: string, params?: unknown[]) => { const t = h.lock.then(() => as(db, uid, q, params)); h.lock = t.catch(() => null); return t }
  if (p === '/rpc/ensure_carbook_category') {
    const r = await run('select ensure_carbook_category() as v'); return r.err ? fail(r.err) : jres(200, r.rows[0].v)
  }
  if (p === '/events') {
    const idf = filt(req.url, 'id'), uf = filt(req.url, 'user_id')
    const ids = idf?.startsWith('in.(') ? idf.slice(4, -1).split(',') : idf?.startsWith('eq.') ? [idf.slice(3)] : null
    if (req.method === 'GET') {
      const cols = req.url.searchParams.get('select')!
      const r = await run(`select ${cols} from events where user_id = $1 and id = any($2::uuid[])`, [uf!.slice(3), ids])
      return r.err ? fail(r.err) : jres(200, r.rows)
    }
    if (req.method === 'POST') {
      const row = req.body as Record<string, unknown>; const cols = Object.keys(row)
      const q = `insert into events (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}${cols[i] === 'excluded_dates' ? '::text[]' : cols[i] === 'recurrence' ? '::jsonb' : ''}`).join(',')}) on conflict (id) do update set ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`
      const r = await run(q, cols.map((c) => row[c])); return r.err ? fail(r.err) : jres(201, null)
    }
    if (req.method === 'DELETE') { const r = await run('delete from events where id = $1 and user_id = $2 returning id', [ids![0], uf!.slice(3)]); return r.err ? fail(r.err) : jres(200, r.rows) }
    if (req.method === 'PATCH') {
      const r = await run('update events set category_id = $1 where user_id = $2 and id = any($3::uuid[])', [(req.body as { category_id: string }).category_id, uf!.slice(3), ids]); return r.err ? fail(r.err) : jres(204, null)
    }
  }
  return jres(404, { code: 'PGRST404', message: 'unsupported in QA shim ' + req.method + ' ' + p })
}

vi.mock('../../../src/lib/supabaseClient', () => ({
  get supabase() {
    if (!h.client) return null
    return createClient('http://localhost:54321', 'anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
          const req: Req = { method: init?.method ?? 'GET', url, headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined }
          h.reqs.push(req)
          const o = h.override?.(req); if (o) return o
          return translate(req)
        },
      },
    })
  },
}))

import { createCalendarLink } from '../../../src/carbook/data/calendarLink'
import { CarbookError } from '../../../src/carbook/data/request'
import { dueEventTitle, itemEventTitle } from '../../../src/carbook/domain/titles'

const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b'
const ev = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const reqs = () => h.reqs as Req[]
const q = async (sql: string, params?: unknown[]) => (await h.db!.query(sql, params)).rows
let catA = ''

beforeAll(async () => {
  h.db = await openDb(PGLITE) as never
  await h.db!.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`)
  catA = (await q('select carbook_category_id($1) as v', [A]))[0].v as string
})
afterAll(() => { vi.restoreAllMocks() })
beforeEach(async () => {
  h.reqs.length = 0; h.uid = A; h.client = true; h.override = null; h.lock = Promise.resolve()
  await h.db!.exec('delete from events; delete from categories')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
const evCount = async (id?: string) => Number((await q(id ? 'select count(*) c from events where id=$1' : 'select count(*) c from events', id ? [id] : undefined))[0].c)
const catCount = async () => Number((await q(`select count(*) c from categories where user_id=$1 and name='차계부'`, [A]))[0].c)

describe('AC-08-1 교체 항목 일정 생성', () => {
  it("엔진오일 다음 교체일 2027-11-05, 별칭 '내 차' → '차계부' 카테고리의 종일 일정 1건", async () => {
    const link = createCalendarLink(A)
    const title = itemEventTitle('내 차', '엔진오일')
    expect(await link.syncEvent({ eventId: ev(1), title, date: '2027-11-05' })).toBe('written')
    const rows = await q('select * from events')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: ev(1), user_id: A, title: '[내 차] 엔진오일 교체 예정', memo: null, category_id: catA, all_day: true, start_at: '2027-11-05', end_at: '2027-11-05', recurrence: null })
    expect(await q(`select name, user_id from categories where id=$1`, [catA])).toEqual([{ name: '차계부', user_id: A }])
  })
  it('같은 내용으로 다시 동기화하면 unchanged이고 쓰기 요청이 없음(읽기 1번)', async () => {
    const link = createCalendarLink(A); const spec = { eventId: ev(1), title: '[내 차] 엔진오일 교체 예정', date: '2027-11-05' }
    await link.syncEvent(spec); h.reqs.length = 0
    expect(await link.syncEvent(spec)).toBe('unchanged')
    expect(reqs().filter((r) => r.method !== 'GET')).toHaveLength(0); expect(reqs().filter((r) => r.method === 'GET')).toHaveLength(1)
  })
  it('날짜·제목이 달라지면 같은 id 행을 덮어씀(1건 유지, BR-25)', async () => {
    const link = createCalendarLink(A)
    await link.syncEvent({ eventId: ev(1), title: '[내 차] 엔진오일 교체 예정', date: '2027-01-04' })
    expect(await link.syncEvent({ eventId: ev(1), title: '[내 차] 엔진오일 교체 예정', date: '2026-12-20' })).toBe('written')
    expect(await q('select start_at, end_at from events')).toEqual([{ start_at: '2026-12-20', end_at: '2026-12-20' }])
    expect(await link.syncEvent({ eventId: ev(1), title: '[우리 차] 엔진오일 교체 예정', date: '2026-12-20' })).toBe('written'); expect(await evCount()).toBe(1)
  })
  it('known을 넘기면 읽기 없이 판정(null=없음→쓰기, 같은 객체→unchanged)', async () => {
    const link = createCalendarLink(A); const spec = { eventId: ev(1), title: 't', date: '2027-11-05' }
    expect(await link.syncEvent(spec, null)).toBe('written'); expect(reqs().filter((r) => r.method === 'GET')).toHaveLength(0)
    expect(await link.syncEvent(spec, { id: ev(1), title: 't', start_at: '2027-11-05', category_id: catA })).toBe('unchanged')
  })
  it('AC-08-3 사용자가 일정을 지웠으면 다시 만듦(항목당 1건)', async () => {
    const link = createCalendarLink(A); const spec = { eventId: ev(1), title: 't', date: '2027-11-05' }
    await link.syncEvent(spec); await q('delete from events'); expect(await link.syncEvent(spec)).toBe('written'); expect(await evCount()).toBe(1)
  })
})

describe('AC-08-4 카테고리 재사용', () => {
  it('고정 id 카테고리가 이미 있으면 하나 더 만들지 않고 그 id를 씀(다른 화면 수명의 link 포함)', async () => {
    const l1 = createCalendarLink(A); const id1 = await l1.ensureCategoryId()
    const l2 = createCalendarLink(A); await l2.syncEvent({ eventId: ev(2), title: 't', date: '2027-01-01' })
    expect(id1).toBe(catA); expect(await catCount()).toBe(1); expect((await q('select category_id from events'))[0].category_id).toBe(catA)
  })
  it('한 link 안에서는 RPC를 한 번만 부름(동시 5번 포함), 모두 같은 id', async () => {
    const link = createCalendarLink(A); const ids = await Promise.all([1, 2, 3, 4, 5].map(() => link.ensureCategoryId()))
    expect(new Set(ids)).toEqual(new Set([catA])); await link.ensureCategoryId()
    expect(reqs().filter((r) => r.url.pathname.endsWith('/rpc/ensure_carbook_category'))).toHaveLength(1)
  })
  it('AC-08-16 수동으로 만든 이름 같은 카테고리는 그대로, 연결 일정은 고정 id 카테고리를 씀', async () => {
    const manual = 'c0000000-0000-4000-8000-0000000000aa'
    await q(`insert into categories(id,user_id,name,color) values ($1,$2,'차계부','#111111')`, [manual, A])
    await q(`insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ($1,$2,'수동 일정',$3,true,'2026-11-01','2026-11-01')`, [ev(9), A, manual])
    await createCalendarLink(A).syncEvent({ eventId: ev(1), title: 't', date: '2027-01-01' })
    expect(Number((await q(`select count(*) c from categories where user_id=$1 and name='차계부'`, [A]))[0].c)).toBe(2)
    expect((await q('select category_id from events where id=$1', [ev(1)]))[0].category_id).toBe(catA)
    expect((await q('select category_id, title from events where id=$1', [ev(9)]))[0]).toEqual({ category_id: manual, title: '수동 일정' })
    expect((await q('select name, color from categories where id=$1', [manual]))[0]).toEqual({ name: '차계부', color: '#111111' })
  })
})

describe('AC-08-6 재시도 중복 없음', () => {
  it('같은 일정을 연속 2번(둘 다 성공) → 1건', async () => {
    const link = createCalendarLink(A); const spec = { eventId: ev(1), title: 't', date: '2027-11-05' }
    await link.syncEvent(spec); await link.syncEvent(spec); expect(await evCount()).toBe(1)
  })
  it('같은 일정을 동시에 2번(둘 다 읽기에서 "없음"을 봄) → 1건', async () => {
    const link = createCalendarLink(A); const spec = { eventId: ev(1), title: 't', date: '2027-11-05' }
    const r = await Promise.all([link.syncEvent(spec), link.syncEvent(spec)]); expect(r).toEqual(['written', 'written']); expect(await evCount()).toBe(1)
  })
  it('쓰기 요청은 id 기준 upsert(on_conflict=id, merge-duplicates)라 id가 같으면 합쳐짐', async () => {
    await createCalendarLink(A).syncEvent({ eventId: ev(1), title: 't', date: '2027-11-05' })
    const w = reqs().find((r) => r.method === 'POST' && r.url.pathname === '/rest/v1/events')!
    expect(w.url.searchParams.get('on_conflict')).toBe('id'); expect(w.headers.get('prefer')).toContain('resolution=merge-duplicates')
  })
})

describe('AC-08-13 두 탭 동시 첫 저장', () => {
  it("카테고리가 없는 상태에서 탭 A는 항목, 탭 B는 만기일을 동시에 처음 저장 → '차계부' 카테고리 1개, 일정 각 1건", async () => {
    expect(await catCount()).toBe(0)
    const tabA = createCalendarLink(A), tabB = createCalendarLink(A)
    await Promise.all([
      tabA.syncEvent({ eventId: ev(1), title: itemEventTitle('내 차', '엔진오일'), date: '2027-11-05' }),
      tabB.syncEvent({ eventId: ev(2), title: dueEventTitle('내 차', 'insurance'), date: '2027-03-10' }),
    ])
    expect(await catCount()).toBe(1)
    expect(await q('select id, category_id, title from events order by id')).toEqual([
      { id: ev(1), category_id: catA, title: '[내 차] 엔진오일 교체 예정' }, { id: ev(2), category_id: catA, title: '[내 차] 보험 만기' }])
  })
  it('같은 항목(같은 eventId)을 두 탭에서 동시에 저장해도 연결 일정은 1건(첫 저장에서 둘 다 카테고리 없음)', async () => {
    const tabA = createCalendarLink(A), tabB = createCalendarLink(A); const spec = { eventId: ev(1), title: 't', date: '2027-11-05' }
    await Promise.all([tabA.syncEvent(spec), tabB.syncEvent(spec)]); expect(await evCount(ev(1))).toBe(1); expect(await catCount()).toBe(1)
  })
  it('탭이 서로 다른 날짜로 같은 항목을 동시에 쓰면 마지막 쓰기가 남고 1건(BR-25 덮어쓰기)', async () => {
    const tabA = createCalendarLink(A), tabB = createCalendarLink(A)
    await Promise.all([tabA.syncEvent({ eventId: ev(1), title: 't', date: '2027-01-04' }), tabB.syncEvent({ eventId: ev(1), title: 't', date: '2026-12-20' })])
    const rows = await q('select start_at from events'); expect(rows).toHaveLength(1); expect(['2027-01-04', '2026-12-20']).toContain(rows[0].start_at)
  })
  it('두 탭에서 여러 항목을 번갈아 동시에 저장(20건): 카테고리 1, 일정 20건', async () => {
    const tabs = [createCalendarLink(A), createCalendarLink(A)]
    await Promise.all(Array.from({ length: 20 }, (_, i) => tabs[i % 2].syncEvent({ eventId: ev(100 + i), title: `t${i}`, date: '2027-01-01' })))
    expect(await catCount()).toBe(1); expect(await evCount()).toBe(20)
  })
})

describe('AC-08-10 번호판 비노출', () => {
  it('번호판 있는 차량이 있어도 연결 일정의 제목·메모에 번호판이 없다(제목은 titles.ts 결과만 쓰고 메모는 null)', async () => {
    const plate = '12가3456'
    const link = createCalendarLink(A)
    await link.syncEvent({ eventId: ev(1), title: itemEventTitle('내 차', '엔진오일'), date: '2027-11-05' })
    await link.syncEvent({ eventId: ev(2), title: dueEventTitle('내 차', 'car_tax'), date: '2026-12-31' })
    const rows = await q('select title, memo from events')
    for (const r of rows) { expect(String(r.title)).not.toContain(plate); expect(r.memo).toBeNull() }
    for (const r of reqs().filter((x) => x.method === 'POST' && x.url.pathname === '/rest/v1/events')) expect(JSON.stringify(r.body)).not.toContain(plate)
  })
})

describe('조회·삭제·재묶기(user_id 필터, 100개씩)', () => {
  it('fetchEvents: 없는 id는 Map에 없음, 250개는 3번에 나눠 조회(각 100개 이하), 요청에 user_id 필터', async () => {
    const link = createCalendarLink(A); await link.syncEvent({ eventId: ev(1), title: 't', date: '2027-01-01' }); h.reqs.length = 0
    const ids = [ev(1), ...Array.from({ length: 249 }, (_, i) => ev(1000 + i))]
    const m = await link.fetchEvents(ids)
    expect([...m.keys()]).toEqual([ev(1)]); expect(m.get(ev(1))).toEqual({ id: ev(1), title: 't', start_at: '2027-01-01', category_id: catA })
    const gets = reqs().filter((r) => r.method === 'GET'); expect(gets).toHaveLength(3)
    for (const g of gets) { expect(g.url.searchParams.get('user_id')).toBe(`eq.${A}`); expect(g.url.searchParams.get('id')!.slice(4, -1).split(',').length).toBeLessThanOrEqual(100); expect(g.url.searchParams.get('select')).toBe('id,title,start_at,category_id') }
    expect(await link.fetchEvents([])).toEqual(new Map()); expect(reqs().filter((r) => r.method === 'GET')).toHaveLength(3)
  })
  it('남의 일정 id: 조회에 안 잡히고, 삭제는 false이며 행이 남고, 재묶기는 바뀌지 않음', async () => {
    await q(`insert into categories(id,user_id,name,color) values ($1,$2,'다른','#222222')`, ['c0000000-0000-4000-8000-0000000000bb', B])
    await q(`insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ($1,$2,'B의 일정',$3,true,'2026-11-01','2026-11-01')`, [ev(50), B, 'c0000000-0000-4000-8000-0000000000bb'])
    const link = createCalendarLink(A)
    expect((await link.fetchEvents([ev(50)])).size).toBe(0); expect(await link.deleteEvent(ev(50))).toBe(false); await link.rebindCategory([ev(50)])
    expect(await q('select title, category_id from events where id=$1', [ev(50)])).toEqual([{ title: 'B의 일정', category_id: 'c0000000-0000-4000-8000-0000000000bb' }])
  })
  it('deleteEvent: 지웠으면 true, 원래 없었으면 false', async () => {
    const link = createCalendarLink(A); await link.syncEvent({ eventId: ev(1), title: 't', date: '2027-01-01' })
    expect(await link.deleteEvent(ev(1))).toBe(true); expect(await link.deleteEvent(ev(1))).toBe(false); expect(await evCount()).toBe(0)
    const d = reqs().find((r) => r.method === 'DELETE')!; expect(d.url.searchParams.get('user_id')).toBe(`eq.${A}`)
  })
  it('AC-08-14 rebindCategory: 분류가 없어진 연결 일정 2건이 새 카테고리에 속함, 넘기지 않은 직접 만든 일정은 그대로', async () => {
    const link = createCalendarLink(A)
    await link.syncEvent({ eventId: ev(1), title: 'a', date: '2027-01-01' }); await link.syncEvent({ eventId: ev(2), title: 'b', date: '2027-01-02' })
    await q(`insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ($1,$2,'직접 만든 일정',null,true,'2026-11-01','2026-11-01')`, [ev(9), A])
    await q('delete from categories where id=$1', [catA])
    expect((await q('select category_id from events where id = any($1::uuid[])', [[ev(1), ev(2)]])).every((r) => r.category_id === null)).toBe(true)
    const fresh = createCalendarLink(A); await fresh.rebindCategory([ev(1), ev(2)])
    expect(await catCount()).toBe(1)
    expect((await q('select category_id from events where id = any($1::uuid[])', [[ev(1), ev(2)]])).map((r) => r.category_id)).toEqual([catA, catA])
    expect((await q('select category_id from events where id=$1', [ev(9)]))[0].category_id).toBeNull()
    h.reqs.length = 0; await fresh.rebindCategory([]); expect(reqs()).toHaveLength(0)
    const ids = Array.from({ length: 230 }, (_, i) => ev(2000 + i)); h.reqs.length = 0; await fresh.rebindCategory(ids)
    expect(reqs().filter((r) => r.method === 'PATCH')).toHaveLength(3)
  })
  it('AC-08-14 분류가 null인 일정을 syncEvent하면 같은 날짜·제목이어도 카테고리를 다시 붙임(written)', async () => {
    const link = createCalendarLink(A); const spec = { eventId: ev(1), title: 't', date: '2027-01-01' }
    await link.syncEvent(spec); await q('delete from categories where id=$1', [catA])
    expect(await createCalendarLink(A).syncEvent(spec)).toBe('written'); expect((await q('select category_id from events'))[0].category_id).toBe(catA)
  })
})

describe('예외 흐름', () => {
  it('23503(카테고리가 그새 지워짐): 기억을 버리고 RPC를 다시 불러 한 번만 다시 씀 → written, RPC 2번', async () => {
    const link = createCalendarLink(A); await link.ensureCategoryId(); await q('delete from categories where id=$1', [catA])
    expect(await link.syncEvent({ eventId: ev(1), title: 't', date: '2027-01-01' })).toBe('written')
    expect(await catCount()).toBe(1); expect((await q('select category_id from events'))[0].category_id).toBe(catA)
    expect(reqs().filter((r) => r.url.pathname.endsWith('/rpc/ensure_carbook_category'))).toHaveLength(2)
  })
  it('23503이 다시 나면 그 오류를 던지고 쓰기는 정확히 2번만 시도', async () => {
    h.override = (r) => { const x = r as Req; return x.method === 'POST' && x.url.pathname === '/rest/v1/events' ? jres(409, { code: '23503', message: 'fk' }) : null }
    await expect(createCalendarLink(A).syncEvent({ eventId: ev(1), title: 't', date: '2027-01-01' })).rejects.toMatchObject({ kind: 'conflict', code: '23503' })
    expect(reqs().filter((r) => r.method === 'POST' && r.url.pathname === '/rest/v1/events')).toHaveLength(2)
  })
  it('다른 오류(500)는 재시도 없이 network로 던짐(쓰기 1번)', async () => {
    h.override = (r) => { const x = r as Req; return x.method === 'POST' && x.url.pathname === '/rest/v1/events' ? jres(500, { code: 'XX000', message: 'boom' }) : null }
    await expect(createCalendarLink(A).syncEvent({ eventId: ev(1), title: 't', date: '2027-01-01' })).rejects.toMatchObject({ kind: 'network' })
    expect(reqs().filter((r) => r.method === 'POST' && r.url.pathname === '/rest/v1/events')).toHaveLength(1)
  })
  it('고정 id 선점(RPC 42501): unknown으로 던져 일정을 쓰지 않음. 실패는 기억되지 않아 선점이 풀리면 다음 호출이 성공', async () => {
    await h.db!.exec(`delete from categories; insert into categories(id,user_id,name,color) values ('${catA}','${B}','남의','#000')`)
    const link = createCalendarLink(A)
    await expect(link.syncEvent({ eventId: ev(1), title: 't', date: '2027-01-01' })).rejects.toMatchObject({ kind: 'unknown', code: '42501' })
    expect(await evCount()).toBe(0); expect(reqs().filter((r) => r.method === 'POST' && r.url.pathname === '/rest/v1/events')).toHaveLength(0)
    await h.db!.exec(`delete from categories where id='${catA}'`)
    expect(await link.ensureCategoryId()).toBe(catA); expect(await link.syncEvent({ eventId: ev(1), title: 't', date: '2027-01-01' })).toBe('written')
  })
  it('로그인 없음(RPC 28000, 401): unknown으로 던짐, 이벤트 쓰기 없음', async () => {
    h.uid = ''
    await expect(createCalendarLink(A).syncEvent({ eventId: ev(1), title: 't', date: '2027-01-01' })).rejects.toMatchObject({ kind: 'unknown', code: '28000' })
    expect(await evCount()).toBe(0)
  })
  it('RPC가 문자열이 아닌 값을 주면 bad_response, 성공이 아니므로 기억되지 않음', async () => {
    h.override = (r) => (((r as Req).url.pathname.endsWith('/rpc/ensure_carbook_category')) ? jres(200, { id: 'x' }) : null)
    const link = createCalendarLink(A); await expect(link.ensureCategoryId()).rejects.toMatchObject({ kind: 'unknown', code: 'bad_response' })
    h.override = null; expect(await link.ensureCategoryId()).toBe(catA)
  })
  it('클라이언트가 없으면(환경변수 없음) unknown/no_client', async () => {
    h.client = false
    await expect(createCalendarLink(A).ensureCategoryId()).rejects.toBeInstanceOf(CarbookError)
    await expect(createCalendarLink(A).fetchEvents([ev(1)])).rejects.toMatchObject({ kind: 'unknown', code: 'no_client' })
    await expect(createCalendarLink(A).deleteEvent(ev(1))).rejects.toMatchObject({ kind: 'unknown', code: 'no_client' })
  })
  it('ensureCategoryId 실패 로그에 일정 제목·번호판이 없음(NFR-31)', async () => {
    h.uid = ''; const spy = vi.mocked(console.error)
    await createCalendarLink(A).syncEvent({ eventId: ev(1), title: '[내 차] 비밀제목', date: '2027-01-01' }).catch(() => null)
    expect(JSON.stringify(spy.mock.calls)).not.toContain('비밀제목')
  })
})
