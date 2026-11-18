// MPR-38 QA 임시 스크립트: 실제 앱을 모의 Supabase에 물려 (1) AC-04-9 /car 열기→기록 목록 표시를 10회(차량 1대·기록 500건, 매번 빈 캐시), (2) AC-08-12 만기일 저장→캘린더에 새 일정이 보일 때까지를 10회 잰다.
// 네트워크는 CDP로 제한한다: fast4g(RTT 150ms·9Mbps) 기본, slow4g(RTT 562ms·1.6Mbps)는 스트레스. 모의 서버라 실제 Supabase 지연은 포함되지 않는다.
// 실행: node docs/qa/scripts/mpr38_perf.mjs <playwright-core index.mjs> <앱 빌드 폴더> [fast4g|slow4g] [cpu 배율] [회수]
import { launch, openApp, baseSeed, NET, tab, pct, PORT } from './mpr38_lib.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 570000)
const [, , PW, DIST, PROFILE = 'fast4g', CPU = '1', RUNS = '10', ONLY = ''] = process.argv // ONLY=only04면 AC-04-9만 잰다
const browser = await launch(PW)
const net = NET[PROFILE], cpu = Number(CPU), runs = Number(RUNS)
const stat = (a) => `중앙 ${pct(a, 0.5).toFixed(0)} / p95 ${pct(a, 0.95).toFixed(0)}(${a.length}회면 최댓값) / 최소 ${Math.min(...a).toFixed(0)} ms`

// ───── AC-04-9 ─────
const open500 = [], first = [], at04 = []
for (let i = 0; i < runs; i++) {
  const a = await openApp(browser, DIST, { vp: 'desktop1280', seed: baseSeed({ nRecordsA: 497 }), net, cpu, goto: false })
  const p = a.page
  await p.addInitScript(() => {
    window.__t = { first: null, full: null }
    const mo = new MutationObserver(() => {
      const n = document.querySelectorAll('section ul li').length
      if (n > 0 && window.__t.first === null) window.__t.first = performance.now()
      if (n >= 500 && window.__t.full === null) window.__t.full = performance.now()
    })
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.documentElement, { childList: true, subtree: true }))
  })
  await p.goto(`http://localhost:${PORT}/car`)
  await p.waitForFunction(() => window.__t.full !== null, null, { timeout: 60000 }).catch(() => {})
  const t = await p.evaluate(() => window.__t)
  if (i === 0) console.log('  · 첫 회 요청:', a.s.log.slice(0, 14).map((e) => `${e.m} ${e.t}${e.q.includes('offset') ? '(page)' : ''}`).join(' | '), '| 기록 행', await p.locator('section ul li').count(), '| 서버 기록', a.s.db.car_records.filter((r) => r.vehicle_id.endsWith('a')).length)
  if ((t.full ?? 9e9) > 1800) { // 느린 회의 구성: 요청별 응답 끝 시각과 long task 합계
    const d = await p.evaluate(() => ({ nav: performance.getEntriesByType('navigation')[0]?.responseEnd, res: performance.getEntriesByType('resource').map((e) => `${e.name.replace(/^http:\/\/localhost:\d+/, '').slice(0, 40)}@${Math.round(e.responseEnd)}`), lt: performance.getEntriesByType('longtask').map((e) => Math.round(e.duration)) }))
    console.log(`  · 느린 회(${Math.round(t.full)}ms) 구성:`, JSON.stringify(d))
  }
  open500.push(t.full ?? NaN); first.push(t.first ?? NaN); at04.push(Date.now())
  await a.close()
}
console.log(`[AC-04-9 /car 열기, 기록 500건 전부 표시, ${PROFILE}, CPU x${cpu}, ${runs}회]`)
console.log('  첫 행 표시:', stat(first)); console.log('  500행 전부 표시:', stat(open500)); console.log('  raw(ms):', open500.map((x) => Math.round(x)).join(','))
console.log('  종료 시각(epoch s):', at04.map((x) => Math.round(x / 1000)).join(','))

if (ONLY === 'only04') process.exit(0)
// ───── AC-08-12 ─────
const clickToVisible = [], saveToVisible = [], dialogClosed = []
for (let i = 0; i < runs; i++) {
  const a = await openApp(browser, DIST, { vp: 'desktop1280', seed: baseSeed({ nRecordsA: 497 }), net, cpu })
  const p = a.page
  await tab(p, '만기일').click({ timeout: 60000 }); await p.getByRole('button', { name: '정기검사 입력' }).waitFor({ timeout: 60000 })
  await p.waitForTimeout(2500) // 열 때 점검 요청이 끝나기를 기다린다
  await p.getByRole('button', { name: '정기검사 입력' }).click(); await p.waitForTimeout(800)
  const now = new Date(), iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-25`
  await p.getByLabel('만기일 (필수)').fill(iso)
  const logLen = a.s.log.length
  const save = p.getByRole('dialog').getByRole('button', { name: '저장' })
  const t0 = Date.now(); await save.click()
  await p.getByRole('dialog').waitFor({ state: 'detached', timeout: 60000 }); const t1 = Date.now()
  await p.getByRole('link', { name: '캘린더' }).click(); const t2 = Date.now()
  await p.getByText('[출퇴근] 정기검사 만기').first().waitFor({ state: 'attached', timeout: 60000 }) // 월 보기가 PC에서는 제목으로 보인다
  const t3 = Date.now()
  dialogClosed.push(t1 - t0); clickToVisible.push(t3 - t2); saveToVisible.push(t3 - t0)
  if (i === 0) console.log('  · 첫 회 저장 직후 요청:', a.s.log.slice(logLen).map((e) => `${e.m} ${e.t}@${e.at - t0}ms`).join(' | '), `| 창 닫힘 ${t1 - t0}ms, 캘린더 클릭→일정 ${t3 - t2}ms`)
  await a.close()
}
console.log(`[AC-08-12 만기일 저장→캘린더 반영, ${PROFILE}, CPU x${cpu}, 기록 500건, ${runs}회]`)
console.log('  저장 클릭→창 닫힘:', stat(dialogClosed)); console.log('  "캘린더" 탭 클릭→새 일정이 보임:', stat(clickToVisible)); console.log('  저장 클릭→새 일정이 보임(엄격):', stat(saveToVisible))
console.log('  raw 저장→보임(ms):', saveToVisible.join(','))
process.exit(0)
