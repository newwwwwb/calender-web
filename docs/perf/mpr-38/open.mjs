// AC-04-9 측정: 차량 1대·기록 N건, Fast 4G, /car를 새로 열어 기록 목록이 보일 때까지(10회, 매번 빈 캐시)
import { chromium } from 'playwright-core'
import { makeData, startServer, USER } from './mock.mjs'

const N = Number(process.argv[2] ?? 500)
const CPU = Number(process.argv[3] ?? 1)
const PROFILE = process.argv[4] ?? 'fast4g'
const RUNS = Number(process.argv[5] ?? 10)
const NET = { fast4g: { latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
  slow4g: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 } }[PROFILE]
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, role: 'authenticated', exp: 4102444800 })}.sig`
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
  user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'a@x', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }

const log = []
const { srv, port } = await startServer({ dist: process.argv[6], data: makeData(N), log }, 4173)
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const first = [], full = [], longest = []
for (let i = 0; i < RUNS; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(([s]) => {
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s))
    window.__t = { first: null, full: null, longest: 0 }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__t.longest = Math.max(window.__t.longest, e.duration) }).observe({ type: 'longtask', buffered: true })
    const mo = new MutationObserver(() => {
      const n = document.querySelectorAll('section[aria-labelledby="records-list"] ul li').length
      if (n > 0 && window.__t.first === null) window.__t.first = performance.now()
      if (n >= window.__want && window.__t.full === null) window.__t.full = performance.now()
    })
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.documentElement, { childList: true, subtree: true }))
  }, [session])
  await ctx.addInitScript(([n]) => { window.__want = n }, [N])
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NET })
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  log.length = 0
  await page.goto(`http://localhost:${port}/car`)
  await page.waitForFunction(() => window.__t.full !== null, null, { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500) // 뒤에서 도는 점검 요청까지 기다림
  const t = await page.evaluate(() => window.__t)
  first.push(t.first); full.push(t.full); longest.push(t.longest)
  if (i === 0) console.log('요청 목록(첫 회):', log.map((e) => `${e.m} ${e.t}${e.q.includes('id=in') ? '(in)' : ''}`).join(' | '))
  await ctx.close()
}
await browser.close(); srv.close()
const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] }
const f = (a) => `중앙 ${p(a, 0.5).toFixed(0)} / p95(10회=최댓값) ${p(a, 0.95).toFixed(0)} / 최소 ${Math.min(...a).toFixed(0)}`
console.log(`[기록 ${N}건, ${PROFILE}, CPU x${CPU}, ${RUNS}회]`)
console.log(' 첫 행 표시(ms):', f(first), '| 전부', f(full), '| 가장 긴 long task(ms):', f(longest))
console.log(' 전체 raw(ms):', full.map((x) => Math.round(x)).join(','))
