// AC-08-12 측정: /car에서 만기일 저장 → 캘린더 탭으로 가서 새 일정이 보일 때까지(매번 새 데이터, Fast 4G)
import { chromium } from 'playwright-core'
import { makeData, startServer, USER } from './mock.mjs'

const CPU = Number(process.argv[2] ?? 1), RUNS = Number(process.argv[3] ?? 10), DIST = process.argv[4]
const NET = { latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, role: 'authenticated', exp: 4102444800 })}.sig`
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
  user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'a@x', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const saved = [], visible = [], reqs = []
for (let i = 0; i < RUNS; i++) {
  const log = []
  const { srv, port } = await startServer({ dist: DIST, data: makeData(500), log }, 4173)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(([s]) => localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s)), [session])
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${port}/car`)
  await page.getByRole('tab', { name: '만기일' }).click()
  const btn = page.getByRole('button', { name: /정기검사.*입력/ })
  await btn.waitFor()
  await page.waitForTimeout(1500) // 열 때 점검이 끝나기를 기다린다
  await btn.click()
  const now = new Date(); const day = new Date(now.getFullYear(), now.getMonth(), 25)
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-25`
  await page.locator('dialog input[type=date], [role=dialog] input[type=date]').first().fill(iso)
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NET })
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  log.length = 0
  const save = page.getByRole('dialog').getByRole('button', { name: '저장' })
  await page.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('[role=dialog]')) window.__click = Date.now() }, true))
  const t0 = Date.now()
  await save.click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  const t1 = Date.now()
  const clickAt = await page.evaluate(() => window.__click)
  await page.getByRole('link', { name: /캘린더/ }).click()
  await page.getByText('[내차] 정기검사 만기').first().waitFor({ timeout: 30000 })
  const t2 = Date.now()
  saved.push(t1 - clickAt); visible.push(t2 - clickAt); if (i === 0) reqs.push(log.map((e) => `${e.m} ${e.t}@${e.at - clickAt}`).join(' | ') + ' | closed@' + (t1 - t0) + ' visible@' + (t2 - t0) + ' clickDelay@' + (clickAt - t0))
  await ctx.close(); srv.close()
}
await browser.close()
const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] }
console.log('저장 직후 요청(첫 회):', reqs[0])
console.log(`[만기일 저장→캘린더 반영, fast4g, CPU x${CPU}, ${RUNS}회]`)
console.log(' 저장 버튼→창 닫힘(ms): 중앙', p(saved, .5), 'p95', p(saved, .95), '| 저장→캘린더에 일정 보임(ms): 중앙', p(visible, .5), 'p95', p(visible, .95), '최소', Math.min(...visible))
console.log(' raw:', visible.join(','))
