// MPR-29 QA 임시 스크립트: 주소 이동·파일철 탭 AC를 Playwright로 확인하고 375px·1280px 스크린샷을 남긴다.
// 실행: node docs/qa/scripts/mpr29_nav.mjs <playwright-core 경로> <현재 앱 URL> <탭 도입 전 앱 URL> <스크린샷 폴더>
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const [, , pwPath, BASE, BEFORE, SHOTS] = process.argv
const { chromium } = await import(pathToFileURL(pwPath).href)
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`) }
const MOBILE = { width: 375, height: 760 }, DESKTOP = { width: 1280, height: 800 }
const newPage = async (viewport, base = BASE) => { const ctx = await browser.newContext({ viewport }); const p = await ctx.newPage(); return { ctx, p, base } }
const tabs = (p) => p.locator('nav[aria-label="화면 전환"] a')
const path = (p) => new URL(p.url()).pathname
const h1 = (p) => p.locator('h1').allTextContents()

for (const [label, vp] of [['mobile375', MOBILE], ['desktop1280', DESKTOP]]) {
  const { ctx, p } = await newPage(vp)
  // AC-01-1 / AC-02-4(탭 표시)
  await p.goto(BASE + '/'); await p.waitForSelector('nav[aria-label="화면 전환"]')
  ok(`[${label}] AC-02-4 로그인 전 / 에서 탭 2개`, (await tabs(p).count()) === 2 && (await tabs(p).allTextContents()).join() === '캘린더,차계부')
  await p.screenshot({ path: `${SHOTS}/mpr29-${label}-calendar.png` })
  await tabs(p).nth(1).click()
  ok(`[${label}] AC-01-1 차계부 탭 → /car`, path(p) === '/car')
  ok(`[${label}] AC-01-1 차계부 화면(h1 차계부)`, (await h1(p)).includes('차계부'), String(await h1(p)))
  ok(`[${label}] 현재 탭 aria-current`, (await tabs(p).nth(1).getAttribute('aria-current')) === 'page' && (await tabs(p).nth(0).getAttribute('aria-current')) === null)
  ok(`[${label}] 화면 전환 시 document.title`, (await p.title()) === '차계부')
  await p.screenshot({ path: `${SHOTS}/mpr29-${label}-car.png` })
  await tabs(p).nth(0).click()
  ok(`[${label}] AC-01-1 캘린더 탭 → /`, path(p) === '/' && (await h1(p)).includes('캘린더 앱'))
  // AC-01-2
  await tabs(p).nth(1).click()
  await p.goBack(); ok(`[${label}] AC-01-2 뒤로 → / 캘린더`, path(p) === '/' && (await h1(p)).includes('캘린더 앱'), p.url())
  await p.goForward(); ok(`[${label}] AC-01-2 앞으로 → /car`, path(p) === '/car' && (await h1(p)).includes('차계부'), p.url())
  await p.reload(); await p.waitForSelector('h1')
  ok(`[${label}] AC-01-2 /car 새로고침 → /car 유지`, path(p) === '/car' && (await h1(p)).includes('차계부'))
  // F-01 예외: 같은 경로 탭 클릭은 기록을 쌓지 않는다
  const len0 = await p.evaluate(() => history.length); await tabs(p).nth(1).click()
  ok(`[${label}] 같은 탭 재클릭 history 불변`, (await p.evaluate(() => history.length)) === len0)
  // AC-01-3
  await p.goto(BASE + '/abc'); await p.waitForSelector('h1')
  ok(`[${label}] AC-01-3 /abc → 캘린더`, (await h1(p)).includes('캘린더 앱'))
  await p.goto(BASE + '/car/'); await p.waitForSelector('h1')
  ok(`[${label}] AC-01-3 /car/ → 차계부`, (await h1(p)).includes('차계부') && (await tabs(p).nth(1).getAttribute('aria-current')) === 'page')
  // AC-01-6: 단축키 격리 (대조: 캘린더에서는 n이 편집창을 연다)
  await p.goto(BASE + '/'); await p.waitForSelector('h1')
  await p.keyboard.press('n')
  ok(`[${label}] AC-01-6 대조: 캘린더에서 n → 편집창 열림`, (await p.locator('[role=dialog]').count()) > 0)
  await ctx.close()
  const c2 = await newPage(vp); const q = c2.p
  await q.goto(BASE + '/car'); await q.waitForSelector('nav[aria-label="화면 전환"]')
  await tabs(q).nth(1).focus(); await q.keyboard.press('n'); await q.waitForTimeout(300)
  ok(`[${label}] AC-01-6 /car 링크 포커스에서 n → 편집창 없음`, (await q.locator('[role=dialog]').count()) === 0)
  // 캘린더에서 /car로 이동한 뒤에도 n 무반응
  await q.goto(BASE + '/'); await q.waitForSelector('h1'); await tabs(q).nth(1).click(); await tabs(q).nth(1).focus()
  await q.keyboard.press('n'); await q.waitForTimeout(300)
  ok(`[${label}] AC-01-6 탭 이동 후 /car 에서 n → 편집창 없음`, (await q.locator('[role=dialog]').count()) === 0)
  await c2.ctx.close()
}

// AC-01-4: Ctrl+클릭 / Meta+클릭
{
  const { ctx, p } = await newPage(DESKTOP)
  await p.goto(BASE + '/'); await p.waitForSelector('nav[aria-label="화면 전환"]')
  for (const mod of ['Control']) { // Meta(Cmd)+클릭의 새 탭 열기는 Mac 브라우저 동작이라 Windows에서는 아래 defaultPrevented 검사로 대신한다
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), tabs(p).nth(1).click({ modifiers: [mod] })])
    ok(`AC-01-4 ${mod}+클릭: 새 탭 열림`, !!popup)
    if (popup) { await popup.waitForLoadState(); ok(`AC-01-4 ${mod}+클릭: 새 탭 주소 /car`, new URL(popup.url()).pathname === '/car', popup.url()); await popup.close() }
    ok(`AC-01-4 ${mod}+클릭: 현재 탭 주소·화면 그대로`, path(p) === '/' && (await h1(p)).includes('캘린더 앱'))
  }
  // 보조키 클릭은 앱이 막지 않아야 브라우저가 새 탭을 연다. 문서 단계 리스너(앱 핸들러 뒤)에서 defaultPrevented를 읽고 이동은 직접 막는다
  const prevented = await p.evaluate(() => {
    const a = document.querySelector('nav[aria-label="화면 전환"] a[href="/car"]'); const out = {}
    const spy = (e) => { out.cur = e.defaultPrevented; e.preventDefault() }
    document.addEventListener('click', spy)
    for (const key of ['metaKey', 'shiftKey', 'altKey']) { out.cur = null; a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, [key]: true })); out[key] = out.cur }
    out.cur = null; a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 })); out.middle = out.cur
    document.removeEventListener('click', spy)
    return out
  })
  for (const [k, label] of [['metaKey', 'Meta(Cmd)'], ['shiftKey', 'Shift'], ['altKey', 'Alt'], ['middle', '가운데 버튼']]) ok(`AC-01-4 ${label}+클릭: 앱이 기본 동작을 막지 않음(브라우저가 새 탭을 열 수 있음)`, prevented[k] === false, JSON.stringify(prevented))
  ok('AC-01-4 보조키 클릭 뒤 현재 탭 그대로', path(p) === '/')
  await ctx.close()
}

// AC-13
for (const [label, vp] of [['mobile375', MOBILE], ['desktop1280', DESKTOP]]) {
  const a = await newPage(vp); await a.p.goto(BASE + '/?widget=1'); await a.p.waitForSelector('h1')
  ok(`[${label}] AC-13-1 /?widget=1 파일철 탭 DOM 없음`, (await a.p.locator('nav[aria-label="화면 전환"]').count()) === 0)
  await a.p.screenshot({ path: `${SHOTS}/mpr29-${label}-widget.png` })
  const b = await newPage(vp); await b.p.goto(BASE + '/'); await b.p.waitForSelector('nav[aria-label="화면 전환"]')
  ok(`[${label}] AC-13-2 일반 접속 탭 2개`, (await tabs(b.p).count()) === 2)
  // AC-13-3: 탭 도입 전 빌드와 위젯 화면의 요소 위치·크기가 같다(CSS 모듈 해시는 경로마다 달라 클래스 이름에서 뺀다)
  const rects = (p) => p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().width > 0)
    .map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName}.${String(e.className).split(' ').map((c) => c.replace(/_[a-zA-Z0-9]{5}_\d+$/, '')).join(' ')}|${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}` }))
  const old = await newPage(vp); await old.p.goto(BEFORE + '/?widget=1'); await old.p.waitForSelector('h1')
  for (const x of [a, old]) await x.p.waitForTimeout(800)
  const now = await rects(a.p), before = await rects(old.p)
  const diff = now.filter((r, i) => r !== before[i])
  ok(`[${label}] AC-13-3 위젯 화면 요소 ${now.length}개 배치가 탭 도입 전과 같음`, now.length === before.length && diff.length === 0, `now=${now.length} before=${before.length} 첫 차이=${diff[0]}`)
  const c = await newPage(vp); await c.p.goto(BASE + '/car?widget=1'); await c.p.waitForSelector('h1')
  ok(`[${label}] AC-13-4 위젯에서 /car 직접 열기: 차계부 열림·탭 없음`, (await h1(c.p)).includes('차계부') && (await c.p.locator('nav[aria-label="화면 전환"]').count()) === 0)
  for (const x of [a, b, old, c]) await x.ctx.close()
}

await browser.close()
console.log(`\nRESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
