// @vitest-environment node
// 차계부 테이블 4개 RLS·제약·삭제 연쇄 회귀 테스트(AC-03-2, AC-03-6). PGlite(메모리 Postgres) 모의 환경이며 실제 Supabase 검증이 아니다.
// 주의: 앞 it이 만든 데이터에 뒤 it이 의존한다(순서 의존). it.only로 단독 실행하면 실패한다.
// 원본 docs/qa/scripts/mpr17_rls.mjs 24개 판정 = 여기 21개 it. 삭제 연쇄의 '지운 차량 0건'+'다른 차량 1건' 쌍 3개(6판정)를 it 하나(3개)로 묶었고 제외한 케이스는 없다.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')
// docs/db.md 7.1과 같은 순서. schema_share_fix*.sql은 PGlite에서 함수 인자명 오류가 나 제외한다(schema_share_mutual.sql이 다시 정의)
const BASE_SQL = ['schema.sql', 'schema_share.sql', 'schema_share_mutual.sql', 'schema_together.sql']

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const VA = '10000000-0000-4000-8000-00000000000a'
const VA2 = '10000000-0000-4000-8000-0000000000a2'
const C = '00000000-0000-4000-8000-00000000000c' // v0.2 적용 전에 이미 있던 행의 주인(MPR-62)
const VC = '10000000-0000-4000-8000-00000000000c'
const IC = '20000000-0000-4000-8000-00000000000c'

type Res = { rows?: Record<string, unknown>[]; count?: number; err?: string }

let db: PGlite
let legacyBefore = '' // v0.2 적용 전 기존 정비 항목의 xmin과 전체 열

// 사용자 uid로 역할을 바꿔 질의한다. 오류는 { err: 코드 }로 돌려준다
async function as(uid: string, q: string, params?: unknown[]): Promise<Res> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`)
  try {
    const r = await db.query<Record<string, unknown>>(q, params)
    return { rows: r.rows, count: r.affectedRows ?? r.rows.length }
  } catch (e) {
    const err = e as { code?: string; message: string }
    return { err: err.code || err.message }
  } finally {
    await db.exec('reset role')
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated; create role anon;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
  `)
  for (const f of BASE_SQL) await db.exec(read(`./${f}`))
  await db.exec('grant select, insert, update, delete on all tables in schema public to authenticated')
  const carbook = read('./schema_carbook.sql')
  await db.exec(carbook)
  await db.exec(carbook) // 두 번 적용해 재실행 안전도 함께 확인
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}')`)
  // v0.2 적용 전부터 있던 행. 적용이 이 행을 건드리지 않는지 xmin(마지막으로 쓴 트랜잭션)과 열 전체로 비교한다
  await db.exec(`insert into vehicles(id,user_id,name) values ('${VC}','${C}','기존차');
    insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_km,last_date,last_odometer_km,event_id)
    values ('${IC}','${C}','${VC}','엔진오일',10000,'2026-05-01',41000,'30000000-0000-4000-8000-00000000000c')`)
  legacyBefore = await snapshotLegacy()
  const v02 = read('./schema_carbook_v02.sql')
  await db.exec(v02)
  await db.exec(v02) // 재실행 안전
}, 60_000)

async function snapshotLegacy(): Promise<string> {
  const r = await db.query<{ s: string }>(`select xmin::text || to_jsonb(i)::text as s from car_maintenance_items i where id='${IC}'`)
  return r.rows[0]?.s ?? ''
}

afterAll(async () => {
  await db.close()
})

