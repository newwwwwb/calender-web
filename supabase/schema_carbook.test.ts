// @vitest-environment node
// 차계부 테이블 4개 RLS·제약·삭제 연쇄 회귀 테스트(AC-03-2, AC-03-6). PGlite(메모리 Postgres) 모의 환경이며 실제 Supabase 검증이 아니다.
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

type Res = { rows?: Record<string, unknown>[]; count?: number; err?: string }

let db: PGlite

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
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`)
}, 60_000)

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
