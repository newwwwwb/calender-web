// MPR-63 후속(6c42207) QA 임시 스크립트: 교체 알림 탭의 행 이름(aria-label)과 배지 글자가 v0.1 빌드와 변경 후 빌드에서 같은지 실앱(모의 Supabase)으로 비교한다.
// 실행: node docs/qa/scripts/mpr63_badge.mjs <playwright-core index.mjs> <v0.1 빌드> <변경 후 빌드>
import { launch, openApp, reporter, tab, panel, baseSeed } from './mpr38_lib.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 200000)
const [, , PW, OLDB, NEWB] = process.argv
const { ok, done } = reporter()
const browser = await launch(PW)
const grab = async (dist, vp) => {
  const seed = baseSeed(), t = seed.car_maintenance_items[0], d = new Date(), iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  seed.car_maintenance_items.push({ ...t, id: 'a0000000-0000-4000-8000-0000000000f1', name: '배터리 점검', interval_km: null, interval_months: 36, last_date: iso, last_odometer_km: null, event_id: null }) // 정상(ok) 항목 1개 추가
  const a = await openApp(browser, dist, { vp, seed }); const p = a.page
  await p.getByRole('tab', { name: '기록' }).waitFor(); await tab(p, '교체 알림').click(); await p.waitForTimeout(800)
  const labels = await panel(p).locator('button[aria-label$="수정"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  const txt = await panel(p).innerText()
  await a.close(); return { labels, badges: ['곧 교체', '교체 시기 지남'].map((b) => (txt.match(new RegExp(b, 'g')) ?? []).length) }
}
for (const vp of ['mobile375', 'desktop1280']) {
  const o = await grab(OLDB, vp), n = await grab(NEWB, vp)
  console.log(`  · [${vp}] 행 ${n.labels.length}개, 배지(곧 교체·교체 시기 지남) ${n.badges}`, JSON.stringify(n.labels))
  ok(`[${vp}] 교체 알림 행 이름·배지 글자가 v0.1과 같고 배지가 1개 이상 보임`, JSON.stringify(o) === JSON.stringify(n) && n.badges.some((c) => c > 0) && n.labels.length > 0, JSON.stringify({ o, n }))
  ok(`[${vp}] 정상(ok) 항목에는 이름 뒤에 배지 글자가 붙지 않음`, n.labels.some((l) => !/곧 교체|교체 시기 지남/.test(l)), JSON.stringify(n.labels))
}
await browser.close(); done()
