// MPR-28 QA 임시 스크립트: 열 때 점검이 실제로 보낸 재묶기 질의(mpr28_reconcile.qa.tsx가 남긴 JSON)를 PGlite에서 재생해 AC-16-6·AC-16-8(공유 상대 B의 눈에 연결 일정 0건, 직접 만든 일정은 계속 보임)을 확인한다. 실제 Supabase가 아니다.
// 실행: node docs/qa/scripts/mpr28_visibility.mjs <pglite dist/index.js 절대 경로> <mpr28_ops.json>
import { readFileSync } from 'node:fs'
import { openDb, as as asUser, reporter } from './pg_env.mjs'

const cap = JSON.parse(readFileSync(process.argv[3], 'utf8')) // { L1, DIRECT, rebinds: [{ ids, user }] }
const db = await openDb(process.argv[2])
const { ok, done } = reporter()
const U = (n) => `00000000-0000-4000-8000-0000000000${n}`
const A = U('0a'), B = U('0b')
const as = (uid, q, params) => asUser(db, uid, q, params)
const seen = async (uid) => (await as(uid, `select id from events where id = any($1::uuid[])`, [[cap.L1, cap.DIRECT]])).rows.map((r) => r.id).sort()
const catOf = async (id) => (await as(A, `select category_id from events where id=$1`, [id])).rows[0]?.category_id

await db.exec(`
  insert into auth.users (id, email) values ('${A}','a@x'), ('${B}','b@x');
  insert into calendar_shares (id, owner_id, owner_email) values ('50000000-0000-4000-8000-000000000001', '${A}', 'a@x');
  insert into calendar_share_members (share_id, viewer_id, viewer_email) values ('50000000-0000-4000-8000-000000000001', '${B}', 'b@x');
`)
const CAT = (await as(A, `select ensure_carbook_category() as id`)).rows[0].id
const ev = (id, cat) => as(A, `insert into events(id,user_id,title,category_id,all_day,start_at,end_at) values ($1,$2,'t',$3,true,'2027-03-10','2027-03-10')`, [id, A, cat])
await ev(cap.L1, CAT); await ev(cap.DIRECT, CAT)
await db.exec(`
  insert into vehicles(id,user_id,name) values ('f0000000-0000-4000-8000-00000000000a','${A}','내 차');
  insert into car_maintenance_items(vehicle_id,user_id,name,interval_km,last_date,event_id) values ('f0000000-0000-4000-8000-00000000000a','${A}','엔진오일',10000,'2026-05-01','${cap.L1}');
`)

ok('전제: 차계부 카테고리 상태에서 B에게 연결 일정·직접 만든 일정 모두 0건', (await seen(B)).length === 0)
ok('전제: A에게는 둘 다 보임', (await seen(A)).length === 2)
await as(A, `delete from categories where id=$1`, [CAT])
ok('전제: 카테고리 삭제로 두 일정의 분류가 풀림', (await catOf(cap.L1)) === null && (await catOf(cap.DIRECT)) === null)
ok('AC-16-6 카테고리 삭제 뒤, 다시 묶이기 전: B에게 연결 일정 0건', !(await seen(B)).includes(cap.L1))
ok('AC-16-8 카테고리 삭제 뒤: 직접 만든 일정은 B에게 보임', (await seen(B)).includes(cap.DIRECT))

// 열 때 점검 재생: ensure → 점검이 보낸 update(user_id = 나, id in 대상)를 같은 모양으로 실행
const CAT2 = (await as(A, `select ensure_carbook_category() as id`)).rows[0].id
ok('ensure가 같은 고정 id로 카테고리를 다시 만듦', CAT2 === CAT)
ok('점검이 보낸 재묶기 질의가 있음(연결 일정만 포함)', cap.rebinds.length >= 1 && cap.rebinds.every((r) => r.ids.includes(cap.L1) && !r.ids.includes(cap.DIRECT)), JSON.stringify(cap.rebinds))
for (const r of cap.rebinds) await as(A, `update events set category_id=$1 where user_id=$2 and id = any($3::uuid[])`, [CAT2, A, r.ids])

ok('재묶기 뒤 연결 일정은 차계부 카테고리에 속함', (await catOf(cap.L1)) === CAT)
ok('AC-16-8 재묶기 뒤에도 직접 만든 일정은 분류 없음 그대로(다시 묶이지 않음)', (await catOf(cap.DIRECT)) === null)
ok('AC-16-6 다시 묶인 뒤에도 B에게 연결 일정 0건', !(await seen(B)).includes(cap.L1))
ok('AC-16-8 다시 묶인 뒤에도 직접 만든 일정은 B에게 계속 보임', (await seen(B)).includes(cap.DIRECT))
ok('A 본인에게는 둘 다 보임', (await seen(A)).length === 2)
done()
