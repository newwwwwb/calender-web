// MPR-44 QA 임시 스크립트: 이전 main(67586ac) 빌드와 MPR-44 병합 뒤 빌드의 캘린더 화면을 같은 조건(375·1280px, 라이트·다크, 동작 줄이기, 날짜 고정)으로 열어 스크린샷 바이트와 :root의 기존 변수 값이 같은지 비교한다.
// 실행: node docs/qa/scripts/mpr44_calendar.mjs <playwright-core index.mjs> <이전 빌드 폴더> <새 빌드 폴더> <스크린샷 폴더>
import { pathToFileURL } from 'node:url'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, extname } from 'node:path'
const [, , pwPath, OLD, NEW, SHOTS] = process.argv
const { chromium } = await import(pathToFileURL(pwPath).href)
mkdirSync(SHOTS, { recursive: true })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' :: ' + x}`) }
async function shot(dir, vp, scheme, reduced, name) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  await ctx.clock.install({ time: new Date('2026-11-05T10:00:00+09:00') })
  await ctx.route('http://qa.local/**', (r) => { const p = new URL(r.request().url()).pathname; const f = join(dir, p === '/' ? 'index.html' : p); return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: types[extname(f)] || 'application/octet-stream' }) : r.abort() })
  await ctx.route((u) => u.origin !== 'http://qa.local', (r) => r.abort())
  const page = await ctx.newPage(); await page.goto('http://qa.local/'); await page.waitForTimeout(1200)
  const png = await page.screenshot({ animations: 'disabled' })
  const vars = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement), o = {}; const walk = (rules) => { for (const r of rules) { if (r.style) for (const p of r.style) if (p.startsWith('--')) o[p] = cs.getPropertyValue(p).trim(); if (r.cssRules) walk(r.cssRules) } }; for (const sh of document.styleSheets) { try { walk(sh.cssRules) } catch { /* 다른 출처 시트는 건너뜀 */ } } return o })
  await ctx.close(); return { png, vars }
}
const cases = [['mobile375-light', { width: 375, height: 760 }, 'light', false], ['mobile375-dark', { width: 375, height: 760 }, 'dark', false], ['desktop1280-light', { width: 1280, height: 800 }, 'light', false], ['desktop1280-dark', { width: 1280, height: 800 }, 'dark', false], ['mobile375-reduced', { width: 375, height: 760 }, 'light', true], ['desktop1280-reduced', { width: 1280, height: 800 }, 'light', true]]
for (const [n, vp, sc, rd] of cases) {
  const a = await shot(OLD, vp, sc, rd), b = await shot(NEW, vp, sc, rd)
  writeFileSync(join(SHOTS, `mpr44-${n}.png`), b.png)
  ok(`[${n}] 캘린더 스크린샷이 이전 main과 바이트 단위로 같음(${a.png.length}B)`, a.png.equals(b.png))
  const changed = Object.keys(a.vars).filter((k) => a.vars[k] !== b.vars[k])
  ok(`[${n}] 이전 main에 있던 CSS 변수 ${Object.keys(a.vars).length}개 값이 모두 같음`, changed.length === 0, changed.map((k) => `${k}: ${a.vars[k]} → ${b.vars[k]}`).join('; '))
  if (n === 'mobile375-light') ok(`[${n}] 새 변수가 추가됨(${Object.keys(b.vars).length - Object.keys(a.vars).length}개)`, Object.keys(b.vars).length > Object.keys(a.vars).length)
}
await browser.close(); console.log(`\nRESULT pass=${pass} fail=${fail}`); process.exit(fail ? 1 : 0)
