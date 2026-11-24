// MPR-64 QA: v0.2 data 계층(오류 분류·auth.ts·설정·되돌리기·미입력 항목·일정 memo)을 가짜 Supabase로 직접 호출해 확인하는 테스트
// QA_DATA_DIR(저장소 루트 기준 상대 경로)를 주면 그 폴더의 data 코드를 검사한다(대조 실험용). 기본은 src/carbook/data
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; ops: [string, unknown[]][] }
const h = vi.hoisted(() => ({
  calls: [] as Call[], queue: [] as unknown[], client: true,
  authCalls: [] as [string, unknown[]][], authResult: { error: null } as { error: unknown },
}))

vi.mock('../../../src/lib/supabaseClient', () => ({
  get supabase() {
    if (!h.client) return null
    return {
      auth: {
        signOut: (...a: unknown[]) => { h.authCalls.push(['signOut', a]); return Promise.resolve(h.authResult) },
        signInWithOAuth: (...a: unknown[]) => { h.authCalls.push(['signInWithOAuth', a]); return Promise.resolve(h.authResult) },
      },
      rpc: (name: string) => {
        const call: Call = { table: `rpc:${name}`, ops: [] }
        h.calls.push(call)
        return chain(call)
      },
      from: (table: string) => {
        const call: Call = { table, ops: [] }
        h.calls.push(call)
        return chain(call)
      },
    }
  },
}))

function chain(call: Call): object {
  const p: object = new Proxy({}, {
    get: (_t, name: string) => {
      if (name === 'then') {
        const res = h.queue.shift() ?? { data: null, error: null }
        return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(res).then(ok, ko)
      }
      return (...args: unknown[]) => { call.ops.push([name, args]); return p }
    },
  })
  return p
}

const DIR = process.env.QA_DATA_DIR ? `/${process.env.QA_DATA_DIR.replace(/^\/+/, '')}` : null
const base = DIR ? process.cwd().replace(/\\/g, '/') : ''
const pick = (f: string) => (DIR ? `${base}${DIR}/${f}` : null)
const api: typeof import('../../../src/carbook/data/carbookApi') = pick('carbookApi.ts') ? await import(/* @vite-ignore */ pick('carbookApi.ts')!) : await import('../../../src/carbook/data/carbookApi')
const auth: typeof import('../../../src/carbook/data/auth') = pick('auth.ts') ? await import(/* @vite-ignore */ pick('auth.ts')!) : await import('../../../src/carbook/data/auth')
const cal: typeof import('../../../src/carbook/data/calendarLink') = pick('calendarLink.ts') ? await import(/* @vite-ignore */ pick('calendarLink.ts')!) : await import('../../../src/carbook/data/calendarLink')
const req: typeof import('../../../src/carbook/data/request') = pick('request.ts') ? await import(/* @vite-ignore */ pick('request.ts')!) : await import('../../../src/carbook/data/request')

const ok = (data: unknown, status = 200) => ({ data, error: null, status })
const fail = (code: string | undefined, status: number | undefined) => ({ data: null, error: { code, message: 'x' }, status })
const names = (c: Call) => c.ops.map(([n]) => n)
const args = (c: Call, n: string) => c.ops.find(([k]) => k === n)?.[1]
const kindOf = async (p: Promise<unknown>) => { try { await p; return 'resolved' } catch (e) { return (e as { kind?: string }).kind ?? 'other' } }
const itemRow = (o: Record<string, unknown> = {}) => ({ id: 'i1', vehicle_id: 'v1', name: '엔진오일', interval_km: 10000, interval_months: 12, last_date: null, last_odometer_km: null, event_id: null, created_at: '2026-11-05T00:00:00Z', ...o })

