// MPR-18 events RESTRICTIVE 정책 행별 함수 비용을 PGlite로 재는 측정 스크립트(현재 정책·재배열·기준선 3가지 교차 측정)
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const C = '00000000-0000-0000-0000-00000000000c'
const sizes = (process.argv[2] || '500,2004,5000,10000').split(',').map(Number)
const REPS = 20

const db = new PGlite()
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create role anon nologin; create role authenticated nologin;
grant usage on schema public, auth to anon, authenticated;
insert into auth.users values ('${A}','a@x'),('${B}','b@x'),('${C}','c@x');
`)
for (const f of ['schema', 'schema_share', 'schema_share_mutual', 'schema_together', 'schema_carbook']) {
  try { await db.exec(readFileSync(`sql/${f}.sql`, 'utf8')) } catch (e) { console.log('APPLY FAIL', f, e.message.slice(0, 200)) }
}
await db.exec(`grant all on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;`)
await db.exec(`insert into calendar_shares(id, owner_id, owner_email) values (gen_random_uuid(), '${A}', 'a@x');
insert into calendar_share_members(share_id, viewer_id, viewer_email) select id, '${B}', 'b@x' from calendar_shares;`)

const cat = (await db.query(`select carbook_category_id('${A}') id`)).rows[0].id
const pctl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] }
const stat = (a) => `avg ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}ms p95 ${pctl(a, 0.95).toFixed(1)}ms`

async function as(user) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated;`)
}
async function timeQ(user, sql) {
  await as(user)
  const t = []
  let n = 0
  for (let i = 0; i < REPS + 3; i++) {
    const ex = await db.query('explain (analyze, timing off) ' + sql)
    const l = ex.rows.map((r) => r['QUERY PLAN'])
    const ms = parseFloat(l.find((x) => x.startsWith('Execution Time')).match(/[\d.]+/)[0])
    if (i >= 3) t.push(ms)
  }
  n = (await db.query(sql)).rows[0].c
  const med = pctl(t, 0.5)
  return { n, wall: stat(t), exec: `median ${med.toFixed(1)}ms` }
}

const Q = 'select count(*) c, max(title) m from events'
for (const N of sizes) {
  await db.exec(`reset role; truncate events cascade; truncate vehicles cascade; truncate categories cascade;`)
  await db.exec(`
  insert into vehicles(user_id,name) select '${A}', 'v'||g from generate_series(1,10) g;
  -- A 일정 N건: 5% 차계부 카테고리(직접), 연결 330건(분류 없음/차계부), 2% C 참여
  insert into categories(id,user_id,name,color) values ('${cat}','${A}','차계부','#0f9d58'), (gen_random_uuid(),'${A}','업무','#111');
  insert into events(id,user_id,title,category_id,all_day,start_at,end_at)
   select gen_random_uuid(), '${A}', 't'||g,
     case when g % 20 = 0 then '${cat}'::uuid when g % 3 = 0 then (select id from categories where name='업무') else null end,
     true, to_char(date '2026-01-01' + (g % 365), 'YYYY-MM-DD'), to_char(date '2026-01-01' + (g % 365), 'YYYY-MM-DD')
   from generate_series(1,${N}) g;
  -- B 본인 일정 200건
  insert into events(id,user_id,title,all_day,start_at,end_at)
   select gen_random_uuid(), '${B}', 'b'||g, true, to_char(date '2026-01-01' + (g % 365), 'YYYY-MM-DD'), to_char(date '2026-01-01' + (g % 365), 'YYYY-MM-DD') from generate_series(1,200) g;
  -- 연결: 항목 300 + 만기일 30(차량 10 x 3종)
  with ev as (select id, row_number() over () rn from events where user_id='${A}' limit 330),
       v as (select id, row_number() over () rn from vehicles)
  insert into car_maintenance_items(user_id,vehicle_id,name,interval_km,last_date,event_id)
   select '${A}', (select id from v where rn = 1 + (ev.rn % 10)), 'i'||ev.rn, 1000, date '2026-01-01', ev.id from ev where ev.rn <= 300;
  with ev as (select id, row_number() over () rn from (select id from events where user_id='${A}' offset 300 limit 30) x),
       v as (select id, row_number() over () rn from vehicles)
  insert into car_due_dates(user_id,vehicle_id,kind,due_date,event_id)
   select '${A}', (select id from v where rn = 1 + ((ev.rn-1) / 3)::int), (array['insurance','car_tax','inspection'])[1 + ((ev.rn-1) % 3)::int], date '2026-12-01', ev.id from ev;
  insert into event_participants(event_id,user_id) select id, '${C}' from events where user_id='${A}' and title ~ '7$' limit ${Math.floor(N * 0.02)};
  analyze;`)
  const hidden = (await db.query('select count(*) c from events e where user_id=\'' + A + '\' and (category_id = \'' + cat + '\' or id in (select event_id from car_maintenance_items union select event_id from car_due_dates))')).rows[0].c
  console.log(`\n=== A 일정 ${N}건 (숨김 대상 ${hidden}), B 본인 200건 ===`)
  const pol = {
    '현재': readFileSync('sql/schema_carbook.sql', 'utf8'),
    '재배열(③을 ② 앞으로)': null,
    '정책 없음(기준선)': null,
  }
  const setCfg = async (label) => {
    await db.exec('reset role')
    await db.exec(readFileSync('sql/schema_carbook.sql', 'utf8')) // 현재 정책으로 초기화
    if (label.startsWith('정책 없음')) await db.exec(`drop policy "events_select_hide_carbook" on events; drop policy "categories_select_hide_carbook" on categories;`)
    if (label.startsWith('재배열')) await db.exec(`drop policy "events_select_hide_carbook" on events;
      create policy "events_select_hide_carbook" on events as restrictive for select using (
        (select auth.uid()) = user_id
        or (coalesce(category_id <> carbook_category_id(user_id), true) and not is_carbook_linked_event(id))
        or is_event_participant(id, false));`)
  }
  const res = {}
  for (let round = 0; round < 3; round++) {
    for (const label of Object.keys(pol)) {
      await setCfg(label)
      const b = await timeQ(B, Q)
      ;(res[label] ??= []).push(parseFloat(b.exec.match(/[\d.]+/)[0])); res[label].n = b.n
    }
  }
  for (const [l, v] of Object.entries(res)) console.log(`[${l}] B 조회 ${res[l].n}행 라운드별 중앙값(ms): ${v.join(', ')}`)
}
