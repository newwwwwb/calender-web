// MPR-42 QA 임시 스크립트: 고정 id 선점 방지 정책과 ensure 오류(AC-08-4·13·16, AC-16-8)를 PGlite로 확인한다. 실제 Supabase 검증이 아니다.
// 실행: node docs/qa/scripts/mpr42_guard.mjs <pglite dist/index.js 절대 경로>
import { openDb, as as asUser, reporter } from './pg_env.mjs'

const db = await openDb(process.argv[2])
const { ok, done } = reporter()
const U = (n) => `00000000-0000-4000-8000-0000000000${n}`
const A = U('0a'), B = U('0b'), D = U('0d')
const as = (uid, q, params) => asUser(db, uid, q, params)
const fixed = async (u) => (await db.query(`select md5('carbook-category:' || $1::text)::uuid as id`, [u])).rows[0].id
await db.exec(`
  insert into auth.users (id, email) values ('${A}','a@x'), ('${B}','b@x'), ('${D}','d@x');
  insert into calendar_shares (id, owner_id, owner_email) values ('50000000-0000-4000-8000-000000000001', '${A}', 'a@x');
  insert into calendar_share_members (share_id, viewer_id, viewer_email) values ('50000000-0000-4000-8000-000000000001', '${B}', 'b@x');
`)
const FA = await fixed(A), FB = await fixed(B)
const ins = (uid, id, owner, name = 'x') => as(uid, `insert into categories(id,user_id,name,color) values ($1,$2,$3,'#000000')`, [id, owner, name])

// 선점 시도 차단
let r = await ins(B, FA, B, '선점'); ok('B가 A의 고정 id로 자기 카테고리 insert → 42501', r.err === '42501', JSON.stringify(r))
r = await ins(B, FA, A, '위조'); ok('B가 A의 고정 id에 user_id=A로 insert → 42501', r.err === '42501', JSON.stringify(r))
r = await ins(D, FA, D, '선점2'); ok('공유 상대가 아닌 D도 같은 선점 → 42501', r.err === '42501', JSON.stringify(r))
await ins(B, 'c0000000-0000-4000-8000-0000000000b1', B, '내 일반')
r = await as(B, `update categories set id=$1 where id='c0000000-0000-4000-8000-0000000000b1'`, [FA]); ok('B가 자기 카테고리 id를 A의 고정 id로 update → 42501', r.err === '42501', JSON.stringify(r))
r = await as(B, `select id from categories where id='c0000000-0000-4000-8000-0000000000b1'`); ok('실패한 update 뒤 B의 카테고리 id 그대로', r.rows?.length === 1)
// 정상 경로는 막히지 않음
r = await as(B, `update categories set name='이름 수정' where id='c0000000-0000-4000-8000-0000000000b1'`); ok('B의 일반 카테고리 이름 수정 성공', r.count === 1 && !r.err, JSON.stringify(r))
r = await ins(B, 'c0000000-0000-4000-8000-0000000000b2', B, '추가'); ok('B의 일반 카테고리 추가 성공', !r.err, JSON.stringify(r))
r = await ins(B, FB, B, '차계부'); ok('B가 자기 고정 id로 insert 성공', !r.err, JSON.stringify(r))
await as(B, `delete from categories where id=$1`, [FB])
r = await as(A, `select ensure_carbook_category() as id`); ok('A: ensure 성공, 고정 id', r.rows?.[0]?.id === FA, JSON.stringify(r))
r = await as(A, `select user_id from categories where id=$1`, [FA]); ok('A: 고정 id 행의 소유자는 A', r.rows?.[0]?.user_id === A)
r = await as(A, `select ensure_carbook_category() as id`); ok('AC-08-4/13 A: 재호출도 같은 id, 오류 없음', r.rows?.[0]?.id === FA && !r.err)
r = await as(A, `select count(*)::int n from categories where id=$1`, [FA]); ok('AC-08-4/13 카테고리 1개', r.rows?.[0]?.n === 1)
const [x, y] = await Promise.all([as(A, `select ensure_carbook_category() as id`), as(A, `select ensure_carbook_category() as id`)])
ok('AC-08-13 연달아 두 번 ensure도 오류 없음·같은 id', !x.err && !y.err && x.rows?.[0]?.id === FA && y.rows?.[0]?.id === FA, JSON.stringify([x, y]))

// 정책 도입 전에 이미 선점된 상태(슈퍼유저로 삽입): ensure는 조용히 넘기지 않는다
await as(A, `delete from categories where id=$1`, [FA])
await db.exec(`insert into categories(id,user_id,name,color) values ('${FA}','${B}','선점됨','#000000')`)
r = await as(A, `select ensure_carbook_category()`); ok('이미 B가 선점한 id: A의 ensure → 42501 (조용히 넘기지 않음)', r.err === '42501', JSON.stringify(r))
await db.exec(`delete from categories where id='${FA}'; insert into categories(id,user_id,name,color) values ('${FA}','${D}','선점됨D','#000000')`)
r = await as(A, `select ensure_carbook_category()`); ok('A가 볼 수 없는 D가 선점한 id도 → 42501', r.err === '42501', JSON.stringify(r))
await db.exec(`delete from categories where id='${FA}'`)
r = await as(A, `select ensure_carbook_category() as id`); ok('선점 행을 치운 뒤 ensure 다시 성공', r.rows?.[0]?.id === FA, JSON.stringify(r))

