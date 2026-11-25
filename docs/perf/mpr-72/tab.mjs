// AC-01-7 측정: 데스크톱에서 캘린더↔차계부 탭 전환(클릭→두 프레임 뒤)을 모의 서버 위에서 20회 잰다
import { chromium } from 'playwright-core'
import { makeData, startServer, USER } from './mock.mjs'

const CPU = Number(process.argv[2] ?? 1), SW = Number(process.argv[3] ?? 20), DIST = process.argv[4]
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, role: 'authenticated', exp: 4102444800 })}.sig`
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
  user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'a@x', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
const { srv, port } = await startServer({ dist: DIST, data: makeData(500), log: [] }, 4173)
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await ctx.addInitScript(([s]) => localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s)), [session])
const page = await ctx.newPage()
await page.goto(`http://localhost:${port}/`)
await page.waitForSelector('nav[aria-label="화면 전환"] a'); await page.waitForTimeout(1500)
const cdp = await ctx.newCDPSession(page)
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
const ms = { toCar: [], toCal: [] }
for (let i = 0; i < SW; i++) {
  const to = i % 2 === 0 ? '차계부' : '캘린더'
  const v = await page.evaluate(async (target) => {
    const link = [...document.querySelectorAll('nav[aria-label="화면 전환"] a')].find((a) => a.textContent.includes(target))
    const t0 = performance.now(); link.click()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t0
  }, to)
  ;(to === '차계부' ? ms.toCar : ms.toCal).push(v)
  await page.waitForTimeout(1200) // 전환·데이터 로딩이 끝나기를 기다린다
}
await browser.close(); srv.close()
const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] }
const all = [...ms.toCar, ...ms.toCal]
console.log(`[탭 전환 ${SW}회, CPU x${CPU}] 전체 중앙 ${p(all, .5).toFixed(1)}ms p95 ${p(all, .95).toFixed(1)}ms 최대 ${Math.max(...all).toFixed(1)}ms | →차계부 p95 ${p(ms.toCar, .95).toFixed(1)} | →캘린더 p95 ${p(ms.toCal, .95).toFixed(1)}`)
console.log(' raw:', all.map((x) => x.toFixed(0)).join(','))
