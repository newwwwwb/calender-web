// QA 임시 스크립트 공용: PGlite에 Supabase와 같은 모양의 최소 환경과 기존 supabase/*.sql을 먼저 적용한다. 실제 Supabase가 아니다.
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

// QA_SQL_ROOT를 주면 그 폴더의 SQL을 쓴다(병합 전 브랜치의 SQL을 `git show <커밋>:supabase/<파일>`로 꺼내 확인할 때)
const root = process.env.QA_SQL_ROOT ? pathToFileURL(process.env.QA_SQL_ROOT.replace(/[\/]?$/, '/')) : new URL('../../../supabase/', import.meta.url)
const read = (f) => readFileSync(new URL(f, root), 'utf8')
// schema_share_fix*.sql은 PGlite에서 함수 인자명 오류가 나 제외한다(공유 판정 함수는 schema_share_mutual.sql이 다시 정의한다). docs/db.md 7.1과 같은 순서
export const BASE_SQL = ['schema.sql', 'schema_share.sql', 'schema_share_mutual.sql', 'schema_together.sql']

export async function openDb(pglitePath, { carbook = true } = {}) {
  const { PGlite } = await import(pathToFileURL(pglitePath).href)
  const db = new PGlite()
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated; create role anon;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
  `)
  for (const f of BASE_SQL) await db.exec(read(f))
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated`)
  if (carbook) { const sql = read('schema_carbook.sql'); await db.exec(sql); await db.exec(sql) } // 두 번 적용해 재실행 안전도 함께 확인
  return db
}

// 사용자 uid로 역할을 바꿔 질의한다. 오류는 { err: 코드 }로 돌려준다
export async function as(db, uid, q, params) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`)
  try { const r = await db.query(q, params); return { rows: r.rows, count: r.affectedRows ?? r.rows.length } }
  catch (e) { return { err: e.code || e.message } }
  finally { await db.exec('reset role') }
}

export function reporter() {
  let pass = 0, fail = 0
  return {
    ok(name, cond, extra = '') { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`) },
    done() { console.log(`\nRESULT pass=${pass} fail=${fail}`); process.exit(fail ? 1 : 0) },
  }
}
