// MPR-38 QA 임시 스크립트: 로그아웃 상태로 /car를 열어 MSG-02 문구·로그인 버튼과 요청 0건(AC-02-1), 로그인 버튼이 돌아올 주소로 /car를 넘기는지(AC-02-2)를 확인한다.
// 실행: node docs/qa/scripts/mpr38_signedout.mjs <playwright-core index.mjs> <앱 빌드 폴더>
import { launch, openApp, reporter, PORT } from './mpr38_lib.mjs'
setTimeout(() => process.exit(2), 120000)
const [, , PW, DIST] = process.argv
const { ok, done } = reporter()
const browser = await launch(PW)
for (const vp of ['mobile375', 'desktop1280']) {
  const a = await openApp(browser, DIST, { vp, signedIn: false }); const p = a.page
  await p.waitForTimeout(1500)
  const body = await p.locator('main').innerText()
  ok(`[${vp}] AC-02-1 로그아웃 /car: 로그인 안내 문구와 로그인 버튼이 보임(문구: ${body.replace(/\n+/g, ' / ').slice(0, 60)})`, (await p.getByRole('button', { name: /로그인/ }).count()) >= 1 && /로그인/.test(body), body)
  const hit = a.s.log.filter((e) => /^(vehicles|car_records|car_maintenance_items|car_due_dates|events|categories)/.test(e.t))
  ok(`[${vp}] AC-02-1 차계부 4개 표·events·categories 요청 0건(전체 요청 ${a.s.log.length}건: ${a.s.log.map((e) => e.t).join(',') || '없음'})`, hit.length === 0, JSON.stringify(hit.map((e) => e.t)))
  // AC-02-2: 로그인 버튼 → Supabase authorize 주소의 redirect_to가 /car
  let authorize = null
  p.on('request', (r) => { if (r.url().includes('/auth/v1/authorize')) authorize = r.url() })
  await p.route('**/auth/v1/authorize**', (r) => r.abort())
  await p.getByRole('button', { name: /로그인/ }).first().click(); await p.waitForTimeout(800)
  const redirect = authorize ? new URL(authorize).searchParams.get('redirect_to') : null
  ok(`[${vp}] AC-02-2 로그인 버튼이 돌아올 주소(redirect_to)로 /car를 넘김(${redirect})`, !!redirect && new URL(redirect).pathname === '/car', String(authorize))
  await p.screenshot({ path: process.argv[4] + `/mpr38-${vp}-signedout.png` }).catch(() => {})
  await a.close()
}
await browser.close(); done()
