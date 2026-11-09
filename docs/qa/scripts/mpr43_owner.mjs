// MPR-43 QA 임시 스크립트: 남의 event_id를 자기 항목·만기일에 넣어도 그 일정이 다른 공유 상대에게 숨지 않는지(AC-16-3), 진짜 연결 일정은 계속 숨는지(AC-16-1·7)를 PGlite로 확인한다. 실제 Supabase 검증이 아니다.
// 실행: node docs/qa/scripts/mpr43_owner.mjs <pglite dist/index.js 절대 경로>  (QA_SQL_ROOT로 이전 SQL을 주면 대조 실험)
import { openDb, as as asUser, reporter } from './pg_env.mjs'

const db = await openDb(process.argv[2])
const { ok, done } = reporter()
const U = (n) => `00000000-0000-4000-8000-0000000000${n}`
const A = U('0a'), B = U('0b'), C = U('0c'), D = U('0d')
const as = (uid, q, params) => asUser(db, uid, q, params)
const ids = (r) => (r.rows ?? []).map((x) => x.id).sort()
const E = Object.fromEntries(['norm', 'nocat', 'due', 'orphan', 'direct', 'bcar'].map((k, n) => [k, `e0000000-0000-4000-8000-00000000000${n + 1}`]))
const VA = 'f0000000-0000-4000-8000-00000000000a', VB = 'f0000000-0000-4000-8000-00000000000b'

await db.exec(`
  insert into auth.users (id, email) values ('${A}','a@x'), ('${B}','b@x'), ('${C}','c@x'), ('${D}','d@x');
  insert into calendar_shares (id, owner_id, owner_email) values ('50000000-0000-4000-8000-000000000001', '${A}', 'a@x');
  insert into calendar_share_members (share_id, viewer_id, viewer_email) values ('50000000-0000-4000-8000-000000000001', '${B}', 'b@x'), ('50000000-0000-4000-8000-000000000001', '${C}', 'c@x');
`)
const CAT = (await as(A, `select ensure_carbook_category() as id`)).rows?.[0]?.id
const CATB = (await as(B, `select ensure_carbook_category() as id`)).rows?.[0]?.id
const WORK = 'c0000000-0000-4000-8000-0000000000aa'
await as(A, `insert into categories(id,user_id,name,color) values ($1,$2,'업무','#222222')`, [WORK, A])
const ev = (u, k, cat) => as(u, `insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ($1,$2,$3,$4,true,'2027-03-10','2027-03-10')`, [E[k], u, k, cat])
await ev(A, 'norm', WORK); await ev(A, 'nocat', null); await ev(A, 'due', CAT); await ev(A, 'orphan', null); await ev(A, 'direct', CAT); await ev(B, 'bcar', CATB)
// A의 진짜 연결(만기일→due, 항목→orphan)
await db.exec(`
  insert into vehicles(id,user_id,name) values ('${VA}','${A}','A차'), ('${VB}','${B}','B차');
  insert into car_due_dates(vehicle_id,user_id,kind,due_date,event_id) values ('${VA}','${A}','insurance','2027-03-10','${E.due}');
  insert into car_maintenance_items(vehicle_id,user_id,name,interval_km,last_date,event_id) values ('${VA}','${A}','엔진오일',10000,'2026-05-01','${E.orphan}');
`)
const shown = async (u, keys) => ids(await as(u, `select id from events where id = any($1::uuid[])`, [keys.map((k) => E[k])]))
const want = (keys) => keys.map((k) => E[k]).sort()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// 공격 전 기준선
ok('기준선 C: A의 norm·nocat 보임', same(await shown(C, ['norm', 'nocat']), want(['norm', 'nocat'])))

// 공격: B가 자기 항목·만기일의 event_id에 A의 일반 일정(norm, nocat)과 A의 연결 일정(due)을 넣는다
let r = await as(B, `insert into car_maintenance_items(vehicle_id,user_id,name,interval_km,last_date,event_id) values ($1,$2,'공격1',1000,'2026-01-01',$3), ($1,$2,'공격2',1000,'2026-01-01',$4)`, [VB, B, E.norm, E.due])
ok('전제: B가 자기 항목에 남의 일정 id를 쓰는 insert는 RLS상 가능(FK 없음)', !r.err && r.count === 2, JSON.stringify(r))
r = await as(B, `insert into car_due_dates(vehicle_id,user_id,kind,due_date,event_id) values ($1,$2,'insurance','2027-01-01',$3)`, [VB, B, E.nocat])
ok('전제: B가 자기 만기일에 남의 일정 id(nocat)를 쓰는 insert 가능', !r.err && r.count === 1, JSON.stringify(r))

