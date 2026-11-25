// MPR-38 QA 임시 모듈: 실제 앱(빌드)을 모의 Supabase 서버에 물려 Chrome으로 여는 공용 도우미
import { pathToFileURL } from 'node:url'
import { startServer, baseSeed, session } from './mpr38_server.mjs'
export { baseSeed, session }
export const PORT = Number(process.env.QA_PORT ?? 4173) // QA_PORT를 주면 그 포트를 쓴다(다른 세션과 4173이 겹칠 때). 빌드 때 VITE_SUPABASE_URL=http://localhost:<포트>를 같은 값으로 박아야 한다(로그인 저장 키는 호스트 이름 기준이라 같다)
export const NET = {
  fast4g: { latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 }, // Chrome "Fast 4G"에 가까운 값(보수적: RTT 150ms)
  slow4g: { latency: 562, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }, // 스트레스용(예전 Chrome "Fast 3G"=지금 "Slow 4G")
}
export async function launch(pwPath) {
  const { chromium } = await import(pathToFileURL(pwPath).href)
  return chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
}
export const VP = { mobile375: [{ width: 375, height: 760 }, true], desktop1280: [{ width: 1280, height: 800 }, false] }
// opts: { scheme: 'light'|'dark', reduced: boolean, vp: 'mobile375'|'desktop1280'|{width,height}, touch, seed, delayMs, net, cpu, signedIn=true, path='/car' }
export async function openApp(browser, dist, opts = {}) {
  const [vp, touch] = typeof opts.vp === 'string' ? VP[opts.vp] : [opts.vp ?? VP.desktop1280[0], opts.touch ?? false]
  const s = await startServer({ dist, seed: opts.seed ?? baseSeed(), delayMs: opts.delayMs ?? 0, port: PORT })
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, colorScheme: opts.scheme ?? 'light', reducedMotion: opts.reduced ? 'reduce' : 'no-preference' })
  if (opts.signedIn !== false) await ctx.addInitScript(([x]) => localStorage.setItem('sb-localhost-auth-token', JSON.stringify(x)), [session])
  if (opts.blockExternal) await ctx.route((u) => u.hostname !== 'localhost', (r) => r.abort()) // 웹 폰트 같은 외부 요청을 막아 글자 폭이 흔들리지 않게 한다
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  if (opts.net || opts.cpu) {
    const cdp = await ctx.newCDPSession(page)
    if (opts.net) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...opts.net }) }
    if (opts.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu })
  }
  if (opts.goto !== false) await page.goto(`http://localhost:${PORT}${opts.path ?? '/car'}`)
  return { s, ctx, page, errors, close: async () => { await ctx.close(); s.close() } }
}
export const dialogs = (p) => p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('aria-label')))
export const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
export const inDialog = (p, name) => p.evaluate((n) => { const d = document.querySelector(`[role="dialog"][aria-label="${n}"]`); return !!d && d.contains(document.activeElement) }, name)
export const waitNoDialog = async (p, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await dialogs(p)).length === 0) return Date.now() - t0; await p.waitForTimeout(40) } return -1 }
export const tab = (p, name) => p.getByRole('tab', { name, exact: true })
export const panel = (p) => p.locator('[role=tabpanel]:not([hidden])')
export function reporter() {
  let pass = 0, fail = 0
  return { ok: (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' :: ' + x}`) }, done: () => { console.log(`\nRESULT pass=${pass} fail=${fail}`); process.exit(fail ? 1 : 0) } }
}
export const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] }
