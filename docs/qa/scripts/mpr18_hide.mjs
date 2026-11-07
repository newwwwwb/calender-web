// MPR-18 QA 임시 스크립트: 차계부 카테고리 함수와 공유 상대 숨김 정책(AC-08-4·13·14, AC-16-1·2·3·6·7)을 PGlite로 확인한다. 실제 Supabase 검증이 아니다.
// 실행: node docs/qa/scripts/mpr18_hide.mjs <pglite dist/index.js 절대 경로>
import { openDb, as as asUser, reporter } from './pg_env.mjs'

const db = await openDb(process.argv[2])
const { ok, done } = reporter()
const U = (n) => `00000000-0000-4000-8000-0000000000${n}`
const A = U('0a'), B = U('0b'), C = U('0c'), D = U('0d')
const as = (uid, q, params) => asUser(db, uid, q, params)
const ids = (r) => (r.rows ?? []).map((x) => x.id).sort()
const E = Object.fromEntries(['norm', 'due', 'direct', 'orphan', 'nocat', 'part'].map((k, n) => [k, `e0000000-0000-4000-8000-00000000000${n + 1}`]))
const WORK = 'c0000000-0000-4000-8000-0000000000aa'

// 고정 데이터(슈퍼유저로 넣는다): 사용자 4명, A-B 공유 연결, A의 차량·항목·만기일
await db.exec(`
  insert into auth.users (id, email) values ('${A}','a@x'), ('${B}','b@x'), ('${C}','c@x'), ('${D}','d@x');
  insert into calendar_shares (id, owner_id, owner_email) values ('50000000-0000-4000-8000-000000000001', '${A}', 'a@x');
  insert into calendar_share_members (share_id, viewer_id, viewer_email) values ('50000000-0000-4000-8000-000000000001', '${B}', 'b@x');
`)

// AC-08-4: ensure 결과가 고정 id, 두 번째도 같음
let r = await as(A, `select ensure_carbook_category() as id`); const CAT = r.rows?.[0]?.id
ok('AC-08-4 ensure → uuid 반환', /^[0-9a-f-]{36}$/.test(CAT ?? ''), JSON.stringify(r))
r = await as(A, `select md5('carbook-category:' || $1::text)::uuid as id`, [A]); ok('AC-08-4 id = md5(carbook-category:사용자) 고정 식', r.rows?.[0]?.id === CAT)
r = await as(A, `select ensure_carbook_category() as id`); ok('AC-08-4 두 번째 호출도 같은 id', r.rows?.[0]?.id === CAT)
r = await as(A, `select id, name, color from categories where name='차계부'`); ok('AC-08-4 카테고리 행 1개(이름 차계부)', r.rows?.length === 1 && r.rows[0].id === CAT, JSON.stringify(r))
await as(A, `update categories set name='내 차', color='#111111' where id=$1`, [CAT])
await as(A, `select ensure_carbook_category()`)
r = await as(A, `select name, color from categories where id=$1`, [CAT]); ok('AC-08-4 이름·색을 바꿔도 ensure가 건드리지 않음', r.rows?.[0]?.name === '내 차' && r.rows?.[0]?.color === '#111111', JSON.stringify(r))
// AC-08-13 (모의 한계: 단일 연결이라 진짜 동시 실행은 아님)
await as(A, `delete from categories where id=$1`, [CAT])
const [r1, r2] = await Promise.all([as(A, `select ensure_carbook_category() as id`), as(A, `select ensure_carbook_category() as id`)])
r = await as(A, `select count(*)::int n from categories where id=$1`, [CAT]); ok('AC-08-13 연달아 두 번 ensure → 카테고리 1개, 같은 id', r.rows?.[0]?.n === 1 && r1.rows?.[0]?.id === CAT && r2.rows?.[0]?.id === CAT, JSON.stringify([r1, r2, r]))
r = await as(B, `select ensure_carbook_category() as id`); ok('다른 사용자는 다른 고정 id', r.rows?.[0]?.id && r.rows[0].id !== CAT, JSON.stringify(r))
const CATB = r.rows?.[0]?.id