// AC-16-3: 공격 뒤에도 일반 일정은 A의 다른 공유 상대 C에게 보임
ok('AC-16-3 C: A의 norm·nocat이 B의 공격 뒤에도 보임', same(await shown(C, ['norm', 'nocat']), want(['norm', 'nocat'])), JSON.stringify(await shown(C, ['norm', 'nocat'])))
ok('AC-16-3 B 본인: norm·nocat 보임', same(await shown(B, ['norm', 'nocat']), want(['norm', 'nocat'])))
ok('AC-16-3 A 본인: norm·nocat 보임', same(await shown(A, ['norm', 'nocat']), want(['norm', 'nocat'])))
// AC-16-1: 진짜 연결 일정은 계속 숨음(B의 항목이 due를 가리켜도 영향 없음, 오히려 숨김 유지)
ok('AC-16-1 B·C: A의 진짜 연결 일정(due, orphan) 0건', (await shown(B, ['due', 'orphan'])).length === 0 && (await shown(C, ['due', 'orphan'])).length === 0)
ok('AC-16-2 A 본인: 연결 일정 due·orphan 보임', same(await shown(A, ['due', 'orphan']), want(['due', 'orphan'])))
// AC-16-7: 직접 만든 차계부 카테고리 일정
ok('AC-16-7 B·C: 직접 만든 일정(direct) 0건', (await shown(B, ['direct'])).length === 0 && (await shown(C, ['direct'])).length === 0)
ok('AC-16-7 A 본인: direct 보임', same(await shown(A, ['direct']), want(['direct'])))
// B 자신의 진짜 연결 일정은 소유자 B 기준으로 숨음
await db.exec(`insert into car_due_dates(vehicle_id,user_id,kind,due_date,event_id) values ('${VB}','${B}','inspection','2027-05-01','${E.bcar}')`)
ok('AC-16-1 대칭: B 자신의 연결 일정(bcar)은 A에게 0건, B에게는 보임', (await shown(A, ['bcar'])).length === 0 && same(await shown(B, ['bcar']), want(['bcar'])))
// 무관 사용자 D
r = await as(D, `select count(*)::int n from events`); ok('무관 사용자 D: 일정 0건', r.rows?.[0]?.n === 0)
// 카테고리 삭제 뒤(AC-16-6)에도 A의 연결 일정은 숨고 일반 일정은 보임
await as(A, `delete from categories where id=$1`, [CAT])
ok('AC-16-6 카테고리 삭제 뒤: B·C에게 due·orphan 0건, norm·nocat은 보임', (await shown(B, ['due', 'orphan'])).length === 0 && (await shown(C, ['due', 'orphan'])).length === 0 && same(await shown(C, ['norm', 'nocat']), want(['norm', 'nocat'])))

// 함수 시그니처·권한
r = await db.query(`select pronargs, pg_get_function_arguments(oid) args from pg_proc where proname='is_carbook_linked_event'`)
ok('is_carbook_linked_event는 (p_event_id uuid, p_owner uuid) 하나만 존재', r.rows.length === 1 && r.rows[0].args === 'p_event_id uuid, p_owner uuid', JSON.stringify(r.rows))
const f = (id, owner) => as(A, `select is_carbook_linked_event($1,$2) as v`, [id, owner])
ok('함수: (due, A)=참, (orphan, A)=참', (await f(E.due, A)).rows?.[0]?.v === true && (await f(E.orphan, A)).rows?.[0]?.v === true)
ok('함수: (norm, A)=거짓 — B의 공격 행이 있어도(norm은 B의 항목이 가리킴)', (await f(E.norm, A)).rows?.[0]?.v === false)
ok('함수: (norm, B)=참 — 소유자가 B라고 주면 B의 행만 보므로(정책은 일정 소유자 id를 넘김)', (await f(E.norm, B)).rows?.[0]?.v === true)
await db.exec('set role anon')
try { await db.query(`select is_carbook_linked_event('${E.due}','${A}')`); ok('anon 실행 거부', false) } catch (e) { ok('anon is_carbook_linked_event 실행 거부(42501)', e.code === '42501', e.code) }
await db.exec('reset role')
r = await db.query(`select has_function_privilege('authenticated','is_carbook_linked_event(uuid,uuid)','execute') a, has_function_privilege('public','is_carbook_linked_event(uuid,uuid)','execute') p`)
ok('권한: authenticated 실행 가능, public 불가', r.rows[0].a === true && r.rows[0].p === false, JSON.stringify(r.rows))

// 재적용 안전(openDb가 이미 두 번 적용) + DOWN 실행 뒤 재적용
const sqlText = (await import('node:fs')).readFileSync(new URL('../../../supabase/schema_carbook.sql', import.meta.url), 'utf8')
ok('SQL 파일에 -- DOWN: 줄이 있고 2인자 함수를 지움', /-- DOWN:.*is_carbook_linked_event \(uuid, uuid\)/.test(sqlText))
done()
