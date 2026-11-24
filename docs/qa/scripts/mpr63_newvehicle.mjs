// MPR-63 QA 임시 스크립트: 실앱(모의 Supabase)에서 차량을 추가했을 때 서버에 생기는 추천 항목 7개의 값을 두 빌드(v0.1 기준 빌드, 변경 후 빌드)에서 읽어 같은지 비교한다(saveVehicle 동작 변경 0).
// 실행: node docs/qa/scripts/mpr63_newvehicle.mjs <playwright-core index.mjs> <v0.1 빌드> <변경 후 빌드>
import { launch, openApp, reporter, waitNoDialog } from './mpr38_lib.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 300000)
const [, , PW, OLDB, NEWB] = process.argv
const { ok, done } = reporter()
const browser = await launch(PW)
async function run(dist, odometer) {
  const a = await openApp(browser, dist, { vp: 'desktop1280' })
  const p = a.page; await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(600)
  await p.getByRole('button', { name: '차량 추가' }).click(); await p.waitForTimeout(500)
  await p.getByLabel(/별칭/).fill('신차'); if (odometer !== null) await p.getByLabel(/주행거리/).fill(String(odometer))
  await p.getByRole('dialog').getByRole('button', { name: '저장' }).click(); await waitNoDialog(p); await p.waitForTimeout(800)
  const v = a.s.db.vehicles.find((x) => x.name === '신차')
  const rows = a.s.db.car_maintenance_items.filter((x) => x.vehicle_id === v?.id).map((x) => ({ name: x.name, interval_km: x.interval_km, interval_months: x.interval_months, last_date: x.last_date, last_odometer_km: x.last_odometer_km, event_id: x.event_id }))
  const events = a.s.log.filter((e) => e.m === 'POST' && e.t === 'events').length
  await a.close(); return { v: v && { odometer_km: v.odometer_km }, rows, events }
}
const today = new Date(), iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
for (const odo of [48000, null]) {
  const o = await run(OLDB, odo), n = await run(NEWB, odo)
  ok(`주행거리 ${odo}: 두 빌드 모두 추천 항목 7개`, o.rows.length === 7 && n.rows.length === 7, `${o.rows.length}/${n.rows.length}`)
  ok(`주행거리 ${odo}: 추천 항목 7개의 이름·주기·마지막 교체일·마지막 교체 주행거리·연결 일정 id가 v0.1과 같음`, JSON.stringify(o.rows) === JSON.stringify(n.rows), JSON.stringify({ o: o.rows[0], n: n.rows[0] }))
  ok(`주행거리 ${odo}: 마지막 교체일은 등록일(오늘 ${iso}), 마지막 교체 주행거리는 차량 주행거리 그대로`, n.rows.every((r) => r.last_date === iso && r.last_odometer_km === odo), JSON.stringify(n.rows[0]))
  ok(`주행거리 ${odo}: 차량 추가만으로는 일정 쓰기 요청 수가 같음(v0.1 ${o.events}, 변경 후 ${n.events})`, o.events === n.events, `${o.events}/${n.events}`)
}
await browser.close()
done()