// A의 일정 6건: 일반(norm), 만기일 연결+차계부(due), 직접 만든 차계부(direct), 항목 연결+분류 없음(orphan), 분류 없는 일반(nocat), 차계부+C 참여(part)
await as(A, `insert into categories(id,user_id,name,color) values ($1,$2,'업무','#222222')`, [WORK, A])
const ev = (k, cat) => as(A, `insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ($1,$2,$3,$4,true,'2027-03-10','2027-03-10')`, [E[k], A, k, cat])
await ev('norm', WORK); await ev('due', CAT); await ev('direct', CAT); await ev('orphan', null); await ev('nocat', null); await ev('part', CAT)
await db.exec(`
  insert into vehicles(id,user_id,name) values ('f0000000-0000-4000-8000-000000000001','${A}','내 차');
  insert into car_due_dates(vehicle_id,user_id,kind,due_date,event_id) values ('f0000000-0000-4000-8000-000000000001','${A}','insurance','2027-03-10','${E.due}');
  insert into car_maintenance_items(vehicle_id,user_id,name,interval_km,last_date,event_id) values ('f0000000-0000-4000-8000-000000000001','${A}','엔진오일',10000,'2026-05-01','${E.orphan}');
  insert into event_participants(event_id,user_id,status) values ('${E.part}','${C}','pending');
`)

const all = Object.values(E).sort()
r = await as(A, `select id from events`); ok('AC-16-2 A: 일정 6건 전부 보임', JSON.stringify(ids(r)) === JSON.stringify(all), JSON.stringify(ids(r)))
r = await as(A, `select id from categories`); ok('AC-16-2 A: 카테고리 2개(차계부·업무) 보임', ids(r).length === 2 && ids(r).includes(CAT), JSON.stringify(r))
r = await as(B, `select id from events`); ok('AC-16-1/3 B: 일정은 norm·nocat 2건만', JSON.stringify(ids(r)) === JSON.stringify([E.norm, E.nocat].sort()), JSON.stringify(ids(r)))
r = await as(B, `select id from events where id=$1`, [E.due]); ok('AC-16-1 B: 연결 일정(due) 직접 id 조회도 0건', r.rows?.length === 0)
r = await as(B, `select id from categories where user_id=$1`, [A]); ok('AC-16-1 B: A의 카테고리는 업무만(차계부 없음)', JSON.stringify(ids(r)) === JSON.stringify([WORK]), JSON.stringify(ids(r)))
r = await as(B, `select id from events where id=$1`, [E.norm]); ok('AC-16-3 B: 일반 일정 그대로 보임', r.rows?.length === 1)
r = await as(B, `select id from events where id=$1`, [E.nocat]); ok('AC-16-3 B: 분류 없는 일반 일정(category_id null)도 보임', r.rows?.length === 1)
r = await as(B, `select id from events where id=$1`, [E.direct]); ok('AC-16-7 B: 직접 만든 차계부 카테고리 일정 0건', r.rows?.length === 0)
r = await as(A, `select id from events where id=$1`, [E.direct]); ok('AC-16-7 A: 같은 일정이 A에게는 보임', r.rows?.length === 1)
// 대칭: B의 차계부 일정은 A(공유 상대)에게 안 보인다
await as(B, `insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ('e0000000-0000-4000-8000-0000000000b1',$1,'b-car',$2,true,'2027-01-01','2027-01-01')`, [B, CATB])
await as(B, `insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ('e0000000-0000-4000-8000-0000000000b2',$1,'b-norm',null,true,'2027-01-01','2027-01-01')`, [B])
r = await as(A, `select id from events where user_id=$1`, [B]); ok('대칭: A는 B의 차계부 일정 못 보고 일반 일정만 봄', JSON.stringify(ids(r)) === JSON.stringify(['e0000000-0000-4000-8000-0000000000b2']), JSON.stringify(ids(r)))
// 참여자·무관 사용자
r = await as(C, `select id from events`); ok('초대된 참여자 C: 초대된 일정(part)만 보임(기존 동작 유지)', JSON.stringify(ids(r)) === JSON.stringify([E.part]), JSON.stringify(ids(r)))
r = await as(C, `select id from categories`); ok('참여자 C: 카테고리는 0개', r.rows?.length === 0)
r = await as(D, `select (select count(*) from events)::int e, (select count(*) from categories)::int c`); ok('무관 사용자 D: 일정·카테고리 0건', r.rows?.[0]?.e === 0 && r.rows?.[0]?.c === 0, JSON.stringify(r))

