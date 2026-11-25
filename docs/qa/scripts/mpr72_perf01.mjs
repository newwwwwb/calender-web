// MPR-72 QA 임시 스크립트: AC-01-7 데스크톱 캘린더에서 "차계부" 탭 클릭부터 화면 전환 완료까지(데이터 로딩 제외)를 릴리스 후보 빌드로 잰다. 35회 왕복(차계부 쪽 35회·캘린더 쪽 35회)
// 실행: node docs/qa/scripts/mpr72_perf01.mjs <playwright-core index.mjs> <앱 빌드 폴더(--base /)> [왕복 횟수]
import { launch, openApp, pct } from './mpr38_lib.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 300000)
const [, , PW, DIST, N = '35'] = process.argv
const browser = await launch(PW)
const a = await openApp(browser, DIST, { vp: 'desktop1280', path: '/' })
const p = a.page
await p.locator('nav[aria-label="화면 전환"]').waitFor({ timeout: 30000 }); await p.waitForTimeout(2500)
const toCar = [], toCal = []
for (let i = 0; i < Number(N) * 2; i++) {
  const to = i % 2 === 0 ? '차계부' : '캘린더'
  const v = await p.evaluate(async (target) => {
    const link = [...document.querySelectorAll('nav[aria-label="화면 전환"] a')].find((x) => x.textContent.includes(target))
    const t0 = performance.now(); link.click()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return performance.now() - t0
  }, to)
  ;(to === '차계부' ? toCar : toCal).push(v)
  await p.waitForTimeout(700) // 데이터 로딩이 끝나길 기다린다(측정에는 포함하지 않는다)
}
const f = (x) => x.toFixed(0)
const all = [...toCar, ...toCal]
console.log(`[AC-01-7 차계부 탭 클릭→전환 완료(두 프레임 뒤), ${toCar.length}회] 중앙 ${f(pct(toCar, 0.5))} / p95 ${f(pct(toCar, 0.95))} / 최댓값 ${f(Math.max(...toCar))} ms`)
console.log(`  raw: ${toCar.map(f).join(',')}`)
console.log(`[참고 캘린더 쪽 ${toCal.length}회] 중앙 ${f(pct(toCal, 0.5))} / p95 ${f(pct(toCal, 0.95))} / 최댓값 ${f(Math.max(...toCal))} ms`)
console.log(`[전체 ${all.length}회] p95 ${f(pct(all, 0.95))} ms, 100ms 초과 ${all.filter((x) => x > 100).length}회 ${all.filter((x) => x > 100).map(f).join(',')}`)
await a.close(); await browser.close(); process.exit(0)
