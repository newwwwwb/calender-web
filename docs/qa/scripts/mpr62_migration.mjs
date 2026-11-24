// MPR-62 QA 임시 스크립트: schema_carbook_v02.sql(UP)·_down.sql(DOWN)을 PGlite(모의 Postgres, 실제 Supabase 아님)에서 개발자 테스트와 별개로 확인한다. 기존 행 불변(AC-24-5), 정책 4개·남의 차량 지정 거부(AC-19-9), 차량 삭제 후 null(AC-19-5), DOWN 순서·원자성, 되돌리기 upsert 경로.
// 실행: node docs/qa/scripts/mpr62_migration.mjs <pglite dist/index.js 절대 경로> [QA_SQL_ROOT 환경변수로 supabase 폴더 지정 가능]
import { readFileSync } from 'node:fs'
import { openDb, as, reporter } from './pg_env.mjs'

const root = process.env.QA_SQL_ROOT ? process.env.QA_SQL_ROOT.replace(/[\\/]?$/, '/') : new URL('../../../supabase/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const sql = (f) => readFileSync(root + f, 'utf8')
const UP = sql('schema_carbook_v02.sql'), DOWN = sql('schema_carbook_v02_down.sql')
const db = await openDb(process.argv[2]) // 기존 supabase/*.sql + schema_carbook.sql(2회)까지만, v0.2 전
const { ok, done } = reporter()
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c'
const VA = '10000000-0000-4000-8000-00000000000a', VA2 = '10000000-0000-4000-8000-0000000000a2', VB = '10000000-0000-4000-8000-00000000000b', VC = '10000000-0000-4000-8000-00000000000c'
const IC = '20000000-0000-4000-8000-00000000000c', IC2 = '20000000-0000-4000-8000-0000000000c2', IA = '20000000-0000-4000-8000-00000000000a'
const EV = '30000000-0000-4000-8000-00000000000c'
const cnt = async (q) => (await db.query(q)).rows[0].n
await db.exec(`insert into auth.users (id) values ('${A}'),('${B}'),('${C}')`)

// ───── v0.2 적용 전 행(기존 데이터) ─────
await db.exec(`insert into vehicles(id,user_id,name) values ('${VC}','${C}','기존차');
  insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_km,last_date,last_odometer_km,event_id) values ('${IC}','${C}','${VC}','엔진오일',10000,'2026-05-01',41000,'${EV}');
  insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_months,last_date) values ('${IC2}','${C}','${VC}','와이퍼',12,'2026-01-10');
  insert into car_records(vehicle_id,user_id,kind,date,amount_won) values ('${VC}','${C}','fuel','2026-10-01',50000);
  insert into car_due_dates(vehicle_id,user_id,kind,due_date) values ('${VC}','${C}','insurance','2027-03-10')`)
const snap = async () => (await db.query(`select 'v' t, id::text, xmin::text x, to_jsonb(v)::text j from vehicles v union all select 'i', id::text, xmin::text, to_jsonb(i)::text from car_maintenance_items i union all select 'r', id::text, xmin::text, to_jsonb(r)::text from car_records r union all select 'd', id::text, xmin::text, to_jsonb(d)::text from car_due_dates d order by 1,2`)).rows.map((r) => r.t + r.id + r.x + r.j).join('\n')
const before = await snap()
const nBefore = [await cnt('select count(*)::int n from vehicles'), await cnt('select count(*)::int n from car_maintenance_items'), await cnt('select count(*)::int n from car_records'), await cnt('select count(*)::int n from car_due_dates')]
ok('적용 전 last_date는 not null', (await db.query(`select is_nullable n from information_schema.columns where table_name='car_maintenance_items' and column_name='last_date'`)).rows[0].n === 'NO')
ok('적용 전 car_settings 없음', (await cnt(`select count(*)::int n from pg_tables where tablename='car_settings'`)) === 0)

// ───── UP(8.3 순서 1단계) ─────
let err = ''; try { await db.exec(UP) } catch (e) { err = e.code || e.message }
ok('UP 1회 적용 오류 없음', err === '', err)
const after = await snap()
ok('AC-24-5 기존 행 전부 xmin·전체 열 동일(UPDATE 0건)', after === before, '차이 있음')
ok('기존 행 수 동일(차량·항목·기록·만기일)', JSON.stringify([await cnt('select count(*)::int n from vehicles'), await cnt('select count(*)::int n from car_maintenance_items'), await cnt('select count(*)::int n from car_records'), await cnt('select count(*)::int n from car_due_dates')]) === JSON.stringify(nBefore))
err = ''; try { await db.exec(UP) } catch (e) { err = e.code || e.message }
ok('UP 2회째(재실행)도 오류 없음, 기존 행 계속 동일', err === '' && (await snap()) === before, err)
ok('last_date가 null 허용(YES)', (await db.query(`select is_nullable n from information_schema.columns where table_name='car_maintenance_items' and column_name='last_date'`)).rows[0].n === 'YES')
ok('1990 미만 날짜는 여전히 거부(23514), null은 통과', (await db.exec(`insert into car_maintenance_items(vehicle_id,user_id,name,interval_km,last_date) values ('${VC}','${C}','x',1,null)`).then(() => 'ok', (e) => e.code)) === 'ok' && (await db.exec(`insert into car_maintenance_items(vehicle_id,user_id,name,interval_km,last_date) values ('${VC}','${C}','y',1,'1980-01-01')`).then(() => 'ok', (e) => e.code)) === '23514')
await db.exec(`delete from car_maintenance_items where name in ('x','y')`)

// ───── 정책 4개 ─────
const pol = (await db.query(`select policyname, cmd, roles::text r, permissive p from pg_policies where tablename='car_settings' order by policyname`)).rows
ok('car_settings 정책 정확히 4개(select·insert·update·delete, 이름 일치)', JSON.stringify(pol.map((p) => p.policyname + ':' + p.cmd)) === JSON.stringify(['car_settings_delete_own:DELETE', 'car_settings_insert_own:INSERT', 'car_settings_select_own:SELECT', 'car_settings_update_own:UPDATE']), JSON.stringify(pol))
ok('정책 4개 모두 authenticated 대상', pol.every((p) => p.r === '{authenticated}'), JSON.stringify(pol.map((p) => p.r)))
ok('RLS 켜짐', (await db.query(`select relrowsecurity r from pg_class where relname='car_settings'`)).rows[0].r === true)
ok('user_id가 기본 키, default_vehicle_id 부분 인덱스 존재', (await cnt(`select count(*)::int n from pg_indexes where tablename='car_settings' and indexname in ('car_settings_pkey','car_settings_default_vehicle_id_idx')`)) === 2)

// ───── AC-19-9 격리·거부, AC-19-5 삭제 ─────
await as(db, A, `insert into vehicles(id,name) values ($1,'A차')`, [VA]); await as(db, A, `insert into vehicles(id,name) values ($1,'A둘째')`, [VA2]); await as(db, B, `insert into vehicles(id,name) values ($1,'B차')`, [VB])
let r = await as(db, A, `insert into car_settings(default_vehicle_id) values ($1) on conflict (user_id) do update set default_vehicle_id=excluded.default_vehicle_id returning user_id, default_vehicle_id`, [VA])
ok('A: user_id 없이 upsert → user_id=A, 기본 차량 A차', r.rows?.[0]?.user_id === A && r.rows?.[0]?.default_vehicle_id === VA, JSON.stringify(r))
r = await as(db, A, `insert into car_settings(default_vehicle_id) values ($1) on conflict (user_id) do update set default_vehicle_id=excluded.default_vehicle_id returning default_vehicle_id`, [VA2])
ok('A: 같은 upsert 반복 → 행 1개 유지, 값 갱신', r.rows?.[0]?.default_vehicle_id === VA2 && (await cnt(`select count(*)::int n from car_settings where user_id='${A}'`)) === 1, JSON.stringify(r))
r = await as(db, B, `select * from car_settings`); ok('AC-19-9 B가 읽기 → 0행(A 행은 있음)', r.rows?.length === 0 && (await cnt('select count(*)::int n from car_settings')) === 1, JSON.stringify(r))
r = await as(db, B, `select * from car_settings where user_id=$1`, [A]); ok('B가 user_id=A로 직접 조회 → 0행', r.rows?.length === 0)
r = await as(db, B, `update car_settings set default_vehicle_id=null where user_id=$1`, [A]); ok('B가 A 설정 수정 → 0행', r.count === 0 && !r.err, JSON.stringify(r))
r = await as(db, B, `delete from car_settings where user_id=$1`, [A]); ok('B가 A 설정 삭제 → 0행', r.count === 0 && !r.err, JSON.stringify(r))
r = await as(db, B, `insert into car_settings(user_id, default_vehicle_id) values ($1,null)`, [A]); ok('B가 user_id=A로 insert → 42501', r.err === '42501', JSON.stringify(r))
r = await as(db, B, `insert into car_settings(default_vehicle_id) values ($1)`, [VA]); ok('AC-19-9 B가 자기 행에 A의 차량 id를 지정(insert) → 42501', r.err === '42501', JSON.stringify(r))
r = await as(db, B, `insert into car_settings(default_vehicle_id) values ($1)`, [VB]); ok('B가 자기 차량 지정 insert → 성공', !r.err, JSON.stringify(r))
r = await as(db, B, `update car_settings set default_vehicle_id=$1 where user_id=$2`, [VA, B]); ok('AC-19-9 B가 자기 행을 A의 차량 id로 update → 42501, 값 그대로', r.err === '42501' && (await cnt(`select count(*)::int n from car_settings where user_id='${B}' and default_vehicle_id='${VB}'`)) === 1, JSON.stringify(r))
r = await as(db, B, `insert into car_settings(default_vehicle_id) values ($1) on conflict (user_id) do update set default_vehicle_id=excluded.default_vehicle_id`, [VA]); ok('B의 upsert(update 경로)로 A 차량 지정 → 42501', r.err === '42501', JSON.stringify(r))
r = await as(db, B, `insert into car_settings(default_vehicle_id) values ('99999999-9999-4999-8999-999999999999') on conflict (user_id) do update set default_vehicle_id=excluded.default_vehicle_id`); ok('존재하지 않는 차량 id 지정 → 42501(존재 여부를 구분하지 않음)', r.err === '42501', JSON.stringify(r))
r = await as(db, B, `update car_settings set default_vehicle_id=null where user_id=$1`, [B]); ok('자기 행 null로 해제 → 성공', !r.err && r.count === 1, JSON.stringify(r))
await db.exec('reset role')
r = await db.exec(`set role anon; select * from car_settings`).then(() => 'ok', (e) => e.code); await db.exec('reset role'); ok('anon은 car_settings 접근 불가(42501)', r === '42501', String(r))
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','',false)`); r = await db.query('select * from car_settings').then((x) => x.rows.length, (e) => e.code); await db.exec('reset role'); ok('로그인 없는 authenticated(uid 없음)는 0행', r === 0, String(r))
// AC-19-5: 기본 차량 삭제 → 설정 행 유지, null
await as(db, A, `update car_settings set default_vehicle_id=$1 where user_id=$2`, [VA2, A])
r = await as(db, A, `delete from vehicles where id=$1`, [VA2])
const row = (await db.query(`select default_vehicle_id d from car_settings where user_id='${A}'`)).rows
ok('AC-19-5 기본 차량 삭제 → 설정 행은 남고 default_vehicle_id=null', !r.err && row.length === 1 && row[0].d === null, JSON.stringify({ r, row }))
await as(db, A, `update car_settings set default_vehicle_id=$1 where user_id=$2`, [VA, A])
r = await as(db, A, `delete from auth.users where id='${C}'`).catch(() => ({})); // 사용자 삭제 연쇄는 service 권한 시험이라 생략
await db.exec(`delete from auth.users where id='${B}'`)
ok('사용자 삭제 → 그 사용자의 설정 행도 삭제(cascade)', (await cnt(`select count(*)::int n from car_settings where user_id='${B}'`)) === 0)
await db.exec(`insert into auth.users (id) values ('${B}') on conflict do nothing`)

// ───── 되돌리기 upsert 경로(ADR-009): 클라이언트 upsert는 id로 충돌, 이름·주기만 보냄 ─────
await as(db, A, `insert into car_maintenance_items(id,vehicle_id,name,interval_km,last_date,last_odometer_km,event_id) values ($1,$2,'타이어',30000,'2026-02-01',20000,$3)`, [IC, VA, EV]).catch(() => {})
await db.exec(`insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_km,last_date,last_odometer_km,event_id,created_at) values ('${IA}','${A}','${VA}','타이어',30000,'2026-02-01',20000,'30000000-0000-4000-8000-0000000000aa','2026-02-02 00:00:00+00')`)
const cols = `event_id, last_date::text last_date, last_odometer_km, created_at::text created_at`
const b4 = (await as(db, A, `select ${cols} from car_maintenance_items where id=$1`, [IA])).rows?.[0]
r = await as(db, A, `insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_km,interval_months) values ($1,$2,$3,'타이어',40000,48) on conflict (id) do update set name=excluded.name, interval_km=excluded.interval_km, interval_months=excluded.interval_months`, [IA, A, VA])
const af = (await as(db, A, `select ${cols}, interval_km, interval_months from car_maintenance_items where id=$1`, [IA])).rows?.[0]
ok('되돌리기 upsert: 이름·주기만 보내도 event_id·last_date·last_odometer_km·created_at 그대로, 주기만 갱신', !r.err && JSON.stringify(af) === JSON.stringify({ ...b4, interval_km: 40000, interval_months: 48 }), JSON.stringify({ r, b4, af }))
// 미입력(last_date null) 항목 만들기 → 같은 upsert가 23502 없이 갱신
await db.exec(`insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_km) values ('20000000-0000-4000-8000-0000000000b1','${A}','${VA}','엔진오일',5000)`)
r = await as(db, A, `insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_km) values ('20000000-0000-4000-8000-0000000000b1',$1,$2,'엔진오일',7000) on conflict (id) do update set interval_km=excluded.interval_km returning interval_km, last_date`, [A, VA])
ok('되돌리기 upsert: 이미 미입력인 항목(last_date null)도 23502 없이 갱신', !r.err && r.rows?.[0]?.interval_km === 7000 && r.rows?.[0]?.last_date === null, JSON.stringify(r))
r = await as(db, B, `insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_km) values ('20000000-0000-4000-8000-0000000000b1',$1,$2,'해킹',1) on conflict (id) do update set name=excluded.name`, [B, VA])
ok('B가 A 항목 id로 upsert 시도 → 거부 또는 변경 0건(이름 그대로)', (r.err || '') !== '' || (await cnt(`select count(*)::int n from car_maintenance_items where id='20000000-0000-4000-8000-0000000000b1' and name='엔진오일'`)) === 1, JSON.stringify(r))

// ───── DOWN 순서·원자성(8.3) ─────
const nullRows = await cnt('select count(*)::int n from car_maintenance_items where last_date is null')
ok('8.3 1단계 쿼리: 미입력 행 수 1(이후 단계가 갈리는 조건)', nullRows === 1, String(nullRows))
const pre = await snap(), setBefore = (await db.query('select user_id::text u, default_vehicle_id::text d from car_settings order by 1')).rows
err = ''; try { await db.exec(DOWN) } catch (e) { err = e.code || e.message }; await db.exec('rollback').catch(() => {})
ok('DOWN을 미입력 행이 있는 채 실행 → 23502로 전체 취소', err === '23502', err)
ok('취소 뒤 car_settings 테이블·정책 4개·설정 행 그대로', (await cnt(`select count(*)::int n from pg_tables where tablename='car_settings'`)) === 1 && (await cnt(`select count(*)::int n from pg_policies where tablename='car_settings'`)) === 4 && JSON.stringify((await db.query('select user_id::text u, default_vehicle_id::text d from car_settings order by 1')).rows) === JSON.stringify(setBefore))
ok('취소 뒤 last_date는 아직 null 허용, 모든 행 변경 0건(xmin·열 동일)', (await db.query(`select is_nullable n from information_schema.columns where table_name='car_maintenance_items' and column_name='last_date'`)).rows[0].n === 'YES' && (await snap()) === pre)
ok('DOWN 파일에 행을 지우거나 채우는 문장 없음(delete/update/insert/truncate 단어 없음)', !/\b(delete|update|insert|truncate)\b/i.test(DOWN.replace(/--.*$/gm, '')), DOWN)
// 사용자 조치를 흉내 낸 시험용 문장: 행을 채운다
await db.exec(`update car_maintenance_items set last_date='2026-01-01' where last_date is null`)
err = ''; try { await db.exec(DOWN) } catch (e) { err = e.code || e.message }
ok('행을 채운 뒤 DOWN 성공', err === '', err)
ok('DOWN 뒤 car_settings 없음, 정책·인덱스도 함께 사라짐', (await cnt(`select count(*)::int n from pg_tables where tablename='car_settings'`)) === 0 && (await cnt(`select count(*)::int n from pg_policies where tablename='car_settings'`)) === 0 && (await cnt(`select count(*)::int n from pg_indexes where tablename='car_settings'`)) === 0)
ok('DOWN 뒤 last_date not null 복귀', (await db.query(`select is_nullable n from information_schema.columns where table_name='car_maintenance_items' and column_name='last_date'`)).rows[0].n === 'NO')
ok('DOWN은 기존 차량·기록·만기일을 건드리지 않음(차량 수 동일)', (await cnt(`select count(*)::int n from vehicles where id='${VC}'`)) === 1)
err = ''; try { await db.exec(UP) } catch (e) { err = e.code || e.message }
ok('DOWN 뒤 UP 재적용 성공, 정책 4개 복구, last_date 다시 null 허용', err === '' && (await cnt(`select count(*)::int n from pg_policies where tablename='car_settings'`)) === 4 && (await db.query(`select is_nullable n from information_schema.columns where table_name='car_maintenance_items' and column_name='last_date'`)).rows[0].n === 'YES', err)
done()