describe('차계부 RLS (AC-03-2, AC-03-6)', () => {
  it('정상: A가 차량을 추가하면 user_id가 자동으로 채워진다', async () => {
    const r = await as(A, 'insert into vehicles(id,name) values ($1,$2) returning id,user_id', [VA, '출퇴근'])
    expect(r.rows?.[0]?.user_id).toBe(A)
    await as(A, 'insert into vehicles(id,name) values ($1,$2)', [VA2, '세컨드'])
    for (const v of [VA, VA2]) {
      const seed = [
        await as(A, `insert into car_records(vehicle_id,kind,date,amount_won) values ($1,'fuel','2026-10-01',50000)`, [v]),
        await as(A, `insert into car_maintenance_items(vehicle_id,name,interval_km,last_date) values ($1,'엔진오일',10000,'2026-05-01')`, [v]),
        await as(A, `insert into car_due_dates(vehicle_id,kind,due_date) values ($1,'insurance','2027-03-10')`, [v]),
      ]
      expect(seed.map((s) => s.err)).toEqual([undefined, undefined, undefined])
    }
  })

  it.each(['vehicles', 'car_records', 'car_maintenance_items', 'car_due_dates'])('B가 %s를 조회하면 0행', async (t) => {
    expect((await as(B, `select id from ${t}`)).rows).toHaveLength(0)
  })

  it('B가 A 차량 id로 직접 조회해도 0행', async () => {
    expect((await as(B, 'select id from vehicles where id=$1', [VA])).rows).toHaveLength(0)
  })

  it('B가 A 차량을 수정하면 0행이 바뀐다', async () => {
    const r = await as(B, `update vehicles set name='해킹' where id=$1`, [VA])
    expect(r).toMatchObject({ count: 0 })
    expect(r.err).toBeUndefined()
  })

  it('B가 A 차량을 삭제하면 0행이 지워진다', async () => {
    const r = await as(B, 'delete from vehicles where id=$1', [VA])
    expect(r).toMatchObject({ count: 0 })
    expect(r.err).toBeUndefined()
  })

  it('A 차량 이름은 그대로다', async () => {
    expect((await as(A, 'select name from vehicles where id=$1', [VA])).rows?.[0]?.name).toBe('출퇴근')
  })

  it('실패: B가 user_id=A로 차량 insert하면 42501', async () => {
    const r = await as(B, `insert into vehicles(id,user_id,name) values (gen_random_uuid(),$1,'위조')`, [A])
    expect(r.err).toBe('42501')
  })

  it('실패: B가 A 차량에 기록 insert하면 42501', async () => {
    const r = await as(B, `insert into car_records(vehicle_id,kind,date,amount_won) values ($1,'fuel','2026-10-01',1)`, [VA])
    expect(r.err).toBe('42501')
  })

  it('실패: B가 A 차량에 정비 항목 insert하면 42501', async () => {
    const r = await as(B, `insert into car_maintenance_items(vehicle_id,name,interval_km,last_date) values ($1,'x',1,'2026-01-01')`, [VA])
    expect(r.err).toBe('42501')
  })

  it('실패: B가 A 차량에 만기일 insert하면 42501', async () => {
    const r = await as(B, `insert into car_due_dates(vehicle_id,kind,due_date) values ($1,'inspection','2027-01-01')`, [VA])
    expect(r.err).toBe('42501')
  })

  it('경계: 로그인 없음(uid 없음)은 조회 0행', async () => {
    const r = await as('', 'select count(*)::int n from vehicles')
    expect(r.rows?.[0]?.n).toBe(0)
  })

  it('경계: anon 역할은 조회가 42501', async () => {
    await db.exec('set role anon')
    try {
      await expect(db.query('select * from vehicles')).rejects.toMatchObject({ code: '42501' })
    } finally {
      await db.exec('reset role')
    }
  })

  it('경계: 같은 차량·종류 만기일 중복은 23505', async () => {
    const r = await as(A, `insert into car_due_dates(vehicle_id,kind,due_date) values ($1,'insurance','2027-04-01')`, [VA])
    expect(r.err).toBe('23505')
  })

  it('삭제 연쇄: A가 차량을 지우면 1행 삭제', async () => {
    expect((await as(A, 'delete from vehicles where id=$1', [VA])).count).toBe(1)
  })

  it.each(['car_records', 'car_maintenance_items', 'car_due_dates'])('삭제 연쇄: 지운 차량의 %s는 0건, 다른 차량은 1건 유지', async (t) => {
    const gone = await as(A, `select count(*)::int n from ${t} where vehicle_id=$1`, [VA])
    const kept = await as(A, `select count(*)::int n from ${t} where vehicle_id=$1`, [VA2])
    expect([gone.rows?.[0]?.n, kept.rows?.[0]?.n]).toEqual([0, 1])
  })

  it('삭제 연쇄: 다른 차량 행은 유지', async () => {
    expect((await as(A, 'select count(*)::int n from vehicles')).rows?.[0]?.n).toBe(1)
  })
})

