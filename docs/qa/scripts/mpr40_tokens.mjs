// MPR-40 QA 임시 스크립트: 파일철 탭 토큰 이동 전·후의 계산된 스타일이 같은지, 탭이 없던 때와 캘린더 배치(360·899px)가 같은지 Playwright로 확인한다.
// 실행: node docs/qa/scripts/mpr40_tokens.mjs <playwright-core index.mjs> <현재 URL> <토큰 이동 전(7bd906b) URL> <탭 없던 때(ec21359) URL> <스크린샷 폴더>
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const [, , pwPath, NOW, BEFORE, NOTABS, SHOTS] = process.argv
const { chromium } = await import(pathToFileURL(pwPath).href)
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`) }
const PROPS = ['position', 'zIndex', 'top', 'right', 'width', 'height', 'transform', 'display', 'flexDirection', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'backgroundImage',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderTopStyle', 'borderTopColor', 'borderLeftColor', 'borderTopLeftRadius', 'borderBottomLeftRadius',
  'boxShadow', 'outlineWidth', 'outlineStyle', 'outlineColor', 'outlineOffset', 'cursor', 'writingMode']
const page = async (vp, url) => { const c = await browser.newContext({ viewport: vp }); const p = await c.newPage(); await p.goto(url); await p.waitForSelector('h1', { state: 'attached' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500); return { c, p } }
const snap = (p) => p.evaluate((props) => {
  const out = {}
  const els = [['nav', document.querySelector('nav[aria-label="화면 전환"]')], ...[...document.querySelectorAll('nav[aria-label="화면 전환"] a')].map((a, i) => [`tab${i}`, a]), ...[...document.querySelectorAll('nav[aria-label="화면 전환"] a span')].map((s, i) => [`label${i}`, s])]
  for (const [k, e] of els) { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); out[k] = { ...Object.fromEntries(props.map((q) => [q, cs[q]])), rect: [r.x, r.y, r.width, r.height].map(Math.round).join(',') } }
  return out
}, PROPS)
const diff = (a, b) => { const d = []; for (const k of Object.keys(a)) for (const q of Object.keys(a[k])) if (a[k][q] !== b[k]?.[q]) d.push(`${k}.${q}: ${a[k][q]} != ${b[k]?.[q]}`); return d }

for (const [label, vp] of [['mobile375', { width: 375, height: 760 }], ['tablet899', { width: 899, height: 800 }], ['desktop1280', { width: 1280, height: 800 }]]) {
  for (const [route, state] of [['/', '캘린더 화면(캘린더 탭이 현재)'], ['/car', '/car 화면(차계부 탭이 현재)']]) {
    const a = await page(vp, NOW + route), b = await page(vp, BEFORE + route)
    const sa = await snap(a.p), sb = await snap(b.p)
    const d = diff(sa, sb)
    ok(`[${label}] ${state}: 탭 계산 스타일 ${Object.keys(sa).length}개 요소×${PROPS.length + 1}항목이 토큰 이동 전과 같음`, d.length === 0, d.slice(0, 4).join(' | '))
    // 상태: hover·focus-visible
    await a.p.locator('nav a').nth(route === '/' ? 1 : 0).hover(); await b.p.locator('nav a').nth(route === '/' ? 1 : 0).hover()
    const ha = await snap(a.p), hb = await snap(b.p); const dh = diff(ha, hb)
    ok(`[${label}] ${state}: hover 상태 스타일 같음`, dh.length === 0, dh.slice(0, 4).join(' | '))
    await a.p.mouse.move(0, 0); await b.p.mouse.move(0, 0)
    // 키보드 조작 뒤 탭 링크에 포커스를 옮겨야 :focus-visible이 켜진다(캘린더 화면은 탭 정지점이 많아 Tab 반복 대신 직접 포커스)
    for (const x of [a, b]) { await x.p.keyboard.press('Tab'); await x.p.locator('nav a').nth(route === '/' ? 1 : 0).focus() }
    const fa = await snap(a.p), fb = await snap(b.p); const df = diff(fa, fb)
    ok(`[${label}] ${state}: 키보드 포커스 상태 스타일 같음`, df.length === 0, df.slice(0, 4).join(' | '))
    ok(`[${label}] ${state}: 포커스 윤곽 2px 표시(outlineWidth)`, Object.values(fa).some((x) => x.outlineStyle === 'solid' && x.outlineWidth === '2px'), JSON.stringify(Object.values(fa).map((x) => x.outlineWidth)))
    if (route === '/') await a.p.screenshot({ path: `${SHOTS}/mpr40-${label}-calendar.png` })
    else await a.p.screenshot({ path: `${SHOTS}/mpr40-${label}-car.png` })
    // 토큰 값이 :root에서 그대로 읽히는지(현재 빌드)
    const tok = await a.p.evaluate(() => { const s = getComputedStyle(document.documentElement); return ['--z-tab', '--tab-mobile-w', '--tab-mobile-h', '--tab-desktop-w', '--tab-desktop-h', '--tab-center-mobile', '--tab-center-desktop', '--tab-gutter', '--tab-inset', '--line-thin', '--line-medium', '--line-accent'].map((n) => s.getPropertyValue(n).trim()) })
    if (route === '/') ok(`[${label}] :root 토큰 값(z 60, 탭 28×56·32×96, 중심 40%·50%, 여백 ${vp.width >= 900 ? 40 : 36}px, 선 1·2·4px)`,
      JSON.stringify(tok) === JSON.stringify(['60', '28px', '56px', '32px', '96px', '40%', '50%', vp.width >= 900 ? '40px' : '36px', '0px', '1px', '2px', '4px']), JSON.stringify(tok))
    await a.c.close(); await b.c.close()
  }
}

// AC-14-4: 360px·899px에서 탭이 있는 화면의 캘린더 요소(탭 제외) 위치·크기가 탭이 없던 때(ec21359)와 같음
for (const w of [360, 899]) {
  const vp = { width: w, height: 760 }
  const rects = (p) => p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => !e.closest('nav[aria-label="화면 전환"]') && e.getBoundingClientRect().width > 0)
    .map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName}.${String(e.className).split(' ').map((c) => c.replace(/_[a-zA-Z0-9]{5}_\d+$/, '')).join(' ')}|${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}` }))
  const a = await page(vp, NOW + '/'), b = await page(vp, NOTABS + '/'); await a.p.waitForTimeout(800); await b.p.waitForTimeout(800)
  const ra = await rects(a.p), rb = await rects(b.p)
  const d = ra.filter((r, i) => r !== rb[i])
  ok(`[${w}px] AC-14-4 캘린더 요소 ${ra.length}개 위치·크기가 탭 없던 때와 같음`, ra.length === rb.length && d.length === 0, `now=${ra.length} before=${rb.length} 첫 차이=${d[0]}`)
  ok(`[${w}px] 가로 스크롤 없음`, await a.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await a.c.close(); await b.c.close()
}

await browser.close()
console.log(`\nRESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
