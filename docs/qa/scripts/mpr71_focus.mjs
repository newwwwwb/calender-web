// MPR-71 QA 임시 스크립트: 실제 /car 앱(모의 Supabase)에서 만기일 삭제 확인창의 포커스를 20ms 간격으로 표집한다.
// AC-22-1(삭제 성공: body 표집 0개, 최종 "보험 만기 입력"), AC-22-2(삭제 실패: MSG-03, 최종 그 행의 "삭제", body 0개), AC-22-3(취소·Esc: 최종 그 행의 "삭제", body 0개),
// AC-22-4(기록·교체 항목·차량의 삭제·취소 최종 포커스가 이전 빌드와 같음, AC-11-4 Esc), 그리고 요청 중에 닫고 다른 창을 연 뒤 늦게 성공해도 새 창의 포커스를 덮지 않음(리뷰 fd566d0).
// 실행: node docs/qa/scripts/mpr71_focus.mjs <playwright-core index.mjs> <변경 후 빌드> <이전 빌드(MPR-71 전)> <375 회수> <CPU x4 375 회수> <1280 회수>
import { launch, openApp, baseSeed, tab, reporter, PORT } from './mpr38_lib.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 1700000)
const [, , PW, NEWB, OLDB, N1 = '20', N4 = '10', N13 = '5'] = process.argv
const { ok, done } = reporter()
const browser = await launch(PW)
const MSG03 = '삭제하지 못했습니다. 다시 시도해 주세요'
const probe = (page, ms = 1600) => page.evaluate((ms) => new Promise((res) => {
  const t0 = performance.now(), trail = []
  const d = () => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().replace(/\s+/g, ' ').slice(0, 28) }
  const id = setInterval(() => { trail.push([Math.round(performance.now() - t0), d()]); if (performance.now() - t0 > ms) { clearInterval(id); res(trail) } }, 20)
}), ms)
const reset = (s) => { const seed = baseSeed(); for (const k of Object.keys(s.db)) s.db[k].splice(0, s.db[k].length, ...structuredClone(seed[k] ?? [])); s.cfg.fail = {}; s.cfg.delayMs = 0; s.log.length = 0 }
const summ = (trail) => ({ final: trail.at(-1)[1], bodyMs: trail.filter((x) => x[1] === 'BODY').length * 20, path: [...new Set(trail.map((x) => x[1]))].join(' > ') })
const dels = (a) => a.s.log.filter((e) => e.m === 'DELETE').length
const dlg = (p, name) => p.getByRole('dialog', { name })

// 삭제 확인창이 뜰 때까지 열어 두는 흐름. 닫는 방법(confirm·cancel·esc)은 호출부가 정한다
const flows = {
  due: { open: async (p) => { await tab(p, '만기일').click(); await p.waitForTimeout(300); await p.getByRole('button', { name: '보험 만기 삭제' }).click(); await p.waitForTimeout(500) }, name: '보험 만기 삭제' },
  record: { open: async (p) => { await p.locator('section ul li button', { hasText: '15,000원' }).click(); await p.waitForTimeout(700); await dlg(p, '기록 수정').getByRole('button', { name: '삭제' }).click(); await p.waitForTimeout(500) } },
  item: { open: async (p) => { await tab(p, '교체 알림').click(); await p.waitForTimeout(300); await p.getByRole('button', { name: /^와이퍼.*수정$/ }).click(); await p.waitForTimeout(700); await dlg(p, '교체 항목 수정').getByRole('button', { name: '삭제' }).click(); await p.waitForTimeout(500) } },
  vehicle: { open: async (p) => { await p.getByLabel('차량 영역').getByRole('button', { name: '삭제', exact: true }).click(); await p.waitForTimeout(500) } },
}
async function once(p, a, flow, how) {
  reset(a.s); await p.goto(`http://localhost:${PORT}/car`); await p.getByRole('tab', { name: '기록' }).waitFor({ timeout: 30000 }); await p.waitForTimeout(700)
  await flows[flow].open(p)
  if (how === 'fail') a.s.cfg.fail['DELETE car_due_dates'] = 500
  const pr = probe(p)
  if (how === 'esc') await p.keyboard.press('Escape')
  else if (how === 'cancel') await dlg(p, '삭제 확인').getByRole('button', { name: '취소' }).click()
  else await dlg(p, '삭제 확인').getByRole('button', { name: '삭제' }).click()
  const trail = await pr
  const open = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('aria-label')))
  const toast = (await p.getByText(MSG03).count()) > 0
  return { ...summ(trail), open, toast, dels: dels(a), gone: a.s.db.car_due_dates.every((r) => r.kind !== 'insurance') }
}