beforeEach(() => {
  h.calls.length = 0; h.queue.length = 0; h.client = true; h.authCalls.length = 0; h.authResult = { error: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('오류 분류(request)', () => {
  // [응답 status, code, 기대 kind]
  const table: Array<[number | undefined, string | undefined, string]> = [
    [401, undefined, 'auth'], [401, '', 'auth'], [401, 'PGRST301', 'auth'], [401, 'PGRST302', 'auth'], [401, 'PGRST303', 'auth'],
    [200, 'PGRST301', 'auth'], [400, 'PGRST302', 'auth'], [undefined, 'PGRST303', 'auth'], [401, '42501', 'auth'], [401, 'XX000', 'auth'],
    [403, '42501', 'unknown'], [403, undefined, 'unknown'], [400, '42501', 'unknown'], [403, 'PGRST301x', 'unknown'],
    [400, 'PGRST300', 'unknown'], [400, 'PGRST304', 'unknown'], [400, 'PGRST205', 'unknown'], [400, '23514', 'unknown'], [404, undefined, 'unknown'],
    [409, '23505', 'conflict'], [409, '23503', 'conflict'], [400, '23503', 'conflict'],
    [0, undefined, 'network'], [500, undefined, 'network'], [503, 'XX', 'network'], [502, 'PGRST301', 'auth'],
  ]
  for (const [status, code, kind] of table) {
    it(`status ${status} code ${JSON.stringify(code)} → ${kind}`, async () => {
      h.queue.push(fail(code, status))
      expect(await kindOf(req.request('t', (() => Promise.resolve(h.queue.shift())) as never))).toBe('resolved' === kind ? 'x' : kind)
    })
  }
  it('auth 오류는 code를 보존한다', async () => {
    h.queue.push(fail('PGRST301', 401))
    try { await req.request('t', (() => Promise.resolve(h.queue.shift())) as never); expect.unreachable() } catch (e) { expect((e as { code?: string }).code).toBe('PGRST301') }
  })
  it('401 응답이 console.error에 code만 남기고 행 내용은 남기지 않는다', async () => {
    h.queue.push(fail('PGRST301', 401))
    await kindOf(req.request('act', (() => Promise.resolve(h.queue.shift())) as never))
    expect((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]).toEqual(['[carbook]', 'act', 'PGRST301'])
  })
})

describe('data/auth.ts', () => {
  it('signOutAll은 인자 없이 signOut을 한 번 부른다(모든 기기)', async () => {
    await auth.signOutAll()
    expect(h.authCalls).toEqual([['signOut', []]])
  })
  it('signOutAll 실패: status 0 → network, AuthRetryableFetchError → network, 그 밖 → unknown, code 보존', async () => {
    h.authResult = { error: { status: 0 } }; expect(await kindOf(auth.signOutAll())).toBe('network')
    h.authResult = { error: { name: 'AuthRetryableFetchError', status: 500 } }; expect(await kindOf(auth.signOutAll())).toBe('network')
    h.authResult = { error: { status: 400, code: 'session_not_found' } }
    try { await auth.signOutAll(); expect.unreachable() } catch (e) { expect((e as { kind: string }).kind).toBe('unknown'); expect((e as { code?: string }).code).toBe('session_not_found') }
  })
  it('startGoogleLogin은 google + redirectTo만 넘기고, 오류는 던진다', async () => {
    await auth.startGoogleLogin('http://localhost:5173/car')
    expect(h.authCalls).toEqual([['signInWithOAuth', [{ provider: 'google', options: { redirectTo: 'http://localhost:5173/car' } }]]])
    h.authResult = { error: { status: 0 } }; expect(await kindOf(auth.startGoogleLogin('x'))).toBe('network')
    h.authResult = { error: { status: 400 } }; expect(await kindOf(auth.startGoogleLogin('x'))).toBe('unknown')
  })
  it('클라이언트가 없으면 unknown:no_client', async () => {
    h.client = false
    for (const f of [() => auth.signOutAll(), () => auth.startGoogleLogin('x')]) {
      try { await f(); expect.unreachable() } catch (e) { expect(e).toMatchObject({ kind: 'unknown', code: 'no_client' }) }
    }
  })
  const L = (search: string, hash: string) => auth.readLoginRedirectError({ search, hash })
  it('readLoginRedirectError: error·error_description 키만 본다', () => {
    expect(L('?error=access_denied&error_description=x', '')).toBe(true)
    expect(L('', '#error=server_error')).toBe(true)
    expect(L('?error_description=only', '')).toBe(true)
    expect(L('', '#error_description=only&a=1')).toBe(true)
    expect(L('?a=1', '#access_token=abc&refresh_token=d')).toBe(false)
    expect(L('', '')).toBe(false)
    expect(L('?errors=1', '#err=1')).toBe(false)
    expect(L('?x=error', '')).toBe(false) // 값이 error여도 키가 아니면 false
    expect(L('?error=', '')).toBe(true) // 값이 비어도 키가 있으면 true
  })
  it('readLoginRedirectError는 던지지 않고 입력을 바꾸지 않는다', () => {
    const loc = { search: '?error=a', hash: '#error=b' }
    expect(() => auth.readLoginRedirectError(loc)).not.toThrow()
    expect(loc).toEqual({ search: '?error=a', hash: '#error=b' })
  })
})

describe('설정 API', () => {
  it('getSettings: car_settings에서 default_vehicle_id 한 열만 읽고 .retry(false)·maybeSingle', async () => {
    h.queue.push(ok({ default_vehicle_id: 'v1' }))
    expect(await api.getSettings()).toEqual({ defaultVehicleId: 'v1' })
    const c = h.calls[0]
    expect(c.table).toBe('car_settings')
    expect(args(c, 'select')).toEqual(['default_vehicle_id'])
    expect(args(c, 'retry')).toEqual([false])
    expect(names(c)).toContain('maybeSingle')
  })
  it('getSettings: 행이 없거나 열이 null이면 null', async () => {
    h.queue.push(ok(null)); expect(await api.getSettings()).toEqual({ defaultVehicleId: null })
    h.queue.push(ok({ default_vehicle_id: null })); expect(await api.getSettings()).toEqual({ defaultVehicleId: null })
  })
  it('getSettings 실패: 테이블 없음 PGRST205 → unknown, 401 → auth, 500 → network', async () => {
    h.queue.push(fail('PGRST205', 404)); expect(await kindOf(api.getSettings())).toBe('unknown')
    h.queue.push(fail('PGRST301', 401)); expect(await kindOf(api.getSettings())).toBe('auth')
    h.queue.push(fail(undefined, 500)); expect(await kindOf(api.getSettings())).toBe('network')
  })
  it('setDefaultVehicle: default_vehicle_id 한 열만 upsert(onConflict user_id), user_id는 보내지 않는다', async () => {
    h.queue.push(ok({ default_vehicle_id: 'v2' }))
    expect(await api.setDefaultVehicle('v2')).toEqual({ defaultVehicleId: 'v2' })
    const c = h.calls[0]
    expect(c.table).toBe('car_settings')
    expect(args(c, 'upsert')).toEqual([{ default_vehicle_id: 'v2' }, { onConflict: 'user_id' }])
    expect(args(c, 'select')).toEqual(['default_vehicle_id'])
    expect(names(c)).toContain('single')
  })
  it('setDefaultVehicle(null)은 열을 null로 보내고 null을 돌려준다', async () => {
    h.queue.push(ok({ default_vehicle_id: null }))
    expect(await api.setDefaultVehicle(null)).toEqual({ defaultVehicleId: null })
    expect(args(h.calls[0], 'upsert')).toEqual([{ default_vehicle_id: null }, { onConflict: 'user_id' }])
  })
  it('setDefaultVehicle 실패: 403/42501 → unknown(auth 아님), 23503 → conflict, 401 → auth', async () => {
    h.queue.push(fail('42501', 403)); expect(await kindOf(api.setDefaultVehicle('x'))).toBe('unknown')
    h.queue.push(fail('23503', 409)); expect(await kindOf(api.setDefaultVehicle('x'))).toBe('conflict')
    h.queue.push(fail('PGRST301', 401)); expect(await kindOf(api.setDefaultVehicle('x'))).toBe('auth')
  })
})

describe('resetItemCycles', () => {
  const rows = [
    { id: 'a', userId: 'u1', vehicleId: 'v1', name: ' 엔진오일 ', intervalKm: 10000, intervalMonths: 12 },
    { id: 'b', userId: 'u1', vehicleId: 'v1', name: '에어컨 필터', intervalKm: 10000, intervalMonths: null },
  ]
  it('한 번의 upsert로 정확히 여섯 열만 보낸다(이름은 그대로, 없는 주기는 null)', async () => {
    h.queue.push(ok([itemRow({ id: 'a' }), itemRow({ id: 'b' })]))
    const out = await api.resetItemCycles(rows)
    expect(h.calls.length).toBe(1)
    const [payload, opt] = args(h.calls[0], 'upsert') as [Record<string, unknown>[], unknown]
    expect(opt).toEqual({ onConflict: 'id' })
    expect(payload).toEqual([
      { id: 'a', user_id: 'u1', vehicle_id: 'v1', name: ' 엔진오일 ', interval_km: 10000, interval_months: 12 },
      { id: 'b', user_id: 'u1', vehicle_id: 'v1', name: '에어컨 필터', interval_km: 10000, interval_months: null },
    ])
    for (const r of payload) expect(Object.keys(r).sort()).toEqual(['id', 'interval_km', 'interval_months', 'name', 'user_id', 'vehicle_id'])
    for (const col of ['last_date', 'last_odometer_km', 'event_id', 'created_at']) for (const r of payload) expect(col in r).toBe(false)
    expect(out.map((i) => i.id)).toEqual(['a', 'b'])
    expect(out[0].lastDate).toBeNull() // 응답의 미입력 항목이 그대로 null
  })
  it('실패하면 던진다(401 → auth, 500 → network)', async () => {
    h.queue.push(fail('PGRST301', 401)); expect(await kindOf(api.resetItemCycles(rows))).toBe('auth')
    h.queue.push(fail(undefined, 500)); expect(await kindOf(api.resetItemCycles(rows))).toBe('network')
  })
})

describe('미입력(last_date null) 항목', () => {
  it('toItem: last_date null을 null로 돌려준다(listItems)', async () => {
    h.queue.push(ok([itemRow(), itemRow({ id: 'i2', last_date: '2026-05-01', last_odometer_km: 40000 })]))
    const out = await api.listItems()
    expect(out[0]).toMatchObject({ lastDate: null, lastOdometerKm: null })
    expect(out[1]).toMatchObject({ lastDate: '2026-05-01', lastOdometerKm: 40000 })
  })
  it('createItems: lastDate·lastOdometerKm가 null인 행을 null로 보낸다', async () => {
    h.queue.push(ok([itemRow()]))
    await api.createItems('v1', [{ id: 'i1', name: '엔진오일', intervalKm: 10000, intervalMonths: 12, lastDate: null, lastOdometerKm: null, eventId: null }])
    const [payload] = args(h.calls[0], 'upsert') as [Record<string, unknown>[]]
    expect(payload[0]).toMatchObject({ id: 'i1', vehicle_id: 'v1', last_date: null, last_odometer_km: null, event_id: null })
  })
  it('createItems: 값이 있는 행(v0.1 형태)은 값을 그대로 보낸다', async () => {
    h.queue.push(ok([itemRow({ last_date: '2026-11-05', last_odometer_km: 100 })]))
    await api.createItems('v1', [{ id: 'i1', name: '엔진오일', intervalKm: 10000, intervalMonths: 12, lastDate: '2026-11-05', lastOdometerKm: 100, eventId: null }])
    expect((args(h.calls[0], 'upsert') as [Record<string, unknown>[]])[0][0]).toMatchObject({ last_date: '2026-11-05', last_odometer_km: 100 })
  })
  it('fillMissingItemOdometer: 차량·last_odometer_km is null·last_date is not null 세 조건으로 update한다', async () => {
    h.queue.push(ok([itemRow({ last_date: '2026-11-05', last_odometer_km: 48000 })]))
    const out = await api.fillMissingItemOdometer('v1', 48000)
    const c = h.calls[0]
    expect(c.table).toBe('car_maintenance_items')
    expect(args(c, 'update')).toEqual([{ last_odometer_km: 48000 }])
    expect(c.ops.filter(([n]) => n === 'eq')).toEqual([['eq', ['vehicle_id', 'v1']]])
    expect(c.ops.filter(([n]) => n === 'is')).toEqual([['is', ['last_odometer_km', null]]])
    expect(c.ops.filter(([n]) => n === 'not')).toEqual([['not', ['last_date', 'is', null]]])
    expect(out).toHaveLength(1)
    expect(out[0].lastOdometerKm).toBe(48000)
  })
  it('fillMissingItemOdometer: 바뀐 행이 없으면 빈 배열, 실패는 던진다', async () => {
    h.queue.push(ok([])); expect(await api.fillMissingItemOdometer('v1', 1)).toEqual([])
    h.queue.push(ok(null)); expect(await api.fillMissingItemOdometer('v1', 1)).toEqual([])
    h.queue.push(fail(undefined, 500)); expect(await kindOf(api.fillMissingItemOdometer('v1', 1))).toBe('network')
  })
  it('updateItem의 수정 열: 이름·주기·마지막 교체일·주행거리 다섯 열만(event_id·created_at 제외)', async () => {
    h.queue.push(ok(itemRow({ last_date: '2026-06-01', last_odometer_km: 40000 })))
    await api.updateItem('i1', { name: '엔진오일', intervalKm: 10000, intervalMonths: 12, lastDate: '2026-06-01', lastOdometerKm: 40000 })
    const u = (args(h.calls[0], 'update') as [Record<string, unknown>])[0]
    expect(Object.keys(u).sort()).toEqual(['interval_km', 'interval_months', 'last_date', 'last_odometer_km', 'name'])
  })
})

describe('일정 memo 동기화(calendarLink, AC-26-1~5)', () => {
  const MEMO = '주행거리 기준 추정 날짜입니다. 기록이 쌓이면 바뀝니다'
  const spec = (memo?: string | null) => ({ eventId: 'e1', title: '[차] 엔진오일 교체 예정', date: '2027-01-04' as const, ...(memo === undefined ? {} : { memo }) })
  const existing = (memo: string | null | undefined, over: Record<string, unknown> = {}) => ({ id: 'e1', title: '[차] 엔진오일 교체 예정', start_at: '2027-01-04', category_id: 'cat', memo, ...over })
  const upserts = () => h.calls.filter((c) => c.table === 'events' && names(c).includes('upsert'))
  const link = () => { h.queue.push(ok('cat')); return cal.createCalendarLink('u1') }

  it('fetchEvents는 memo 열까지 읽는다', async () => {
    const l = cal.createCalendarLink('u1')
    h.queue.push(ok([existing('m')]))
    const m = await l.fetchEvents(['e1'])
    expect(args(h.calls[0], 'select')).toEqual(['id,title,start_at,category_id,memo'])
    expect(m.get('e1')?.memo).toBe('m')
  })
  it('AC-26-4 날짜·제목·카테고리가 같고 memo만 다르면(없음 → MSG-28) 기록하고 memo가 MSG-28이다', async () => {
    const l = link()
    expect(await l.syncEvent(spec(MEMO), existing(null))).toBe('written')
    const row = (args(upserts()[0], 'upsert') as [Record<string, unknown>])[0]
    expect(row).toMatchObject({ id: 'e1', title: '[차] 엔진오일 교체 예정', start_at: '2027-01-04', end_at: '2027-01-04', memo: MEMO, user_id: 'u1', color: null, recurrence: null, excluded_dates: null, all_day: true, category_id: 'cat' })
  })
  it('AC-26-3 km 메모가 있던 일정이 개월 기준이 되면(memo 없음) memo를 비워 기록한다', async () => {
    const l = link()
    expect(await l.syncEvent(spec(null), existing(MEMO))).toBe('written')
    expect((args(upserts()[0], 'upsert') as [Record<string, unknown>])[0].memo).toBeNull()
  })
  it('같은 memo면 쓰지 않는다(unchanged, 쓰기 0건)', async () => {
    let l = link(); expect(await l.syncEvent(spec(MEMO), existing(MEMO))).toBe('unchanged')
    l = link(); expect(await l.syncEvent(spec(null), existing(null))).toBe('unchanged')
    expect(upserts()).toHaveLength(0)
  })
  it('memo의 null·빈 문자열·undefined는 같게 본다(AC-26-2·AC-28-5 불필요한 쓰기 방지)', async () => {
    for (const [a, b] of [[null, ''], ['', null], [undefined, null], [null, undefined], ['', undefined]] as const) {
      const l = link()
      expect(await l.syncEvent(spec(a as never), existing(b as never))).toBe('unchanged')
    }
    expect(upserts()).toHaveLength(0)
  })
  it('날짜·제목·카테고리가 다르면 memo가 같아도 기록한다', async () => {
    let l = link(); expect(await l.syncEvent(spec(MEMO), existing(MEMO, { start_at: '2027-01-05' }))).toBe('written')
    l = link(); expect(await l.syncEvent(spec(MEMO), existing(MEMO, { title: '다른' }))).toBe('written')
    l = link(); expect(await l.syncEvent(spec(MEMO), existing(MEMO, { category_id: 'other' }))).toBe('written')
    expect(upserts()).toHaveLength(3)
  })
  it('일정이 없으면(known=null) 새로 만들며 memo를 넣는다. memo를 안 준 spec(만기일)은 null이다(AC-26-5)', async () => {
    let l = link(); await l.syncEvent(spec(MEMO), null)
    l = link(); await l.syncEvent(spec(), null)
    const rows = upserts().map((c) => (args(c, 'upsert') as [Record<string, unknown>])[0].memo)
    expect(rows).toEqual([MEMO, null])
  })
  it('번호판이 제목·memo에 들어가지 않는다(spec 값이 그대로 쓰이고 추가 문자열이 없다)', async () => {
    const l = link(); await l.syncEvent(spec(null), null)
    const row = (args(upserts()[0], 'upsert') as [Record<string, unknown>])[0]
    expect(JSON.stringify(row)).not.toMatch(/plate|번호판|12가3456/)
  })
})
