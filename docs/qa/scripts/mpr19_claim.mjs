// MPR-19 QA 임시 스크립트: carbook.md 3장 'event_id 선점' 질의 순서가 두 탭 경쟁에서 한 값으로 수렴하는지 PGlite로 확인한다. 실제 Supabase가 아니다.
// 실행: node docs/qa/scripts/mpr19_claim.mjs <pglite dist/index.js 절대 경로>
import { openDb, as, reporter } from './pg_env.mjs'

const db = await openDb(process.argv[2])
const { ok, done } = reporter()
const A = '00000000-0000-4000-8000-00000000000a'
await db.exec(`insert into auth.users (id) values ('${A}')`)
const V = 'f0000000-0000-4000-8000-000000000001', I = 'a0000000-0000-4000-8000-000000000001', D = 'b0000000-0000-4000-8000-000000000001'
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222'
await as(db, A, `insert into vehicles(id,name) values ($1,'내 차')`, [V])
await as(db, A, `insert into car_maintenance_items(id,vehicle_id,name,interval_km,last_date) values ($1,$2,'엔진오일',10000,'2026-05-01')`, [I, V])
await as(db, A, `insert into car_due_dates(id,vehicle_id,kind,due_date) values ($1,$2,'insurance','2027-03-10')`, [D, V])

// 계약 3장 질의: ① claim = update … set event_id=$uuid where id=$id and event_id is null  ② 나머지 열 update … returning(event_id 포함, event_id는 set에 없음)
const claim = (t, id, u) => as(db, A, `update ${t} set event_id=$1 where id=$2 and event_id is null`, [u, id])
const rest = (t, id) => t === 'car_maintenance_items'
  ? as(db, A, `update ${t} set name='엔진오일', interval_km=10000, interval_months=12, last_date='2026-05-01', last_odometer_km=10000 where id=$1 returning event_id`, [id])
  : as(db, A, `update ${t} set due_date='2027-03-10' where id=$1 returning event_id`, [id])

for (const [label, t, id] of [['교체 항목', 'car_maintenance_items', I], ['만기일', 'car_due_dates', D]]) {
  // 탭 A가 먼저 선점, 탭 B가 뒤따름(B의 ①은 0행, ②가 돌려주는 event_id는 A의 값)
  const ca = await claim(t, id, U1); const cb = await claim(t, id, U2)
  ok(`${label}: 먼저 선점한 A는 1행, B는 0행 바뀜`, ca.count === 1 && cb.count === 0, JSON.stringify([ca, cb]))
  const ra = await rest(t, id), rb = await rest(t, id)
  ok(`${label}: 두 탭이 돌려받은 event_id가 모두 A의 uuid(고아 uuid 0)`, ra.rows?.[0]?.event_id === U1 && rb.rows?.[0]?.event_id === U1, JSON.stringify([ra, rb]))
  const fin = await as(db, A, `select event_id from ${t} where id=$1`, [id]); ok(`${label}: 저장된 값은 A의 uuid 하나`, fin.rows?.[0]?.event_id === U1)
  // 이미 event_id가 있으면 claim은 아무것도 바꾸지 않는다
  const again = await claim(t, id, U2); ok(`${label}: 이미 있는 event_id는 덮어쓰지 않음`, again.count === 0)
  // clearEventId(null로 되돌림) 뒤에는 다시 선점 가능
  await as(db, A, `update ${t} set event_id=null where id=$1`, [id]); const re = await claim(t, id, U2)
  ok(`${label}: event_id를 비운 뒤에는 새 uuid로 다시 선점 가능`, re.count === 1)
  // 수정 질의(②)는 event_id를 바꾸지 않는다(null이어도 건드리지 않음)
  await as(db, A, `update ${t} set event_id=null where id=$1`, [id]); const r2 = await rest(t, id)
  ok(`${label}: 수정 질의 ②는 event_id를 쓰지 않음(null 그대로 돌려줌)`, r2.rows?.[0]?.event_id === null, JSON.stringify(r2))
}
done()
