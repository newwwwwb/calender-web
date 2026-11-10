// MPR-38 성능 측정용 모의 서버: 빌드 결과(dist)와 PostgREST 모양의 Supabase API를 한 포트에서 돌려준다
import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
export const USER = '11111111-1111-4111-8111-111111111111'
export const VEHICLE = '22222222-2222-4222-8222-222222222222'
export const CAT = '33333333-3333-4333-8333-333333333333'

export function makeData(nRecords) {
  const kinds = ['fuel', 'fuel', 'fuel', 'maintenance', 'wash', 'parking', 'insurance', 'tax', 'other']
  const records = Array.from({ length: nRecords }, (_, i) => {
    const kind = kinds[i % kinds.length]
    const d = new Date(Date.UTC(2026, 10, 8) - i * 86400000 * 0.9)
    return {
      id: randomUUID(), vehicle_id: VEHICLE, kind, date: d.toISOString().slice(0, 10), amount_won: 30000 + (i % 40) * 1000,
      odometer_km: 100000 - i * 40, liters: kind === 'fuel' ? 30 + (i % 7) : null, full_tank: kind === 'fuel' && i % 2 === 0,
      memo: i % 5 === 0 ? `메모 ${i} 주유소` : null, created_at: new Date(d.getTime() + i).toISOString(),
    }
  })
  const items = Array.from({ length: 20 }, (_, i) => ({
    id: randomUUID(), vehicle_id: VEHICLE, name: `항목${i}`, interval_km: i % 2 ? 10000 : null, interval_months: 12, last_date: '2026-01-01',
    last_odometer_km: i % 2 ? 90000 : null, event_id: randomUUID(), created_at: new Date(2026, 0, 1, 0, 0, i).toISOString(),
  }))
  const dues = ['insurance', 'car_tax', 'inspection'].slice(0, 2).map((kind, i) => ({
    id: randomUUID(), vehicle_id: VEHICLE, kind, due_date: '2026-12-15', event_id: randomUUID(), created_at: new Date(2026, 0, 2, 0, 0, i).toISOString(),
  }))
  const vehicles = [{ id: VEHICLE, name: '내차', model: '아반떼', year: 2020, plate: null, odometer_km: 100000, created_at: '2026-01-01T00:00:00Z' }]
  const events = [...items, ...dues].map((r) => ({
    id: r.event_id, user_id: USER, title: 'x', memo: null, category_id: CAT, color: null, all_day: true, start_at: '2026-12-15', end_at: '2026-12-15',
    recurrence: null, excluded_dates: null, created_at: '2026-01-01T00:00:00Z', event_participants: [],
  }))
  return { vehicles, car_records: records, car_maintenance_items: items, car_due_dates: dues, events, categories: [{ id: CAT, user_id: USER, name: '차계부', color: '#0f9d58', created_at: '2026-01-01T00:00:00Z' }] }
}

// opts: { dist, data, apiDelayMs, log }
export function startServer({ dist, data, apiDelayMs = 30, log = [] }, port = 0) {
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const body = await new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c).toString())) })
    const isApi = url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/')
    if (!isApi) {
      const f = join(dist, url.pathname)
      const file = existsSync(f) && !f.endsWith('dist') && extname(f) ? f : join(dist, 'index.html')
      const raw = readFileSync(file)
      const gz = process.env.NOGZIP !== '1' && (req.headers['accept-encoding'] ?? '').includes('gzip')
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'text/html', 'cache-control': 'no-store', ...(gz ? { 'content-encoding': 'gzip' } : {}) })
      return res.end(gz ? gzipSync(raw) : raw)
    }
    await new Promise((r) => setTimeout(r, apiDelayMs))
    const send = (code, obj, extra = {}) => { const s = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', ...extra }); res.end(s) }
    const table = url.pathname.replace('/rest/v1/', '')
    const entry = { m: req.method, t: table, q: url.search.slice(0, 80), at: Date.now() }
    log.push(entry)
    if (url.pathname.startsWith('/auth/v1/')) return send(200, {})
    if (table === 'rpc/ensure_carbook_category') return send(200, CAT)
    const rows = data[table]
    const single = (req.headers.accept ?? '').includes('vnd.pgrst.object')
    if (req.method === 'GET') {
      if (!rows) return send(200, [])
      let out = rows
      const idf = url.searchParams.get('id')
      if (idf?.startsWith('in.(')) { const ids = new Set(idf.slice(4, -1).split(',')); out = rows.filter((r) => ids.has(r.id)) }
      const off = Number(url.searchParams.get('offset') ?? 0), lim = Number(url.searchParams.get('limit') ?? out.length)
      return send(200, out.slice(off, off + lim))
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
      const payload = body ? JSON.parse(body) : {}
      const list = Array.isArray(payload) ? payload : [payload]
      const saved = list.map((p) => ({ created_at: new Date().toISOString(), event_participants: [], ...p }))
      if (rows) for (const s of saved) { const i = rows.findIndex((r) => r.id === s.id); if (i >= 0) rows[i] = { ...rows[i], ...s }; else rows.push(s) }
      entry.wrote = true
      return single ? send(201, saved[0]) : send(201, saved)
    }
    if (req.method === 'DELETE') return send(200, [])
    return send(200, [])
  })
  return new Promise((ok) => srv.listen(port, () => ok({ srv, port: srv.address().port, log })))
}
