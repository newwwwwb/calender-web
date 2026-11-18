// MPR-38 QA 임시 모듈: 빌드 결과(dist)와 상태를 가진 PostgREST 모양 모의 Supabase를 한 포트에서 돌려준다(필터·정렬·upsert·단건 응답·연쇄 삭제·유일 제약·RPC·실패 주입·응답 지연)
// 모의 서버이며 실제 Supabase가 아니다. 사용: const s = await startServer({ dist, seed }); s.db, s.log, s.fail, s.cfg.delayMs
import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
export const USER = '11111111-1111-4111-8111-111111111111'
export const CAT_NAME = '차계부'
export const session = (() => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, role: 'authenticated', exp: 4102444800 })}.sig`
  return { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
    user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'qa@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
})()

const TABLES = ['vehicles', 'car_records', 'car_maintenance_items', 'car_due_dates', 'events', 'categories']
const CHILD = { car_records: 'vehicle_id', car_maintenance_items: 'vehicle_id', car_due_dates: 'vehicle_id' }
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function matcher(key, raw) {
  if (raw === 'is.null') return (r) => r[key] === null || r[key] === undefined
  if (raw.startsWith('eq.')) { const v = raw.slice(3); return (r) => String(r[key]) === v }
  if (raw.startsWith('in.(')) { const s = new Set(raw.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, ''))); return (r) => s.has(String(r[key])) }
  if (raw.startsWith('neq.')) { const v = raw.slice(4); return (r) => String(r[key]) !== v }
  throw new Error(`mock: 지원하지 않는 필터 ${key}=${raw}`)
}

// seed: { vehicles, car_records, car_maintenance_items, car_due_dates, events, categories }(없으면 빈 배열)
export function startServer({ dist, seed = {}, delayMs = 0, gzipApi = true, port = 0 }) {
  const db = Object.fromEntries(TABLES.map((t) => [t, structuredClone(seed[t] ?? [])]))
  const log = [] // { m, t, q, at, status }
  const cfg = { delayMs, fail: {} } // fail: { 'GET vehicles': 500 | 'hang', ... }(키는 "METHOD 테이블", 값은 상태 코드 또는 'hang')
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const body = await new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c).toString())) })
    const isApi = url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/')
    if (!isApi) {
      const f = join(dist, url.pathname)
      const file = existsSync(f) && extname(f) ? f : join(dist, 'index.html')
      const raw = readFileSync(file)
      const gz = (req.headers['accept-encoding'] ?? '').includes('gzip')
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'text/html', 'cache-control': 'no-store', ...(gz ? { 'content-encoding': 'gzip' } : {}) })
      return res.end(gz ? gzipSync(raw) : raw)
    }
    const entry = { m: req.method, t: url.pathname.replace('/rest/v1/', ''), q: decodeURIComponent(url.search).slice(0, 160), at: Date.now(), status: 0 }
    log.push(entry)
    if (cfg.delayMs) await new Promise((r) => setTimeout(r, cfg.delayMs))
    const send = (code, obj, extra = {}) => {
      entry.status = code
      const s = JSON.stringify(obj)
      const gz = gzipApi && (req.headers['accept-encoding'] ?? '').includes('gzip')
      res.writeHead(code, { 'content-type': 'application/json', ...(gz ? { 'content-encoding': 'gzip' } : {}), ...extra })
      res.end(gz ? gzipSync(s) : s)
    }
    if (url.pathname.startsWith('/auth/v1/')) return send(200, {})
    const table = entry.t
    const failure = cfg.fail[`${req.method} ${table}`]
    if (failure === 'hang') return // 응답하지 않는다
    if (failure) return send(failure, { code: failure >= 500 ? 'PGRST000' : 'XX000', message: 'injected' })
    if (table === 'rpc/ensure_carbook_category') {
      let c = db.categories.find((x) => x.user_id === USER && x.name === CAT_NAME)
      if (!c) { c = { id: randomUUID(), user_id: USER, name: CAT_NAME, color: '#0f9d58', created_at: new Date().toISOString() }; db.categories.push(c) }
      return send(200, c.id)
    }
    if (!TABLES.includes(table)) return send(200, req.method === 'GET' ? [] : null)
    const rows = db[table]
    const prefer = req.headers.prefer ?? ''
    const wantRep = prefer.includes('return=representation')
    const single = (req.headers.accept ?? '').includes('vnd.pgrst.object')
    const filters = [...url.searchParams.entries()].filter(([k]) => !RESERVED.has(k)).map(([k, v]) => matcher(k, v))
    const hit = (r) => filters.every((f) => f(r))
    const reply = (code, list) => {
      if (single) return list.length === 1 ? send(code, list[0]) : send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })
      return send(code, list)
    }
    if (req.method === 'GET') {
      let out = rows.filter(hit)
      for (const o of url.searchParams.getAll('order').reverse()) {
        const [col, dir] = o.split('.'); const sign = dir === 'desc' ? -1 : 1
        out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * sign)
      }
      const off = Number(url.searchParams.get('offset') ?? 0), lim = Number(url.searchParams.get('limit') ?? out.length)
      out = out.slice(off, off + lim).map((r) => (table === 'events' ? { event_participants: [], ...r } : r))
      return reply(200, out)
    }
    const payload = body ? JSON.parse(body) : {}
    if (req.method === 'POST') {
      const list = (Array.isArray(payload) ? payload : [payload]).map((p) => ({ created_at: new Date().toISOString(), ...p }))
      const upsert = prefer.includes('resolution=merge-duplicates')
      const saved = []
      for (const p of list) {
        if (table === 'car_due_dates' && rows.some((r) => r.vehicle_id === p.vehicle_id && r.kind === p.kind && r.id !== p.id)) return send(409, { code: '23505', message: 'duplicate key' })
        if (table === 'events' && p.category_id && !db.categories.some((c) => c.id === p.category_id)) return send(409, { code: '23503', message: 'fk' })
        const i = rows.findIndex((r) => r.id === p.id)
        if (i >= 0 && !upsert) return send(409, { code: '23505', message: 'duplicate key' })
        if (i >= 0) { rows[i] = { ...rows[i], ...p, created_at: rows[i].created_at }; saved.push(rows[i]) } else { rows.push(p); saved.push(p) }
      }
      return wantRep ? reply(201, saved) : send(201, null)
    }
    if (req.method === 'PATCH') {
      const targets = rows.filter(hit)
      for (const r of targets) Object.assign(r, payload)
      return wantRep ? reply(200, targets) : send(204, null)
    }
    if (req.method === 'DELETE') {
      const gone = rows.filter(hit)
      db[table] = rows.filter((r) => !gone.includes(r))
      if (table === 'vehicles') for (const [child, fk] of Object.entries(CHILD)) db[child] = db[child].filter((r) => !gone.some((v) => v.id === r[fk]))
      return wantRep ? reply(200, gone.map((r) => ({ id: r.id }))) : send(204, null)
    }
    return send(200, [])
  })
  return new Promise((ok) => srv.listen(port, () => ok({ srv, port: srv.address().port, db, log, cfg, close: () => { srv.closeAllConnections(); srv.close() } })))
}

// ───── 시드 ─────
export const ids = { A: '22222222-2222-4222-8222-22222222222a', B: '22222222-2222-4222-8222-22222222222b' }
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const thisMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }

// 기본 시드: 차량 A "출퇴근"(이번 달 주유 60,000·40,000, 이전 달 20,000, 항목 2·만기일 보험 1), 차량 B "가족"(이번 달 세차 5,000, 항목 1, 만기일 없음)
export function baseSeed({ nRecordsA = 0 } = {}) {
  const m = thisMonth()
  const catId = '33333333-3333-4333-8333-333333333333'
  const rec = (id, vehicle, kind, date, amount, odo, liters = null, full = false, memo = null) => ({ id, vehicle_id: vehicle, kind, date, amount_won: amount, odometer_km: odo, liters, full_tank: full, memo, created_at: `${date}T09:00:00.000Z` })
  const records = [
    rec('a0000000-0000-4000-8000-000000000001', ids.A, 'fuel', `${m}-03`, 60000, 48100, 40, true),
    rec('a0000000-0000-4000-8000-000000000002', ids.A, 'fuel', `${m}-10`, 40000, 48600, 30, true),
    rec('a0000000-0000-4000-8000-000000000003', ids.A, 'wash', `${m}-02`, 15000, null),
    rec('b0000000-0000-4000-8000-000000000001', ids.B, 'wash', `${m}-05`, 5000, null),
  ]
  const kinds = ['fuel', 'maintenance', 'wash', 'parking', 'tax', 'other']
  for (let i = 0; i < nRecordsA; i++) {
    const d = new Date(Date.UTC(2025, 0, 1) + i * 86400000 * 0.6)
    records.push(rec(randomUUID(), ids.A, kinds[i % kinds.length], d.toISOString().slice(0, 10), 10000 + (i % 30) * 1000, null, null, false, i % 7 === 0 ? `메모 ${i}` : null))
  }
  const ev = (id, title, date) => ({ id, user_id: USER, title, memo: null, category_id: catId, color: null, all_day: true, start_at: date, end_at: date, recurrence: null, excluded_dates: null, created_at: '2026-01-01T00:00:00Z' })
  const eItemA1 = 'e0000000-0000-4000-8000-0000000000a1', eItemB1 = 'e0000000-0000-4000-8000-0000000000b1', eDueA = 'e0000000-0000-4000-8000-0000000000d1'
  const items = [
    { id: 'c0000000-0000-4000-8000-0000000000a1', vehicle_id: ids.A, name: '엔진오일', interval_km: 10000, interval_months: 12, last_date: '2026-01-10', last_odometer_km: 40000, event_id: eItemA1, created_at: '2026-01-10T00:00:00.001Z' },
    { id: 'c0000000-0000-4000-8000-0000000000a2', vehicle_id: ids.A, name: '와이퍼', interval_km: null, interval_months: 6, last_date: '2026-03-01', last_odometer_km: null, event_id: null, created_at: '2026-01-10T00:00:00.002Z' },
    { id: 'c0000000-0000-4000-8000-0000000000b1', vehicle_id: ids.B, name: '타이어 교체', interval_km: 40000, interval_months: null, last_date: '2026-02-01', last_odometer_km: 10000, event_id: eItemB1, created_at: '2026-01-10T00:00:00.003Z' },
  ]
  const dues = [{ id: 'd0000000-0000-4000-8000-0000000000a1', vehicle_id: ids.A, kind: 'insurance', due_date: '2027-03-10', event_id: eDueA, created_at: '2026-01-11T00:00:00Z' }]
  return {
    vehicles: [
      { id: ids.A, name: '출퇴근', model: '아반떼', year: 2020, plate: '12가3456', odometer_km: 48000, created_at: '2026-01-01T00:00:00Z' },
      { id: ids.B, name: '가족', model: '카니발', year: 2018, plate: null, odometer_km: 90000, created_at: '2026-01-02T00:00:00Z' },
    ],
    car_records: records, car_maintenance_items: items, car_due_dates: dues,
    categories: [{ id: catId, user_id: USER, name: CAT_NAME, color: '#0f9d58', created_at: '2026-01-01T00:00:00Z' }],
    events: [ev(eItemA1, '[출퇴근] 엔진오일 교체 예정', '2026-12-31'), ev(eItemB1, '[가족] 타이어 교체 예정', '2027-02-01'), ev(eDueA, '[출퇴근] 보험 만기', '2027-03-10')],
  }
}
