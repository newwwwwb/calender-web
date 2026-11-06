// MPR-17 QA 임시 스크립트(MPR-18 이후 기존 supabase/*.sql 선적용, pg_env.mjs): AC-03-2(타 계정 격리), AC-03-6(삭제 연쇄)를 PGlite로 확인한다. 실제 Supabase 검증이 아니다.
// 실행: node docs/qa/scripts/mpr17_rls.mjs <pglite 설치 폴더의 node_modules/@electric-sql/pglite/dist/index.js 절대 경로>
import { openDb, as as asUser, reporter } from './pg_env.mjs'

const db = await openDb(process.argv[2])
const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const { ok, done } = reporter()
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`)
const as = (uid, q, params) => asUser(db, uid, q, params)

const VA = '10000000-0000-4000-8000-00000000000a', VA2 = '10000000-0000-4000-8000-0000000000a2'
const mk = async (uid, vid, name) => as(uid, `insert into vehicles(id,name) values ($1,$2) returning id,user_id`, [vid, name])

// 정상: A 차량 2대 + 딸린 행
let r = await mk(A, VA, '출퇴근'); ok('A 차량 추가, user_id 자동', r.rows?.[0]?.user_id === A, JSON.stringify(r))
await mk(A, VA2, '세컨드')
for (const v of [VA, VA2]) {
  await as(A, `insert into car_records(vehicle_id,kind,date,amount_won) values ($1,'fuel','2026-10-01',50000)`, [v])
  await as(A, `insert into car_maintenance_items(vehicle_id,name,interval_km,last_date) values ($1,'엔진오일',10000,'2026-05-01')`, [v])
  await as(A, `insert into car_due_dates(vehicle_id,kind,due_date) values ($1,'insurance','2027-03-10')`, [v])
}

// AC-03-2: B는 A의 데이터를 못 본다
for (const t of ['vehicles', 'car_records', 'car_maintenance_items', 'car_due_dates']) {
  r = await as(B, `select id from ${t}`); ok(`B 조회 ${t} = 0행`, r.rows?.length === 0, JSON.stringify(r))
}
r = await as(B, `select id from vehicles where id=$1`, [VA]); ok('B가 A 차량 id로 직접 조회 = 0행', r.rows?.length === 0)
r = await as(B, `update vehicles set name='해킹' where id=$1`, [VA]); ok('B가 A 차량 수정 = 0행', r.count === 0 && !r.err, JSON.stringify(r))
r = await as(B, `delete from vehicles where id=$1`, [VA]); ok('B가 A 차량 삭제 = 0행', r.count === 0 && !r.err, JSON.stringify(r))
r = await as(A, `select name from vehicles where id=$1`, [VA]); ok('A 차량 이름 그대로', r.rows?.[0]?.name === '출퇴근')
r = await as(B, `insert into vehicles(id,user_id,name) values (gen_random_uuid(),$1,'위조')`, [A]); ok('B가 user_id=A로 차량 insert 거부', r.err === '42501', JSON.stringify(r))
r = await as(B, `insert into car_records(vehicle_id,kind,date,amount_won) values ($1,'fuel','2026-10-01',1)`, [VA]); ok('B가 A 차량에 기록 insert 거부', r.err === '42501', JSON.stringify(r))
r = await as(B, `insert into car_maintenance_items(vehicle_id,name,interval_km,last_date) values ($1,'x',1,'2026-01-01')`, [VA]); ok('B가 A 차량에 항목 insert 거부', r.err === '42501', JSON.stringify(r))
r = await as(B, `insert into car_due_dates(vehicle_id,kind,due_date) values ($1,'inspection','2027-01-01')`, [VA]); ok('B가 A 차량에 만기일 insert 거부', r.err === '42501', JSON.stringify(r))
await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false)`)
r = await as('', `select count(*)::int n from vehicles`); ok('미인증(uid 없음) 조회 = 0행', r.rows?.[0]?.n === 0, JSON.stringify(r))
await db.exec('set role anon')
try { await db.query('select * from vehicles'); ok('anon 조회 거부', false) } catch (e) { ok('anon 조회 거부(42501)', e.code === '42501', e.code) }
await db.exec('reset role')

// 경계: 같은 차량·종류 만기일 중복은 23505
r = await as(A, `insert into car_due_dates(vehicle_id,kind,due_date) values ($1,'insurance','2027-04-01')`, [VA]); ok('만기일 중복 23505', r.err === '23505', JSON.stringify(r))

// AC-03-6: 차량 삭제 → 딸린 행 삭제, 다른 차량 그대로
r = await as(A, `delete from vehicles where id=$1`, [VA]); ok('A 차량 삭제 1행', r.count === 1, JSON.stringify(r))
for (const t of ['car_records', 'car_maintenance_items', 'car_due_dates']) {
  r = await as(A, `select count(*)::int n from ${t} where vehicle_id=$1`, [VA]); ok(`삭제 차량의 ${t} = 0건`, r.rows?.[0]?.n === 0, JSON.stringify(r))
  r = await as(A, `select count(*)::int n from ${t} where vehicle_id=$1`, [VA2]); ok(`다른 차량의 ${t} = 1건 유지`, r.rows?.[0]?.n === 1, JSON.stringify(r))
}
r = await as(A, `select count(*)::int n from vehicles`); ok('다른 차량 행 유지', r.rows?.[0]?.n === 1)

done()
