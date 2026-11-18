// MPR-48 QA 임시 스크립트: 운영 Supabase에 로그인 없이(anon 키) 차계부 표를 조회·수정·삭제 시도해 응답 코드와 행 수를 본다. 읽기 외에는 존재하지 않는 id만 겨냥해 운영 데이터를 바꾸지 않는다. 키·URL은 출력하지 않는다.
// 실행: node docs/qa/scripts/mpr48_anon.mjs <.env.local 경로>
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]))
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) { console.log('환경변수 없음'); process.exit(1) }
console.log('호스트 끝부분:', new URL(url).hostname.replace(/^.*?\./, '*.'))
const H = { apikey: key, 'content-type': 'application/json' } // Authorization 없음 = 로그아웃(anon)
const NIL = '00000000-0000-4000-8000-000000000000'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' :: ' + x}`) }
for (const t of ['vehicles', 'car_records', 'car_maintenance_items', 'car_due_dates', 'events', 'categories']) {
  const r = await fetch(`${url}/rest/v1/${t}?select=id&limit=5`, { headers: H }); const txt = await r.text(); let n = -1; try { const j = JSON.parse(txt); n = Array.isArray(j) ? j.length : -1 } catch { /* 본문 아님 */ }
  console.log(`  · GET ${t}: HTTP ${r.status}, 행 ${n}, 본문 앞부분 ${txt.slice(0, 80).replace(/"[0-9a-f-]{36}"/g, '"<id>"')}`)
  ok(`anon GET ${t}: 0행이거나 거부(401/403)`, (r.status === 200 && n === 0) || r.status === 401 || r.status === 403, `${r.status} ${n}`)
}
const COL = { vehicles: { name: 'qa' }, car_records: { memo: 'qa' }, car_maintenance_items: { name: 'qa' }, car_due_dates: { due_date: '2030-01-01' } } // 각 표에 있는 열
for (const t of ['vehicles', 'car_records', 'car_maintenance_items', 'car_due_dates']) {
  const p = await fetch(`${url}/rest/v1/${t}?id=eq.${NIL}`, { method: 'PATCH', headers: { ...H, prefer: 'return=representation' }, body: JSON.stringify(COL[t]) }); const pt = await p.text()
  const d = await fetch(`${url}/rest/v1/${t}?id=eq.${NIL}`, { method: 'DELETE', headers: { ...H, prefer: 'return=representation' } }); const dt = await d.text()
  console.log(`  · ${t}: PATCH HTTP ${p.status} ${pt.slice(0, 70)} | DELETE HTTP ${d.status} ${dt.slice(0, 70)}`)
  ok(`anon 수정·삭제 ${t}: 거부(401/403) 또는 0행(대상은 존재하지 않는 id)`, [p.status, d.status].every((s) => [401, 403, 200, 204].includes(s)), `${p.status} ${d.status}`)
}
const rpc = await fetch(`${url}/rest/v1/rpc/ensure_carbook_category`, { method: 'POST', headers: H, body: '{}' }); const rt = await rpc.text()
console.log(`  · RPC ensure_carbook_category(anon): HTTP ${rpc.status} ${rt.slice(0, 100).replace(/"[0-9a-f-]{36}"/g, '"<id>"')}`)
ok('anon RPC ensure_carbook_category 거부(401/403) — 카테고리를 만들지 못함', [401, 403].includes(rpc.status) || /permission|auth|jwt|denied/i.test(rt), `${rpc.status} ${rt.slice(0, 80)}`)
console.log(`\nRESULT pass=${pass} fail=${fail}`)