async function round(label, vp, cpu, n) {
  const a = await openApp(browser, NEWB, { vp, cpu }), p = a.page
  // AC-22-1
  let bad = 0, maxBody = 0; const finals = new Set(); let worst = ''
  for (let i = 0; i < n; i++) { const r = await once(p, a, 'due', 'confirm'); finals.add(r.final); maxBody = Math.max(maxBody, r.bodyMs); if (r.bodyMs > 0 || r.final !== '보험 만기 입력' || !r.gone) { bad++; worst = JSON.stringify(r) } }
  console.log(`  · [${label}] AC-22-1 삭제 성공 ${n}회: 최종 {${[...finals]}}, body 표집 최장 ${maxBody}ms`)
  ok(`[${label}] AC-22-1 삭제 성공 ${n}회 모두 body 표집 0개, 최종 포커스 "보험 만기 입력", 삭제됨`, bad === 0, `${bad}회 실패 ${worst}`)
  // AC-22-2: 삭제 요청이 실패하면 확인창은 다시 시도할 수 있게 열려 있고(ConfirmDialog), 그동안 포커스는 창 안 "취소"에 있다. 사용자가 닫으면(취소·Esc) 포커스는 그 행의 "삭제" 버튼이어야 한다
  for (const closeHow of ['cancel', 'esc']) {
    bad = 0; worst = ''; const f2 = new Set(); let maxB = 0
    for (let i = 0; i < Math.min(n, 10); i++) {
      reset(a.s); await p.goto(`http://localhost:${PORT}/car`); await p.getByRole('tab', { name: '기록' }).waitFor({ timeout: 30000 }); await p.waitForTimeout(700)
      await flows.due.open(p); a.s.cfg.fail['DELETE car_due_dates'] = 500
      const pr1 = probe(p, 2500); await dlg(p, '삭제 확인').getByRole('button', { name: '삭제' }).click(); const t1 = summ(await pr1)
      const during = { toast: (await p.getByText(MSG03).count()) > 0, open: await p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('aria-label'))) }
      const pr2 = probe(p)
      if (closeHow === 'esc') await p.keyboard.press('Escape'); else await dlg(p, '삭제 확인').getByRole('button', { name: '취소' }).click()
      const t2 = summ(await pr2); const open2 = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('aria-label')))
      f2.add(`${t1.final}→${t2.final}`); maxB = Math.max(maxB, t1.bodyMs, t2.bodyMs)
      if (t1.bodyMs > 0 || t2.bodyMs > 0 || t1.final !== '취소' || !during.toast || !during.open.includes('삭제 확인') || t2.final !== '보험 만기 삭제' || open2.length || a.s.db.car_due_dates.every((r) => r.kind !== 'insurance')) { bad++; worst = JSON.stringify({ t1, during, t2, open2 }) }
    }
    console.log(`  · [${label}] AC-22-2 삭제 실패 후 ${closeHow}: 실패 직후→닫은 뒤 최종 {${[...f2]}}, body 표집 최장 ${maxB}ms`)
    ok(`[${label}] AC-22-2 삭제 실패(${closeHow}로 닫음): MSG-03이 보이고 확인창은 열린 채 포커스가 창 안 "취소", 닫은 뒤 최종 포커스 그 행의 "보험 만기 삭제", 전 구간 body 표집 0개, 만기일은 남음`, bad === 0, `${bad}회 실패 ${worst}`)
  }
  // AC-22-3
  for (const how of ['cancel', 'esc']) {
    bad = 0; worst = ''; const f3 = new Set()
    for (let i = 0; i < Math.min(n, 10); i++) { const r = await once(p, a, 'due', how); f3.add(r.final); if (r.bodyMs > 0 || r.final !== '보험 만기 삭제' || r.open.length || r.dels !== 0 || r.gone) { bad++; worst = JSON.stringify(r) } }
    console.log(`  · [${label}] AC-22-3 ${how}: 최종 {${[...f3]}}`)
    ok(`[${label}] AC-22-3 ${how === 'cancel' ? '"취소"' : 'Esc'} → 최종 포커스 그 행의 "보험 만기 삭제", body 표집 0개, 삭제 요청 0건`, bad === 0, `${bad}회 실패 ${worst}`)
  }
  await a.close()
}
await round('mobile375 터치', 'mobile375', 1, Number(N1))
await round('mobile375 터치 CPU x4', 'mobile375', 4, Number(N4))
await round('desktop1280', 'desktop1280', 1, Number(N13))

