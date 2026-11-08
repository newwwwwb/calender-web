// MPR-30 QA 임시 스크립트: 모바일(360px, 터치) 파일철 탭의 FAB 비겹침·터치 크기·탭 밖 스와이프·FAB 동작·캘린더 배치 불변·탭 전환 시간·글자 정렬을 Playwright로 확인한다.
// 실행: node docs/qa/scripts/mpr30_mobile.mjs <playwright-core index.mjs> <현재 빌드 폴더(--base ./)> <탭 없던 때(ec21359) 빌드 폴더(--base ./)> <스크린샷 폴더> (서버 없이 route로 파일을 내려준다)
import { pathToFileURL } from 'node:url'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const [, , pwPath, NOW, NOTABS, SHOTS] = process.argv
const { chromium } = await import(pathToFileURL(pwPath).href)
mkdirSync(SHOTS, { recursive: true })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`) }
const ORIGINS = { now: 'http://qa-now.local', old: 'http://qa-old.local' }
const dirs = { now: NOW, old: NOTABS }

async function open(which, vp, touch) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch })
  await ctx.route(`${ORIGINS[which]}/**`, (r) => { const p = new URL(r.request().url()).pathname; const f = join(dirs[which], p === '/' ? 'index.html' : p); return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: types[extname(f)] ?? 'application/octet-stream' }) : r.fulfill({ status: 404 }) })
  await ctx.route((u) => !Object.values(ORIGINS).includes(u.origin), (r) => r.abort())
  const page = await ctx.newPage(); await page.goto(ORIGINS[which] + '/'); await page.waitForSelector('h1', { state: 'attached' }); await page.waitForTimeout(900)
  return { ctx, page }
}
const box = (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
const inter = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)

// 360×640 터치: AC-14-1·3·5, AC-14-2
{
  const { ctx, page } = await open('now', { width: 360, height: 640 }, true)
  const tabs = []; for (const a of await page.locator('nav[aria-label="화면 전환"] a').all()) tabs.push(await box(a))
  const fab = await box(page.getByRole('button', { name: '새 일정' }))
  ok(`[360×640] 탭 2개 확인(${tabs.map((t) => `${Math.round(t.w)}×${Math.round(t.h)}`).join(', ')}), FAB ${Math.round(fab.w)}×${Math.round(fab.h)}`, tabs.length === 2)
  ok('AC-14-1 탭 각각의 터치 영역과 FAB의 교집합이 없음', tabs.every((t) => !inter(t, fab)), JSON.stringify({ tabs, fab }))
  ok('AC-14-5 탭 각각 터치 영역 너비 24px 이상, 높이 44px 이상', tabs.every((t) => t.w >= 24 && t.h >= 44), JSON.stringify(tabs))
  const cx = fab.x + fab.w / 2, cy = fab.y + fab.h / 2
  ok('AC-14-3 FAB 중심 점의 최상위 요소가 FAB(탭이 가리지 않음)', await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label') === '새 일정', [cx, cy]))
  await page.touchscreen.tap(cx, cy); await page.waitForTimeout(500)
  ok('AC-14-3 FAB 중심을 누르면 새 일정 편집창이 열림', (await page.getByRole('dialog').count()) > 0)
  await page.screenshot({ path: `${SHOTS}/mpr30-mobile360-fab-dialog.png` }); await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  // 스와이프: 시작점이 탭 터치 영역 밖(탭과 FAB 모두 피한 왼쪽)
  const status = () => page.locator('[role=status]').first().textContent()
  const before = await status(); const cdp = await ctx.newCDPSession(page)
  const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  const startX = 250; ok(`AC-14-2 시작점(${startX},300)은 탭 영역 밖`, tabs.every((b) => !(startX >= b.x && startX <= b.x + b.w && 300 >= b.y && 300 <= b.y + b.h)))
  await t('touchStart', startX, 300); for (let i = 1; i <= 10; i++) { await t('touchMove', startX - i * 20, 300); await page.waitForTimeout(16) } await t('touchEnd'); await page.waitForTimeout(700)
  const after = await status(); ok(`AC-14-2 탭 밖에서 가로 스와이프하면 기간이 넘어감(${before} → ${after})`, before !== after)
  await page.screenshot({ path: `${SHOTS}/mpr30-mobile360-calendar.png` }); await ctx.close()
}
// 글자 정렬: 모든 탭의 라벨이 같은 세로선에 놓임(MPR-30 보정)
for (const [label, vp, touch] of [['mobile360', { width: 360, height: 640 }, true], ['desktop1280', { width: 1280, height: 800 }, false]]) {
  const { ctx, page } = await open('now', vp, touch)
  const centers = await page.locator('nav[aria-label="화면 전환"] a span').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return r.x + r.width / 2 }))
  ok(`[${label}] 현재 탭·비선택 탭 라벨 중심 x가 같은 세로선(차이 ${Math.abs(centers[0] - centers[1]).toFixed(2)}px ≤ 1px)`, centers.length === 2 && Math.abs(centers[0] - centers[1]) <= 1, JSON.stringify(centers))
  await page.locator('nav[aria-label="화면 전환"] a', { hasText: '차계부' }).click(); await page.waitForTimeout(400)
  const c2 = await page.locator('nav[aria-label="화면 전환"] a span').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return r.x + r.width / 2 }))
  ok(`[${label}] /car(현재 탭이 바뀐 상태)에서도 정렬(차이 ${Math.abs(c2[0] - c2[1]).toFixed(2)}px ≤ 1px)`, Math.abs(c2[0] - c2[1]) <= 1, JSON.stringify(c2))
  await page.screenshot({ path: `${SHOTS}/mpr30-${label}-car-tabs.png`, clip: { x: vp.width - 120, y: 0, width: 120, height: vp.height } }); await ctx.close()
}
// AC-14-4 / AC-01-5: 360×640·899×700 요소 위치·크기가 탭 없던 때와 같음
for (const vp of [{ width: 360, height: 640 }, { width: 899, height: 700 }]) {
  const rects = (p) => p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => !e.closest('nav[aria-label="화면 전환"]') && e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName}.${String(e.className).split(' ').map((c) => c.replace(/_[a-zA-Z0-9]{5}_\d+$/, '')).join(' ')}|${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}` }))
  const a = await open('now', vp, true), b = await open('old', vp, true); await a.page.waitForTimeout(500)
  const ra = await rects(a.page), rb = await rects(b.page), d = ra.filter((r, i) => r !== rb[i])
  ok(`[${vp.width}×${vp.height}] AC-14-4·AC-01-5 캘린더 요소 ${ra.length}개(헤더·그리드·사이드바·버튼 포함)의 위치·크기가 탭 없던 때와 같음`, ra.length === rb.length && d.length === 0, `now=${ra.length} old=${rb.length} 첫 차이=${d[0]}`)
  ok(`[${vp.width}×${vp.height}] 가로 스크롤 없음`, await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); await a.ctx.close(); await b.ctx.close()
}
// AC-01-7: 데스크톱 "차계부" 탭 클릭 → 화면 전환 완료(데이터 로딩 제외) 10회
{
  const { ctx, page } = await open('now', { width: 1280, height: 800 }, false)
  const ms = []
  for (let i = 0; i < 10; i++) {
    const to = i % 2 === 0 ? '차계부' : '캘린더', mark = to === '차계부' ? 'h1:has-text("차계부")' : 'h1:has-text("캘린더")'
    const v = await page.evaluate(async (target) => {
      const link = [...document.querySelectorAll('nav[aria-label="화면 전환"] a')].find((a) => a.textContent.includes(target)); const t0 = performance.now(); link.click()
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t0
    }, to); ms.push(v); void mark
  }
  const sorted = [...ms].sort((x, y) => x - y); const p95 = sorted[9]
  console.log('AC-01-7 전환 ms(클릭→두 프레임 뒤):', ms.map((x) => x.toFixed(1)).join(', '), '| p95≈최댓값', p95.toFixed(1))
  ok(`AC-01-7 데스크톱 탭 전환 10회 p95 ${p95.toFixed(1)}ms ≤ 100ms`, p95 <= 100)
  const lastPath = await page.evaluate(() => location.pathname); ok('AC-01-7 10회 왕복 뒤 주소가 /(짝수 번째 전환이 캘린더로)', lastPath === '/', lastPath); await ctx.close()
}
await browser.close()
console.log(`\nRESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
