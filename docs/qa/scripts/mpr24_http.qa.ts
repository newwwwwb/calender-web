// MPR-24 QA 임시 스크립트: 실제 supabase-js(2.116)에 가짜 fetch를 물려 data 함수의 HTTP 모양·오류 분류·20초 제한(AC-03-4, AC-10-9)을 확인한다. npm test에는 포함되지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'

interface Req { method: string; url: URL; headers: Headers; body: unknown }
const h = vi.hoisted(() => ({ reqs: [] as unknown[], handler: null as null | ((r: unknown, signal?: AbortSignal | null) => Promise<Response>), client: true as boolean }))
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

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
          return h.handler!(req, init?.signal)
        },
      },
    })
  },
}))

import * as api from '../../../src/carbook/data/carbookApi'
import { CarbookError, TIMEOUT_MS } from '../../../src/carbook/data/request'

const reqs = () => h.reqs as Req[]
const V = '11111111-aaaa-4aaa-8aaa-000000000001'
const vrow = { id: V, name: '출퇴근', model: null, year: 2022, plate: '12가3456', odometer_km: 10500, created_at: '2026-05-01T01:00:00+00:00' }
const vin = { name: '출퇴근', model: '', year: 2022, plate: '12가3456', odometerKm: 10500 }

beforeEach(() => { h.reqs.length = 0; h.client = true; h.handler = async () => json(200, []); vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('AC-03-4 오류 분류(실제 supabase-js 경유)', () => {
  it('네트워크 끊김(fetch 예외) → network, 쓰기는 한 번만 시도', async () => {
    h.handler = async () => { throw new TypeError('Failed to fetch') }
    await expect(api.createVehicle(V, vin)).rejects.toMatchObject({ kind: 'network' })
    expect(reqs()).toHaveLength(1)
  })
  it('서버 오류 500·503 → network', async () => {
    for (const st of [500, 503]) { h.handler = async () => json(st, { code: 'XX000', message: 'boom' }); await expect(api.createVehicle(V, vin)).rejects.toMatchObject({ kind: 'network' }) }
  })
  it('읽기 503도 자동 재시도 없이 1번만 요청한다(NFR-39, .retry(false))', async () => {
    h.handler = async () => json(503, { code: 'PGRST000', message: 'down' })
    await expect(api.listVehicles()).rejects.toMatchObject({ kind: 'network' })
    expect(reqs()).toHaveLength(1)
  })
  it('만기일 중복 23505(409) → conflict', async () => {
    h.handler = async () => json(409, { code: '23505', message: 'duplicate key' })
    await expect(api.createDueDate({ id: V, vehicleId: V, kind: 'insurance', dueDate: '2027-03-10', eventId: V })).rejects.toMatchObject({ kind: 'conflict', code: '23505' })
  })
  it('FK 위반 23503 → conflict', async () => {
    h.handler = async () => json(409, { code: '23503', message: 'fk' })
    await expect(api.createRecord(V, V, { kind: 'wash', date: '2026-10-01', amountWon: 1, odometerKm: null, liters: null, fullTank: false, memo: null })).rejects.toMatchObject({ kind: 'conflict', code: '23503' })
  })
  it('RLS 거부 42501(403)·check 위반 23514(400)·JWT 만료(401) → unknown', async () => {
    for (const [st, code] of [[403, '42501'], [400, '23514'], [401, 'PGRST301']] as const) {
      h.handler = async () => json(st, { code, message: 'x' })
      await expect(api.updateVehicle(V, vin)).rejects.toMatchObject({ kind: 'unknown', code })
    }
  })
  it('수정 대상 없음(maybeSingle이 빈 배열 200을 받음) → unknown/not_found', async () => {
    h.handler = async () => json(200, [])
    await expect(api.updateVehicle(V, vin)).rejects.toMatchObject({ kind: 'unknown', code: 'not_found' })
  })
  it('삭제 0행은 성공(멱등)', async () => {
    h.handler = async () => new Response(null, { status: 204 })
    await expect(api.deleteVehicle(V)).resolves.toBeUndefined()
  })
  it('클라이언트 없음 → unknown/no_client', async () => {
    h.client = false
    await expect(api.listVehicles()).rejects.toMatchObject({ kind: 'unknown', code: 'no_client' })
  })
  it('던지는 값은 CarbookError', async () => {
    h.handler = async () => json(403, { code: '42501', message: 'rls' })
    await expect(api.deleteVehicle(V)).resolves.toBeUndefined().catch(() => {})
    h.handler = async () => json(500, { code: 'XX000', message: 'x' })
    await expect(api.listItems()).rejects.toBeInstanceOf(CarbookError)
  })
  it('로그에 행 내용·번호판이 없다(NFR-31)', async () => {
    h.handler = async () => json(403, { code: '42501', message: 'new row violates row-level security policy for 12가3456' })
    await api.createVehicle(V, vin).catch(() => {})
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls)
    expect(logged).toContain('42501')
    expect(logged).not.toContain('12가3456')
    expect(logged).not.toContain('출퇴근')
  })
})

describe('AC-10-9 20초 제한(실제 supabase-js 경유)', () => {
  const hang = (r: unknown, signal?: AbortSignal | null) => new Promise<Response>((_, reject) => { signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))) })
  it('응답이 없으면 19,999ms엔 대기, 20,000ms에 timeout, 재시도 없음', async () => {
    vi.useFakeTimers()
    h.handler = hang
    let state = 'pending'
    const p = api.createVehicle(V, vin).then(() => { state = 'ok' }, (e) => { state = (e as CarbookError).kind })
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1)
    expect(state).toBe('pending')
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(state).toBe('timeout')
    await vi.advanceTimersByTimeAsync(60000)
    expect(reqs()).toHaveLength(1)
  })
  it('읽기도 20초 뒤 timeout이고 재시도 없음', async () => {
    vi.useFakeTimers()
    h.handler = hang
    const p = api.listRecords(V).catch((e) => (e as CarbookError).kind)
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    expect(await p).toBe('timeout')
    await vi.advanceTimersByTimeAsync(60000)
    expect(reqs()).toHaveLength(1)
  })
  it('timeout 뒤 새 요청은 정상 동작(다시 시도 가능)', async () => {
    vi.useFakeTimers()
    h.handler = hang
    const p = api.createVehicle(V, vin).catch(() => 'x')
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await p
    h.handler = async () => json(200, vrow)
    await expect(api.createVehicle(V, vin)).resolves.toMatchObject({ id: V, name: '출퇴근', plate: '12가3456', odometerKm: 10500 })
  })
})