// 권한
await db.exec('set role anon')
try { await db.query(`select is_carbook_category_id('${FA}')`); ok('anon is_carbook_category_id 실행 거부', false) } catch (e) { ok('anon is_carbook_category_id 실행 거부(42501)', e.code === '42501', e.code) }
await db.exec('reset role')
r = await as(A, `select is_carbook_category_id($1) as v, is_carbook_category_id(gen_random_uuid()) as w`, [FA]); ok('authenticated는 실행 가능(고정 id → true, 임의 id → false)', r.rows?.[0]?.v === true && r.rows?.[0]?.w === false, JSON.stringify(r))

// AC-08-16: 도입 전 사용자가 직접 만든 '차계부' 이름 카테고리(일반 id)와 그 일정
const MAN = 'c0000000-0000-4000-8000-0000000000a1', EM = 'e0000000-0000-4000-8000-0000000000a1'
await as(A, `delete from categories where id=$1`, [FA])
r = await ins(A, MAN, A, '차계부'); ok('AC-08-16 전제: A가 일반 id로 이름 "차계부" 카테고리 생성 가능', !r.err, JSON.stringify(r))
await as(A, `insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ($1,$2,'수동 일정',$3,true,'2027-03-10','2027-03-10')`, [EM, A, MAN])
r = await as(A, `select ensure_carbook_category() as id`); ok('AC-08-16 연동: 고정 id 카테고리가 따로 생김', r.rows?.[0]?.id === FA && !r.err, JSON.stringify(r))
r = await as(A, `select id, name from categories where name='차계부' order by id`); ok('AC-08-16 이름 "차계부" 카테고리가 2개(수동 + 고정 id)', r.rows?.length === 2 && r.rows.some((c) => c.id === MAN) && r.rows.some((c) => c.id === FA), JSON.stringify(r))
r = await as(A, `select category_id, title from events where id=$1`, [EM]); ok('AC-08-16 수동 카테고리의 일정은 그대로 수동 카테고리 소속', r.rows?.[0]?.category_id === MAN, JSON.stringify(r))
r = await as(B, `select id from events where id=$1`, [EM]); ok('AC-08-16 B에게 수동 카테고리 일정이 보임(숨김 대상 아님)', r.rows?.length === 1, JSON.stringify(r))
r = await as(B, `select id from categories where id=$1`, [MAN]); ok('AC-08-16 B에게 수동 카테고리도 보임', r.rows?.length === 1)
r = await as(B, `select id from categories where id=$1`, [FA]); ok('AC-16-1 B에게 고정 id 카테고리는 안 보임', r.rows?.length === 0)

// AC-16-8: 직접 만든 일정은 카테고리 삭제 후 B에게 보이고, 연결 일정은 0건. 다시 만든 뒤에도 직접 만든 일정은 DB가 다시 묶지 않는다
const ED = 'e0000000-0000-4000-8000-0000000000d1', EL = 'e0000000-0000-4000-8000-0000000000d2', V = 'f0000000-0000-4000-8000-000000000001'
await as(A, `insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ($1,$3,'직접',$4,true,'2027-03-10','2027-03-10'), ($2,$3,'연결',$4,true,'2027-03-10','2027-03-10')`, [ED, EL, A, FA])
await db.exec(`insert into vehicles(id,user_id,name) values ('${V}','${A}','내 차'); insert into car_due_dates(vehicle_id,user_id,kind,due_date,event_id) values ('${V}','${A}','insurance','2027-03-10','${EL}')`)
r = await as(B, `select id from events where id in ($1,$2)`, [ED, EL]); ok('AC-16-8 전제: 삭제 전 B에게 직접·연결 일정 모두 0건', r.rows?.length === 0, JSON.stringify(r))
await as(A, `delete from categories where id=$1`, [FA])
r = await as(B, `select id from events where id in ($1,$2)`, [ED, EL]); ok('AC-16-8 삭제 뒤 B: 직접 만든 일정만 보임, 연결 일정 0건', JSON.stringify((r.rows ?? []).map((e) => e.id)) === JSON.stringify([ED]), JSON.stringify(r))
await as(A, `select ensure_carbook_category()`)
r = await as(A, `select category_id from events where id=$1`, [ED]); ok('AC-16-8 ensure 뒤에도 직접 만든 일정은 분류 없음(DB가 다시 묶지 않음)', r.rows?.[0]?.category_id === null, JSON.stringify(r))
r = await as(B, `select id from events where id in ($1,$2)`, [ED, EL]); ok('AC-16-8 다시 만든 뒤에도 B: 직접 만든 일정 보임, 연결 일정 0건(클라이언트 재묶기 전)', JSON.stringify((r.rows ?? []).map((e) => e.id)) === JSON.stringify([ED]), JSON.stringify(r))
await as(A, `update events set category_id=$1 where id=$2`, [FA, EL]) // 클라이언트 재묶기(연결 일정만)
r = await as(B, `select id from events where id in ($1,$2)`, [ED, EL]); ok('AC-16-8 연결 일정만 재묶은 뒤에도 B: 직접 만든 일정 보임, 연결 0건', JSON.stringify((r.rows ?? []).map((e) => e.id)) === JSON.stringify([ED]), JSON.stringify(r))

done()
