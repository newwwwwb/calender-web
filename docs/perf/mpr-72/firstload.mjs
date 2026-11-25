// MPR-72 첫 로드 비교: 로그인한 상태로 `/`를 빈 캐시에서 열어 FCP·LCP·캘린더 헤더 표시 시간과 내려받은 크기를 잰다
import { chromium } from 'playwright-core'
import { makeData, startServer, USER } from './mock.mjs'

const [, , DIST, RUNS = '20', CPU = '1'] = process.argv
const NET = { latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, role: 'authenticated', exp: 4102444800 })}.sig`
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
  user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'a@x', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
const { srv, port } = await startServer({ dist: DIST, data: makeData(500), log: [] }, 4173)
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const fcp = [], lcp = [], ready = [], bytes = []
for (let i = 0; i < Number(RUNS); i++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(([s]) => {
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s))
    window.__lcp = 0
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
  }, [session])
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NET })
  if (Number(CPU) > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(CPU) })
  let enc = 0
  cdp.on('Network.loadingFinished', (e) => { enc += e.encodedDataLength })
  const t0 = Date.now()
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' })
  await page.waitForSelector('h1', { state: 'attached', timeout: 30000 })
  const r = Date.now() - t0
  await page.waitForTimeout(1500)
  const m = await page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0, lcp: window.__lcp }))
  fcp.push(m.fcp); lcp.push(m.lcp); ready.push(r); bytes.push(enc)
  await ctx.close()
}
await browser.close(); srv.close()
const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] }
const f = (a) => `중앙 ${p(a, .5).toFixed(0)} p95 ${p(a, .95).toFixed(0)}`
console.log(`[${DIST.split('/').slice(-2)[0]}] ${RUNS}회 CPU x${CPU} | FCP ms ${f(fcp)} | LCP ms ${f(lcp)} | 화면 도구 표시 ${f(ready)} | 내려받은 바이트(KB) 중앙 ${(p(bytes, .5) / 1024).toFixed(0)}`)