// AC-16-6 / AC-08-14: 카테고리 삭제 → 분류 풀림, 연결 일정은 계속 숨김 → ensure로 재생성·재묶기 후에도 숨김
await as(A, `delete from categories where id=$1`, [CAT])
r = await as(A, `select id, category_id from events where id in ($1,$2)`, [E.due, E.orphan]); ok('AC-08-14 전제: 카테고리 삭제로 두 연결 일정의 분류가 풀림', r.rows?.length === 2 && r.rows.every((x) => x.category_id === null), JSON.stringify(r))
r = await as(B, `select id from events where id in ($1,$2)`, [E.due, E.orphan]); ok('AC-16-6 카테고리 삭제 뒤에도 연결 일정 B에게 0건', r.rows?.length === 0, JSON.stringify(r))
r = await as(A, `select ensure_carbook_category() as id`); ok('AC-08-14 삭제 후 ensure → 같은 id로 다시 생성', r.rows?.[0]?.id === CAT)
r = await as(A, `select count(*)::int n from categories where name='차계부'`); ok('AC-08-14 차계부 카테고리 1개', r.rows?.[0]?.n === 1)
r = await as(A, `update events set category_id=$1 where id in ($2,$3)`, [CAT, E.due, E.orphan]); ok('AC-08-14 연결 일정 2건을 새 카테고리로 다시 묶음', r.count === 2, JSON.stringify(r))
r = await as(A, `select count(*)::int n from events where category_id=$1 and id in ($2,$3)`, [CAT, E.due, E.orphan]); ok('AC-08-14 두 일정 모두 새 카테고리에 속함', r.rows?.[0]?.n === 2)
r = await as(B, `select id from events where id in ($1,$2)`, [E.due, E.orphan]); ok('AC-16-6 다시 묶인 뒤에도 B에게 0건', r.rows?.length === 0, JSON.stringify(r))
r = await as(B, `select id from categories where id=$1`, [CAT]); ok('AC-16-1 B: 다시 만든 차계부 카테고리도 안 보임', r.rows?.length === 0)

// 권한·경계
r = await as('', `select ensure_carbook_category()`); ok('로그인 없이 ensure → 28000', r.err === '28000', JSON.stringify(r))
await db.exec('set role anon')
// MPR-43: is_carbook_linked_event가 (uuid) → (uuid, uuid) 2인자가 됐다. 어느 쪽 SQL이든 맞는 호출을 만든다
const linkedArgs = (await db.query(`select max(pronargs) n from pg_proc where proname = 'is_carbook_linked_event'`)).rows[0].n
const linkedCall = linkedArgs >= 2 ? `is_carbook_linked_event('${E.due}', '${A}')` : `is_carbook_linked_event('${E.due}')`
for (const fn of ['ensure_carbook_category()', `carbook_category_id('${A}')`, linkedCall]) {
  try { await db.query(`select ${fn}`); ok(`anon ${fn.split('(')[0]} 실행 거부`, false) } catch (e) { ok(`anon ${fn.split('(')[0]} 실행 거부(42501)`, e.code === '42501', e.code) }
}
await db.exec('reset role')
r = await as(B, `update events set title='해킹' where id=$1`, [E.due]); ok('B가 A의 연결 일정 수정 → 0행', r.count === 0 && !r.err, JSON.stringify(r))
r = await as(B, `delete from categories where id=$1`, [CAT]); ok('B가 A의 차계부 카테고리 삭제 → 0행', r.count === 0 && !r.err, JSON.stringify(r))
// 알려진 한계(docs/db.md 7장 한계 2, MPR-42): B가 A의 고정 id로 자기 카테고리를 먼저 만들 수 있는지 관찰만 한다(판정에 넣지 않음)
await as(A, `delete from categories where id=$1`, [CAT])
r = await as(B, `insert into categories(id,user_id,name,color) values ($1,$2,'선점','#000000')`, [CAT, B])
console.log(`INFO 알려진 한계 2(MPR-42 예정): B가 A의 고정 id로 insert → ${r.err ? '거부 ' + r.err : '허용됨'}`)

done()
