// MPR-31 QA 임시 스크립트: 가짜 Supabase 주소로 빌드한 실제 앱에서 /car 로그인 게이트·복귀 주소·실패·세션 복원 5초·요청 0건을 Playwright로 확인한다.
// 실행: node docs/qa/scripts/mpr31_gate.mjs <playwright-core index.mjs> <앱 URL(정적 서버)> <스크린샷 폴더>
// 앱은 VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fakekey 로 빌드해 정적 서버로 띄운다(실제 백엔드 호출 없음).
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const [, , pwPath, APP, SHOTS] = process.argv
const { chromium } = await import(pathToFileURL(pwPath).href)
mkdirSync(SHOTS, { recursive: true })
const HOST = 'https://fake.supabase.test'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`) }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-1', aud: 'authenticated', role: 'authenticated', exp })}.sig`
const session = (expiresAt) => ({ access_token: jwt(expiresAt), refresh_token: 'r1', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user: { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'a@b.c', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } })
const KEY = 'sb-fake-auth-token'

async function open(vp, { stored = null, route, url = '/car' } = {}) {
  const ctx = await browser.newContext({ viewport: vp })
  if (stored) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1') } }, [KEY, JSON.stringify(stored)])
  const reqs = []
  await ctx.route(`${HOST}/**`, async (r) => { const u = new URL(r.request().url()); reqs.push({ method: r.request().method(), path: u.pathname + u.search, t: Date.now() }); if (route) return route(r, u); return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"x"}' }) })
  const page = await ctx.newPage(); const logs = []; page.on('console', (m) => logs.push(`${m.type()}:${m.text()}`))
  const t0 = Date.now(); await page.goto(APP + url)
  return { ctx, page, reqs, logs, t0 }
}
const rest = (reqs) => reqs.filter((r) => /\/rest\/v1\//.test(r.path))
const gateText = '로그인하면 사용할 수 있습니다'

for (const [label, vp] of [['mobile375', { width: 375, height: 760 }], ['desktop1280', { width: 1280, height: 800 }]]) {
  // AC-02-1 비로그인: 안내 + 로그인 버튼, 데이터 요청 0건
  {
    const { ctx, page, reqs } = await open(vp)
    await page.waitForSelector('h1', { state: 'attached' }); await page.waitForTimeout(1500)
    const body = await page.locator('main').innerText()
    ok(`[${label}] AC-02-1 MSG-02 문구와 로그인 버튼`, body.includes(gateText) && (await page.getByRole('button', { name: '로그인' }).count()) === 1, body)
    ok(`[${label}] AC-02-1 하위 탭·차량 영역 없음`, (await page.getByRole('tablist').count()) === 0)
    const evtCat = reqs.filter((r) => /\/rest\/v1\/(events|categories|vehicles|car_)/.test(r.path))
    ok(`[${label}] AC-02-1 차계부 4개 테이블·events·categories 요청 0건 (Supabase 전체 요청 ${reqs.length}건: ${reqs.map((r) => r.path).join(',')})`, evtCat.length === 0 && rest(reqs).length === 0)
    ok(`[${label}] AC-02-1 가로 스크롤 없음`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await page.screenshot({ path: `${SHOTS}/mpr31-${label}-gate.png` }); await ctx.close()
  }
}

// AC-02-2 / 02-3 로그인 시작: Google 승인 요청의 복귀 주소가 현재 주소(/car)
for (const [label, vp] of [['mobile375', { width: 375, height: 760 }], ['desktop1280', { width: 1280, height: 800 }]]) {
  let authorize = null
  const { ctx, page, reqs, logs } = await open(vp, { route: (r, u) => { if (u.pathname === '/auth/v1/authorize') { authorize = u; return r.fulfill({ status: 302, headers: { location: `${APP}/car?error=access_denied&error_description=cancelled` } }) } return r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }) }, url: '/car?x=1' })
  await page.waitForSelector('h1', { state: 'attached' })
  await page.getByRole('button', { name: '로그인' }).click(); await page.waitForTimeout(1200)
  const redirect = authorize?.searchParams.get('redirect_to')
  ok(`[${label}] AC-02-2 승인 요청이 나가고 provider=google`, authorize !== null && authorize.searchParams.get('provider') === 'google', String(authorize))
  ok(`[${label}] AC-02-2 복귀 주소 = 현재 주소(${APP}/car?x=1)`, redirect === `${APP}/car?x=1`, String(redirect))
  // AC-02-3 Google이 취소(access_denied)로 /car에 돌려보내도(승인 요청에 302로 응답) 안내가 그대로, 데이터 요청 0건
  ok(`[${label}] AC-02-3 중단 뒤 주소는 /car 그대로이고 안내 화면 유지`, new URL(page.url()).pathname === '/car' && (await page.locator('main').innerText()).includes(gateText), page.url())
  ok(`[${label}] AC-02-3 데이터 요청 0건`, rest(reqs).length === 0)
  await ctx.close(); void logs
}
// AC-02-3 OAuth 오류로 돌아온 경우(/car?error=access_denied...) 안내 유지, 요청 0건
{
  const { ctx, page, reqs, logs } = await open({ width: 375, height: 760 }, { url: '/car?error=access_denied&error_description=User%20cancelled' })
  await page.waitForSelector('h1', { state: 'attached' }); await page.waitForTimeout(1500)
  ok('AC-02-3 오류 복귀(error=access_denied): 안내 화면이 보임', (await page.locator('main').innerText()).includes(gateText) && new URL(page.url()).pathname === '/car', page.url())
  ok('AC-02-3 오류 복귀: 데이터 요청 0건, 오류는 콘솔에만', rest(reqs).length === 0 && logs.some((l) => l.includes('[auth] OAuth 리다이렉트 에러')), logs.join(' | '))
  await ctx.close()
}

// AC-02-2 로그인을 마치고 돌아온 상태(세션 있음): 주소는 /car 그대로, 안내 없음, 차계부 영역(불러오는 중 스텁)
for (const [label, vp] of [['mobile375', { width: 375, height: 760 }], ['desktop1280', { width: 1280, height: 800 }]]) {
  const { ctx, page } = await open(vp, { stored: session(Math.floor(Date.now() / 1000) + 3600) })
  await page.waitForSelector('h1', { state: 'attached' }); await page.waitForTimeout(1500)
  ok(`[${label}] AC-02-2 로그인 상태: 주소 /car 유지, 안내(로그인 버튼) 없음`, new URL(page.url()).pathname === '/car' && (await page.getByRole('button', { name: '로그인' }).count()) === 0, page.url())
  ok(`[${label}] 로그인 상태: 차계부 h1·탭 2개(차계부가 현재)`, (await page.locator('h1').first().innerText()).includes('차계부') && (await page.locator('nav[aria-label="화면 전환"] a').count()) === 2)
  await page.screenshot({ path: `${SHOTS}/mpr31-${label}-signedin.png` }); await ctx.close()
}

// AC-02-5 세션 복원 지연: 만료된 세션 → 토큰 갱신 응답이 7초 걸림
for (const [label, vp] of [['mobile375', { width: 375, height: 760 }], ['desktop1280', { width: 1280, height: 800 }]]) {
  const { ctx, page, reqs, t0 } = await open(vp, { stored: session(Math.floor(Date.now() / 1000) - 600), route: async (r, u) => { if (u.pathname === '/auth/v1/token') { await new Promise((s) => setTimeout(s, 7000)); return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant"}' }) } return r.fulfill({ status: 400, body: '{}' }) } })
  await page.waitForSelector('h1', { state: 'attached' })
  const at = async (ms) => { const w = t0 + ms - Date.now(); if (w > 0) await page.waitForTimeout(w) }
  await at(1000)
  ok(`[${label}] AC-02-5 1초: 갱신 요청이 나갔고 로딩 표시, 안내 없음`, reqs.some((r) => r.path.startsWith('/auth/v1/token')) && (await page.getByRole('status').count()) === 1 && (await page.getByRole('button', { name: '로그인' }).count()) === 0, JSON.stringify(reqs))
  if (label === 'mobile375') await page.screenshot({ path: `${SHOTS}/mpr31-${label}-restoring.png` })
  await at(4400)
  ok(`[${label}] AC-02-5 4.4초: 아직 로딩`, (await page.getByRole('status').count()) === 1 && (await page.getByRole('button', { name: '로그인' }).count()) === 0)
  await at(5700)
  const stillPending = Date.now() - t0 < 6900
  ok(`[${label}] AC-02-5 5.7초(복원 응답 전): 로그인 안내가 보임`, stillPending && (await page.getByRole('button', { name: '로그인' }).count()) === 1 && (await page.locator('main').innerText()).includes(gateText), `elapsed=${Date.now() - t0}`)
  ok(`[${label}] AC-02-5 안내 상태에서도 데이터 요청 0건`, rest(reqs).length === 0)
  if (label === 'mobile375') await page.screenshot({ path: `${SHOTS}/mpr31-${label}-timeout-gate.png` })
  await ctx.close()
}
// AC-02-5 경계: 복원이 2초에 끝나면(만료 세션 갱신 성공) 안내 없이 차계부로
{
  const { ctx, page, t0 } = await open({ width: 375, height: 760 }, { stored: session(Math.floor(Date.now() / 1000) - 600), route: async (r, u) => { if (u.pathname === '/auth/v1/token') { await new Promise((s) => setTimeout(s, 2000)); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session(Math.floor(Date.now() / 1000) + 3600)) }) } return r.fulfill({ status: 400, body: '{}' }) } })
  await page.waitForSelector('h1', { state: 'attached' })
  let sawGate = false
  while (Date.now() - t0 < 7500) { if ((await page.getByRole('button', { name: '로그인' }).count()) > 0) sawGate = true; await page.waitForTimeout(100) }
  ok('AC-02-5 경계: 2초 만에 복원되면 로그인 안내가 한 번도 보이지 않음', !sawGate)
  await ctx.close()
}
// AC-02-4 비로그인에서 /를 열면 탭 2개, "차계부" 탭을 누르면 /car의 안내 화면(MPR-29 때 미룬 재확인)
for (const [label, vp] of [['mobile375', { width: 375, height: 760 }], ['desktop1280', { width: 1280, height: 800 }]]) {
  const { ctx, page, reqs } = await open(vp, { url: '/' })
  await page.waitForSelector('nav[aria-label="화면 전환"]', { state: 'attached' }); await page.waitForTimeout(1000)
  ok(`[${label}] AC-02-4 /에서 파일철 탭 2개(캘린더·차계부)`, (await page.locator('nav[aria-label="화면 전환"] a').allInnerTexts()).map((t) => t.trim()).join() === '캘린더,차계부')
  await page.locator('nav[aria-label="화면 전환"] a', { hasText: '차계부' }).click(); await page.waitForTimeout(800)
  ok(`[${label}] AC-02-4 차계부 탭 → 주소 /car, 안내 화면`, new URL(page.url()).pathname === '/car' && (await page.locator('main').innerText()).includes(gateText), page.url())
  ok(`[${label}] AC-02-4 이동 뒤에도 차계부 데이터 요청 0건`, rest(reqs).length === 0)
  await ctx.close()
}
await browser.close()
console.log(`\nRESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