// v0.2 (MPR-62, ADR-007·009). 위 describe가 끝난 상태(A에게 차량 VA2 하나)에서 이어진다. 이것도 앞 it의 데이터에 의존한다
const VB = '10000000-0000-4000-8000-00000000000b'
const IA = '20000000-0000-4000-8000-00000000000a'
const IA2 = '20000000-0000-4000-8000-0000000000a2'
const EV = '30000000-0000-4000-8000-00000000000a'
const upsertSetting = 'insert into car_settings(default_vehicle_id) values ($1) on conflict (user_id) do update set default_vehicle_id = excluded.default_vehicle_id returning user_id, default_vehicle_id'
const countOf = async (q: string) => (await db.query<{ n: number }>(q)).rows[0]?.n

describe('차계부 v0.2 car_settings·last_date (AC-19-5, AC-19-9, AC-24-5)', () => {
  it('적용: v0.2 적용 전부터 있던 정비 항목 행은 적용 뒤에도 그대로다(UPDATE 0건)', async () => {
    expect(legacyBefore).not.toBe('')
    expect(await snapshotLegacy()).toBe(legacyBefore)
  })

  it('A가 user_id 없이 upsert하면 user_id=auth.uid()로 채워진다', async () => {
    const r = await as(A, upsertSetting, [VA2])
    expect(r.rows?.[0]).toEqual({ user_id: A, default_vehicle_id: VA2 })
  })

  it('A가 같은 upsert를 다시 하면 행이 늘지 않고, null로 해제도 된다', async () => {
    const r = await as(A, upsertSetting, [null])
    expect(r.rows?.[0]).toEqual({ user_id: A, default_vehicle_id: null })
    expect((await as(A, 'select count(*)::int n from car_settings')).rows?.[0]?.n).toBe(1)
  })

  it('실패: 남의 차량 id 지정은 42501 (이미 내 행이 있는 upsert=update 경로, 새 행 insert 경로 모두)', async () => {
    await as(B, 'insert into vehicles(id,name) values ($1,$2)', [VB, 'B차'])
    expect((await as(A, upsertSetting, [VB])).err).toBe('42501')
    expect((await as(A, 'update car_settings set default_vehicle_id=$1', [VB])).err).toBe('42501')
    expect((await as(B, 'insert into car_settings(default_vehicle_id) values ($1)', [VA2])).err).toBe('42501')
    expect((await as(A, 'select default_vehicle_id from car_settings')).rows?.[0]?.default_vehicle_id).toBeNull()
  })

  it('A가 내 차량을 지정하면 저장된다', async () => {
    expect((await as(A, upsertSetting, [VA2])).rows?.[0]?.default_vehicle_id).toBe(VA2)
  })

  it('실패: B가 user_id=A로 설정 행을 넣으면 42501', async () => {
    expect((await as(B, 'insert into car_settings(user_id) values ($1)', [A])).err).toBe('42501')
  })

  it('B가 A의 설정을 읽으면 0행, 고치면 0행 변경, 지우면 0행 삭제, A 값은 그대로', async () => {
    expect((await as(B, 'select user_id from car_settings')).rows).toHaveLength(0)
    expect((await as(B, 'update car_settings set default_vehicle_id=null where user_id=$1', [A])).count).toBe(0)
    expect((await as(B, 'delete from car_settings where user_id=$1', [A])).count).toBe(0)
    expect((await as(A, 'select default_vehicle_id from car_settings')).rows?.[0]?.default_vehicle_id).toBe(VA2)
  })

  it('경계: 로그인 없음은 0행, anon은 42501', async () => {
    expect((await as('', 'select count(*)::int n from car_settings')).rows?.[0]?.n).toBe(0)
    await db.exec('set role anon')
    try {
      await expect(db.query('select * from car_settings')).rejects.toMatchObject({ code: '42501' })
    } finally {
      await db.exec('reset role')
    }
  })

  it('차량 삭제: 기본 차량을 지우면 설정 행은 남고 default_vehicle_id만 null(AC-19-5)', async () => {
    expect((await as(A, 'delete from vehicles where id=$1', [VA2])).count).toBe(1)
    expect((await as(A, 'select user_id, default_vehicle_id from car_settings')).rows).toEqual([{ user_id: A, default_vehicle_id: null }])
  })

  it('last_date null로 정비 항목을 넣을 수 있다(미입력 항목, AC-24-5)', async () => {
    await as(A, 'insert into vehicles(id,name) values ($1,$2)', [VA, '복구차'])
    const r = await as(A, 'insert into car_maintenance_items(id,vehicle_id,name,interval_km) values ($1,$2,$3,$4) returning last_date', [IA, VA, '엔진오일', 10000])
    expect(r.err).toBeUndefined()
    expect(r.rows?.[0]?.last_date).toBeNull()
  })

  it('경계: 날짜를 넣으면 1990-01-01 하한 check는 그대로 동작한다(23514)', async () => {
    const r = await as(A, "insert into car_maintenance_items(vehicle_id,name,interval_km,last_date) values ($1,'x',1,'1980-01-01')", [VA])
    expect(r.err).toBe('23514')
  })

  it('되돌리기 upsert: 이름·주기만 보내도 기존 행의 event_id·last_date·last_odometer_km·created_at이 그대로다(ADR-009)', async () => {
    const seed = await as(A, "insert into car_maintenance_items(id,vehicle_id,name,interval_km,last_date,last_odometer_km,event_id) values ($1,$2,'타이어',30000,'2026-02-01',20000,$3)", [IA2, VA, EV])
    expect(seed.err).toBeUndefined()
    const cols = 'event_id, last_date::text as last_date, last_odometer_km, created_at::text as created_at'
    const before = (await as(A, `select ${cols} from car_maintenance_items where id=$1`, [IA2])).rows?.[0]
    const up = await as(
      A,
      `insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_km,interval_months) values ($1,$2,$3,'타이어',40000,48)
       on conflict (id) do update set name=excluded.name, interval_km=excluded.interval_km, interval_months=excluded.interval_months`,
      [IA2, A, VA],
    )
    expect(up.err).toBeUndefined()
    const after = (await as(A, `select ${cols}, interval_km, interval_months from car_maintenance_items where id=$1`, [IA2])).rows?.[0]
    expect(before?.event_id).toBe(EV)
    expect(after).toEqual({ ...before, interval_km: 40000, interval_months: 48 })
  })

  it('되돌리기 upsert: 이미 미입력인 항목(last_date null)도 23502 없이 갱신된다', async () => {
    const r = await as(
      A,
      `insert into car_maintenance_items(id,user_id,vehicle_id,name,interval_km) values ($1,$2,$3,'엔진오일',7000)
       on conflict (id) do update set interval_km=excluded.interval_km returning interval_km, last_date`,
      [IA, A, VA],
    )
    expect(r.rows?.[0]).toEqual({ interval_km: 7000, last_date: null })
  })

  it('실패: B가 남의 차량에 항목을 넣으면 42501', async () => {
    const r = await as(B, `insert into car_maintenance_items(vehicle_id,name,interval_km) values ($1,'x',1)`, [VA])
    expect(r.err).toBe('42501')
  })

  it('DOWN: 미입력(last_date null) 행이 있으면 전체가 취소되고 car_settings도 남는다', async () => {
    await expect(db.exec(read('./schema_carbook_v02_down.sql'))).rejects.toMatchObject({ code: '23502' })
    await db.exec('rollback') // 실패한 begin 블록 정리
    expect(await countOf("select count(*)::int n from pg_tables where tablename='car_settings'")).toBe(1)
  })

  it('DOWN: 미입력 행을 채우면 car_settings가 사라지고 last_date가 not null로 돌아오며, UP을 다시 적용할 수 있다', async () => {
    await db.exec("update car_maintenance_items set last_date='2026-01-01' where last_date is null") // 사용자 조치를 흉내 낸 시험용 문장
    await db.exec(read('./schema_carbook_v02_down.sql'))
    expect(await countOf("select count(*)::int n from pg_tables where tablename='car_settings'")).toBe(0)
    const nullable = await db.query<{ is_nullable: string }>("select is_nullable from information_schema.columns where table_name='car_maintenance_items' and column_name='last_date'")
    expect(nullable.rows[0]?.is_nullable).toBe('NO')
    await db.exec(read('./schema_carbook_v02.sql'))
    expect(await countOf("select count(*)::int n from pg_policies where tablename='car_settings'")).toBe(4)
  })
})