describe('HTTP 모양(계약 3장)', () => {
  it('createVehicle: POST upsert on_conflict=id, 열 목록 select, 빈 model은 null, user_id 안 보냄', async () => {
    h.handler = async () => json(200, vrow)
    const v = await api.createVehicle(V, vin)
    const r = reqs()[0]
    expect(r.method).toBe('POST')
    expect(r.url.pathname).toBe('/rest/v1/vehicles')
    expect(r.url.searchParams.get('on_conflict')).toBe('id')
    expect(r.url.searchParams.get('select')).toBe('id,name,model,year,plate,odometer_km,created_at')
    expect(r.headers.get('prefer')).toMatch(/resolution=merge-duplicates/)
    expect(r.body).toEqual({ id: V, name: '출퇴근', model: null, year: 2022, plate: '12가3456', odometer_km: 10500 })
    expect(v).toEqual({ id: V, name: '출퇴근', model: null, year: 2022, plate: '12가3456', odometerKm: 10500, createdAt: '2026-05-01T01:00:00+00:00' })
  })
  it('createRecord: 주유 아니면 liters null·full_tank false로 강제(BR-10), 빈 memo null', async () => {
    h.handler = async () => json(200, { id: V, vehicle_id: V, kind: 'wash', date: '2026-10-01', amount_won: 5000, odometer_km: null, liters: null, full_tank: false, memo: null, created_at: 'x' })
    await api.createRecord(V, V, { kind: 'wash', date: '2026-10-01', amountWon: 5000, odometerKm: null, liters: 30, fullTank: true, memo: '' })
    expect(reqs()[0].body).toMatchObject({ vehicle_id: V, kind: 'wash', liters: null, full_tank: false, memo: null })
  })
  it('listRecords: GET vehicle_id 조건, 날짜·생성·id 내림차순, 1,000행 범위, 열 목록', async () => {
    await api.listRecords(V)
    const r = reqs()[0]
    expect(r.method).toBe('GET')
    expect(r.url.searchParams.get('vehicle_id')).toBe(`eq.${V}`)
    expect(r.url.searchParams.get('order')).toBe('date.desc,created_at.desc,id.desc')
    expect(r.url.searchParams.get('select')).not.toContain('*')
    expect(r.url.searchParams.get('limit')).toBe('1000')
    expect(r.url.searchParams.get('offset')).toBe('0')
  })
  it('목록 읽기: 1,000행이 꽉 차면 다음 쪽(offset 1000)을 읽고 id 중복을 지운다', async () => {
    const page = (n: number, from: number) => Array.from({ length: n }, (_, i) => ({ ...vrow, id: `id-${from + i}` }))
    let call = 0
    h.handler = async () => json(200, call++ === 0 ? page(1000, 0) : [...page(1, 999), ...page(2, 1000)])
    const all = await api.listVehicles()
    expect(reqs().map((r) => r.url.searchParams.get('offset'))).toEqual(['0', '1000'])
    expect(all).toHaveLength(1002)
  })
  it('createItems: 한 번의 upsert, created_at 1ms 간격, 보낸 순서 유지', async () => {
    const rows = ['엔진오일', '타이어', '와이퍼'].map((name, i) => ({ id: `${i}`.padStart(8, '0') + '-0000-4000-8000-000000000000', name, intervalKm: null, intervalMonths: 12, lastDate: '2026-10-01', lastOdometerKm: null, eventId: null }))
    h.handler = async (r) => json(200, (r as Req).body as unknown[])
    await api.createItems(V, rows)
    expect(reqs()).toHaveLength(1)
    const body = reqs()[0].body as { name: string; created_at: string; event_id: null }[]
    expect(body.map((b) => b.name)).toEqual(['엔진오일', '타이어', '와이퍼'])
    const t = body.map((b) => Date.parse(b.created_at))
    expect(t[1] - t[0]).toBe(1); expect(t[2] - t[1]).toBe(1)
    expect(reqs()[0].url.searchParams.get('on_conflict')).toBe('id')
  })
  it('createDueDate: insert(upsert 아님, on_conflict 없음)', async () => {
    h.handler = async () => json(200, { id: V, vehicle_id: V, kind: 'insurance', due_date: '2027-03-10', event_id: V, created_at: 'x' })
    await api.createDueDate({ id: V, vehicleId: V, kind: 'insurance', dueDate: '2027-03-10', eventId: V })
    expect(reqs()[0].method).toBe('POST')
    expect(reqs()[0].url.searchParams.get('on_conflict')).toBeNull()
    expect(reqs()[0].headers.get('prefer') ?? '').not.toMatch(/merge-duplicates/)
  })
  it('updateItem + claim: ① event_id=is.null 조건 PATCH {event_id} → ② event_id 없는 PATCH, 돌려받은 행의 eventId가 정본', async () => {
    const U1 = 'e1111111-1111-4111-8111-111111111111', WIN = 'e2222222-2222-4222-8222-222222222222'
    let n = 0
    h.handler = async () => (n++ === 0 ? new Response(null, { status: 204 }) : json(200, { id: V, vehicle_id: V, name: '엔진오일', interval_km: 10000, interval_months: 12, last_date: '2026-05-01', last_odometer_km: 10000, event_id: WIN, created_at: 'x' }))
    const item = await api.updateItem(V, { name: '엔진오일', intervalKm: 10000, intervalMonths: 12, lastDate: '2026-05-01', lastOdometerKm: 10000 }, U1)
    expect(reqs()).toHaveLength(2)
    expect(reqs()[0].method).toBe('PATCH')
    expect(reqs()[0].url.searchParams.get('event_id')).toBe('is.null')
    expect(reqs()[0].url.searchParams.get('id')).toBe(`eq.${V}`)
    expect(reqs()[0].body).toEqual({ event_id: U1 })
    expect(reqs()[1].body).not.toHaveProperty('event_id')
    expect(item.eventId).toBe(WIN)
  })
  it('updateItem + claim: ①이 오류면 ②로 가지 않고 그 오류로 실패', async () => {
    h.handler = async () => { throw new TypeError('Failed to fetch') }
    await expect(api.updateItem(V, { name: 'a', intervalKm: null, intervalMonths: 1, lastDate: '2026-05-01', lastOdometerKm: null }, 'e1111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ kind: 'network' })
    expect(reqs()).toHaveLength(1)
  })
  it('updateItem(선점 값 없음): 요청 1번, event_id를 보내지 않음', async () => {
    h.handler = async () => json(200, { id: V, vehicle_id: V, name: 'a', interval_km: null, interval_months: 1, last_date: '2026-05-01', last_odometer_km: null, event_id: null, created_at: 'x' })
    await api.updateItem(V, { name: 'a', intervalKm: null, intervalMonths: 1, lastDate: '2026-05-01', lastOdometerKm: null })
    expect(reqs()).toHaveLength(1)
    expect(reqs()[0].body).not.toHaveProperty('event_id')
  })
  it('updateDueDate + claim: 같은 선점 순서, 본문에 event_id 없음', async () => {
    let n = 0
    h.handler = async () => (n++ === 0 ? new Response(null, { status: 204 }) : json(200, { id: V, vehicle_id: V, kind: 'insurance', due_date: '2027-04-01', event_id: 'e1111111-1111-4111-8111-111111111111', created_at: 'x' }))
    const d = await api.updateDueDate(V, '2027-04-01', 'e1111111-1111-4111-8111-111111111111')
    expect(reqs().map((r) => r.method)).toEqual(['PATCH', 'PATCH'])
    expect(reqs()[0].url.searchParams.get('event_id')).toBe('is.null')
    expect(reqs()[1].body).toEqual({ due_date: '2027-04-01' })
    expect(d.dueDate).toBe('2027-04-01')
  })
  it('fillMissingItemOdometer: last_odometer_km is null 조건 PATCH, 바뀐 행만 반환', async () => {
    h.handler = async () => json(200, [])
    expect(await api.fillMissingItemOdometer(V, 10500)).toEqual([])
    expect(reqs()[0].url.searchParams.get('last_odometer_km')).toBe('is.null')
    expect(reqs()[0].url.searchParams.get('vehicle_id')).toBe(`eq.${V}`)
    expect(reqs()[0].body).toEqual({ last_odometer_km: 10500 })
  })
  it('clearEventId: event_id=null PATCH', async () => {
    h.handler = async () => new Response(null, { status: 204 })
    await api.clearEventId('due', V)
    expect(reqs()[0].url.pathname).toBe('/rest/v1/car_due_dates')
    expect(reqs()[0].body).toEqual({ event_id: null })
  })
  it('select("*")를 쓰는 요청이 없다(열 이름 나열)', async () => {
    h.handler = async () => json(200, [])
    await Promise.all([api.listVehicles(), api.listItems(), api.listDueDates(), api.listRecords(V)])
    for (const r of reqs()) expect(r.url.searchParams.get('select')).not.toMatch(/\*/)
  })
})
