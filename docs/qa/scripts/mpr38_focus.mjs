// MPR-38·46b QA 임시 스크립트: 실제 /car 앱에서 삭제를 확정한 직후 1.6초 동안 activeElement를 20ms마다 표집해 최종 포커스 위치와 body에 머문 시간을 반복해서 잰다(기록·교체 항목·만기일·차량).
// 실행: node docs/qa/scripts/mpr38_focus.mjs <playwright-core index.mjs> <앱 빌드 폴더> <회수 375px> <회수 CPU x4 375px> <회수 1280px>
import { launch, openApp, baseSeed, tab, reporter, PORT } from './mpr38_lib.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 1500000)
const [, , PW, DIST, N1 = '20', N4 = '10', N13 = '5'] = process.argv
const { ok, done } = reporter()
const browser = await launch(PW)
const probe = (page) => page.evaluate(() => new Promise((res) => {
  const t0 = performance.now(), trail = []
  const d = () => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().replace(/\s+/g, ' ').slice(0, 28) }
  const id = setInterval(() => { trail.push([Math.round(performance.now() - t0), d()]); if (performance.now() - t0 > 1600) { clearInterval(id); res(trail) } }, 20)
}))
const flows = {
  record: { setup: async (p) => { await p.locator('section ul li button', { hasText: '15,000원' }).click(); await p.waitForTimeout(700); await p.getByRole('dialog', { name: '기록 수정' }).getByRole('button', { name: '삭제' }).click(); await p.waitForTimeout(500) } },
  item: { setup: async (p) => { await tab(p, '교체 알림').click(); await p.waitForTimeout(300); await p.getByRole('button', { name: /^와이퍼.*수정$/ }).click(); await p.waitForTimeout(700); await p.getByRole('dialog', { name: '교체 항목 수정' }).getByRole('button', { name: '삭제' }).click(); await p.waitForTimeout(500) } },
  due: { setup: async (p) => { await tab(p, '만기일').click(); await p.waitForTimeout(300); await p.getByRole('button', { name: '보험 만기 삭제' }).click(); await p.waitForTimeout(500) } },
  vehicle: { setup: async (p) => { await p.getByLabel('차량 영역').getByRole('button', { name: '삭제', exact: true }).click(); await p.waitForTimeout(500) } },
}
const reset = (s) => { const seed = baseSeed(); for (const k of Object.keys(s.db)) s.db[k].splice(0, s.db[k].length, ...structuredClone(seed[k] ?? [])) }

async function round(label, vpName, cpu, n) {
  const a = await openApp(browser, DIST, { vp: vpName, cpu })
  const p = a.page
  for (const [name, f] of Object.entries(flows)) {
    let finalBody = 0, transient = 0, maxBody = 0; const lastSeen = new Set(); let bad = ''
    for (let i = 0; i < n; i++) {
      reset(a.s); await p.goto(`http://localhost:${PORT}/car`); await p.getByRole('tab', { name: '기록' }).waitFor({ timeout: 30000 }); await p.waitForTimeout(700)
      await f.setup(p)
      const confirm = p.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '삭제' })
      const pr = probe(p); await confirm.click(); const trail = await pr
      const bodyMs = trail.filter((x) => x[1] === 'BODY').length * 20
      const last = trail.at(-1)[1]; lastSeen.add(last)
      if (last === 'BODY') { finalBody++; bad = JSON.stringify(trail.filter((x, j) => j % 10 === 0).slice(0, 12)) }
      if (bodyMs > 0) transient++
      maxBody = Math.max(maxBody, bodyMs)
    }
    console.log(`  · [${label}] ${name}: ${n}회 중 최종 body ${finalBody}회, 중간에 body를 거친 회 ${transient}, body 최장 ${maxBody}ms, 최종 위치 {${[...lastSeen].join(' | ')}}`)
    ok(`[${label}] ${name} 삭제 확정 뒤 최종 포커스가 body가 아님(${n}회 모두)`, finalBody === 0, bad)
  }
  await a.close()
}
await round('mobile375 터치', 'mobile375', 1, Number(N1))
await round('mobile375 터치 CPU x4', 'mobile375', 4, Number(N4))
await round('desktop1280', 'desktop1280', 1, Number(N13))
await browser.close()
done()