// ───── 리뷰 fd566d0: 요청 중에 닫고 다른 창을 연 뒤 늦게 성공해도 새 창의 포커스가 유지됨 ─────
for (const [label, vp] of [['mobile375 터치', 'mobile375'], ['desktop1280', 'desktop1280']]) {
  const a = await openApp(browser, NEWB, { vp }), p = a.page
  let bad = 0, worst = ''
  for (let i = 0; i < 5; i++) {
    reset(a.s); await p.goto(`http://localhost:${PORT}/car`); await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(700)
    await flows.due.open(p); a.s.cfg.delayMs = 1800
    await dlg(p, '삭제 확인').getByRole('button', { name: '삭제' }).click(); await p.waitForTimeout(150)
    await p.keyboard.press('Escape'); await p.waitForTimeout(700)
    await p.getByRole('button', { name: '정기검사 입력' }).click(); await p.waitForTimeout(500)
    const during = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('aria-label')))
    await p.waitForTimeout(2600) // 삭제 응답이 늦게 도착한다
    const after = await p.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return { dialog: d?.getAttribute('aria-label') ?? null, inside: !!d && d.contains(document.activeElement), active: document.activeElement === document.body ? 'BODY' : (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 20) } })
    const gone = a.s.db.car_due_dates.every((r) => r.kind !== 'insurance')
    if (!(during.length === 1 && after.dialog && after.inside && gone)) { bad++; worst = JSON.stringify({ during, after, gone }) }
  }
  ok(`[${label}] 요청 중 닫고 "정기검사 입력" 창을 연 뒤 삭제가 늦게 성공해도 새 창 안에 포커스가 남고 창이 닫히지 않음(5회), 삭제는 완료됨`, bad === 0, `${bad}회 실패 ${worst}`)
  await a.close()
}

// ───── AC-22-4: 다른 탭의 삭제·취소·Esc 최종 포커스가 이전 빌드(MPR-71 전)와 같음(모의 서버가 포트 하나라 빌드를 차례로 돌린다) ─────
for (const [label, vp] of [['mobile375 터치', 'mobile375'], ['desktop1280', 'desktop1280']]) {
  const res = {}
  for (const [tag, dist] of [['이전', OLDB], ['이후', NEWB]]) {
    const a = await openApp(browser, dist, { vp })
    for (const flow of ['record', 'item', 'vehicle']) for (const how of ['confirm', 'cancel', 'esc']) res[`${flow} ${how} ${tag}`] = await once(a.page, a, flow, how)
    await a.close()
  }
  for (const flow of ['record', 'item', 'vehicle']) {
    const rows = []
    for (const how of ['confirm', 'cancel', 'esc']) {
      const o = res[`${flow} ${how} 이전`], n = res[`${flow} ${how} 이후`]
      const same = o.final === n.final && JSON.stringify(o.open) === JSON.stringify(n.open) && o.dels === n.dels // 일시 body 표집(20ms 한 칸)은 잡음이라 비교에서 뺀다. AC-22-4는 최종 포커스 위치와 AC-11-4
      rows.push(`${how}: 이전 ${o.final}(body ${o.bodyMs}ms, 남은 창 ${o.open.length}, DELETE ${o.dels}) / 이후 ${n.final}(body ${n.bodyMs}ms, 남은 창 ${n.open.length}, DELETE ${n.dels})`)
      ok(`[${label}] AC-22-4 ${flow} ${how}: 최종 포커스·남은 창·삭제 요청 수가 이전 빌드와 같음`, same, JSON.stringify({ o, n }))
      if (how === 'esc') ok(`[${label}] AC-11-4 ${flow} Esc: 확인창이 닫히고 삭제 요청 0건`, !n.open.includes('삭제 확인') && n.dels === 0, JSON.stringify(n))
    }
    console.log(`  · [${label}] ${flow} | ${rows.join(' | ')}`)
  }
}
await browser.close()
done()
