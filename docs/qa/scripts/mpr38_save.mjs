// MPR-38 QA 임시 스크립트: AC-04-10 실제 앱에서 기록 저장 클릭 → 목록에 새 기록이 보일 때까지를 10회 잰다(차량 1대·기록 500건, 네트워크 CDP 제한). 저장 뒤 목록 전체를 다시 불러오는 GET이 없는지도 모의 서버 요청 기록으로 센다.
// 실행: node docs/qa/scripts/mpr38_save.mjs <playwright-core index.mjs> <앱 빌드 폴더> [fast4g|slow4g] [cpu 배율] [회수]
import { launch, openApp, baseSeed, NET, pct } from './mpr38_lib.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 400000)
const [, , PW, DIST, PROFILE = 'fast4g', CPU = '1', RUNS = '10'] = process.argv
const browser = await launch(PW)
const ms = [], reloads = []
for (let i = 0; i < Number(RUNS); i++) {
  const a = await openApp(browser, DIST, { vp: 'desktop1280', seed: baseSeed({ nRecordsA: 497 }), net: NET[PROFILE], cpu: Number(CPU) })
  const p = a.page
  await p.getByRole('button', { name: '기록 추가' }).waitFor({ timeout: 60000 }); await p.waitForTimeout(2500)
  await p.getByRole('button', { name: '기록 추가' }).click(); await p.waitForTimeout(800)
  await p.getByLabel(/종류/).selectOption('other'); await p.getByLabel(/금액/).fill('77777')
  const before = await p.locator('section ul li').count(), logLen = a.s.log.length
  const save = p.getByRole('dialog').getByRole('button', { name: '저장' })
  const t0 = Date.now(); await save.click()
  await p.waitForFunction(() => [...document.querySelectorAll('section ul li')].some((li) => li.textContent.includes('77,777')), null, { timeout: 60000 }); const t1 = Date.now()
  await p.waitForTimeout(1500)
  const after = await p.locator('section ul li').count()
  const reqs = a.s.log.slice(logLen)
  reloads.push(reqs.filter((e) => e.m === 'GET' && e.t === 'car_records').length)
  ms.push(t1 - t0)
  if (i === 0) console.log('  · 첫 회 저장 직후 요청:', reqs.map((e) => `${e.m} ${e.t}@${e.at - t0}ms`).join(' | '), `| 목록 ${before} → ${after}`)
  await a.close()
}
console.log(`[AC-04-10 기록 저장→목록에 보임, ${PROFILE}, CPU x${CPU}, 기록 500건, ${RUNS}회]`)
console.log(`  중앙 ${pct(ms, 0.5).toFixed(0)} / p95 ${pct(ms, 0.95).toFixed(0)}(최댓값 ${Math.max(...ms)}) / 최소 ${Math.min(...ms)} ms | raw: ${ms.join(',')}`)
console.log(`  저장 뒤 car_records GET(다시 불러오기) 횟수: ${reloads.join(',')}`)
await browser.close()
process.exit(0)
