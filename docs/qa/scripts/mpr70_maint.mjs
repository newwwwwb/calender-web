// MPR-70 QA 임시 스크립트: 교체 알림 탭의 미입력 표시(AC-24-1·6·8, AC-26-6·7), 교체 완료 안내(AC-25), 재시도 버튼 줄바꿈(AC-21)을 실제 앱 빌드로 확인한다
// 실행: node docs/qa/scripts/mpr70_maint.mjs <playwright-core index.mjs> <새 빌드(07adf56)> <이전 빌드(92dfece)> <스크린샷 폴더>
import { mkdirSync } from 'node:fs'
import { launch, openApp, noHScroll, panel, tab, reporter, baseSeed, waitNoDialog } from './mpr38_lib.mjs'
import { ids } from './mpr38_server.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 500000)
const [, , PW, NEW, OLD, SHOTS] = process.argv
mkdirSync(SHOTS, { recursive: true })
const { ok, done } = reporter()
const SEC = (n) => !process.env.PART || process.env.PART.includes(n) // PART=3 처럼 주면 그 절만 돌린다(재현용)
const browser = await launch(PW)
const item = (id, name, km, months, lastDate, lastOdo) => ({ id, vehicle_id: ids.A, name, interval_km: km, interval_months: months, last_date: lastDate, last_odometer_km: lastOdo, event_id: null, created_at: `2026-01-1${id.slice(-1)}T00:00:00.000Z` })
const idN = (n) => `c0000000-0000-4000-8000-00000000009${n}`
function unsetSeed() {
  const s = baseSeed()
  s.car_maintenance_items = s.car_maintenance_items.filter((i) => i.vehicle_id !== ids.A).concat([
    item(idN(1), '엔진오일', 10000, 12, null, null), item(idN(2), '와이퍼', null, 6, null, null),
    item(idN(3), '주행거리항목', 20000, null, '2026-10-01', 48000), item(idN(4), '개월항목', null, 12, '2026-01-05', null),
  ])
  s.events = s.events.filter((e) => !e.title.includes('엔진오일') || e.title.includes('가족'))
  return s
}
const rowOf = (p, name) => panel(p).locator('li').filter({ has: p.getByRole('button', { name: new RegExp(`^${name}`) }) }).first()
// 열 때 점검이 부르는 카테고리 확보 RPC(ensure_carbook_category)는 행을 바꾸지 않으므로 쓰기에서 뺀다(기준 공개)
const writes = (a, from = 0) => a.s.log.slice(from).filter((e) => e.m !== 'GET' && !String(e.t).startsWith('rpc/ensure_carbook_category'))
const descOfDialog = async (a) => {
  const cdp = await a.ctx.newCDPSession(a.page)
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  const d = nodes.find((n) => n.role?.value === 'dialog' && !n.ignored)
  return d ? { name: d.name?.value, desc: d.description?.value } : null
}

// ───── 1. 미입력 표시·MSG-26·MSG-38·MSG-39(375·1280) ─────
for (const vp of SEC('1') ? ['mobile375', 'desktop1280'] : []) {
  const a = await openApp(browser, NEW, { vp, seed: unsetSeed() })
  const p = a.page; await p.getByRole('tab', { name: '기록' }).waitFor()
  const log0 = a.s.log.length
  await tab(p, '교체 알림').click(); await p.waitForTimeout(900)
  const u1 = await rowOf(p, '엔진오일').innerText(), u2 = await rowOf(p, '와이퍼').innerText()
  ok(`[${vp}] AC-24-1 미입력 두 항목: "마지막 교체 미입력"과 다음 교체일 칸 MSG-26, 남은 거리·상태 배지·"추정" 없음`,
    [u1, u2].every((t) => t.includes('미입력') && t.includes('마지막 교체일을 입력하세요') && !/남음|지남|곧 교체|정상|추정|km 남/.test(t)), JSON.stringify([u1, u2]))
  ok(`[${vp}] AC-24-1 접근성 이름에 "마지막 교체일 미입력"이 들어감`, (await rowOf(p, '엔진오일').getByRole('button', { name: /마지막 교체일 미입력, 수정/ }).count()) === 1)
  const note = panel(p).getByText('마지막 교체일을 입력하면 다음 교체일을 계산합니다')
  ok(`[${vp}] AC-24-8 MSG-38이 목록 위에 한 줄(1개)로 보이고 목록보다 위에 있음`, (await note.count()) === 1 && (await note.evaluate((e) => { const ul = e.closest('[role=tabpanel]').querySelector('ul'); return e.getBoundingClientRect().bottom <= ul.getBoundingClientRect().top + 1 })))
  const km3 = await rowOf(p, '주행거리항목').innerText(), mo4 = await rowOf(p, '개월항목').innerText()
  ok(`[${vp}] AC-26-6 km 기준 항목은 다음 교체일 옆에 "추정", 화면낭독기용 글자 "주행거리 기준 추정"`, km3.includes('추정') && (await rowOf(p, '주행거리항목').locator('.sr-only').filter({ hasText: '주행거리 기준 추정' }).count()) === 1 && (await rowOf(p, '주행거리항목').locator('[aria-hidden=true]').filter({ hasText: '추정' }).count()) === 1, km3)
  ok(`[${vp}] AC-26-7 개월 기준 항목과 미입력 항목에는 "추정"이 없음`, !mo4.includes('추정') && !u1.includes('추정') && !u2.includes('추정'), mo4)
  ok(`[${vp}] AC-24-5/불변 탭을 열기만 하면 쓰기 요청 0건`, writes(a, log0).length === 0, JSON.stringify(writes(a, log0)))
  ok(`[${vp}] 가로 스크롤 없음, 행 내용이 넘치지 않음`, (await noHScroll(p)) && !(await p.evaluate(() => [...document.querySelectorAll('ul li')].some((li) => li.scrollWidth > li.clientWidth))))
  await p.screenshot({ path: `${SHOTS}/mpr70-${vp}-unset.png`, fullPage: true })
  // AC-24-6 미입력 항목을 열면 마지막 교체일이 빈 칸, 비운 채 저장하면 MSG-05와 쓰기 0건
  await rowOf(p, '엔진오일').getByRole('button', { name: /수정/ }).click(); await p.waitForTimeout(500)
  const dlg = p.getByRole('dialog'), dateIn = dlg.getByLabel(/마지막 교체일/)
  ok(`[${vp}] AC-24-6 미입력 항목 양식의 마지막 교체일 칸이 빈 값`, (await dateIn.inputValue()) === '', await dateIn.inputValue())
  const w1 = a.s.log.length
  await dlg.getByRole('button', { name: '저장' }).click(); await p.waitForTimeout(500)
  const dtext = await dlg.innerText()
  ok(`[${vp}] AC-24-6 비운 채 저장 → MSG-05(마지막 교체일을 입력해 주세요)가 보이고 저장 요청 0건`, /마지막 교체일.*입력해 주세요/.test(dtext) && writes(a, w1).length === 0, dtext.slice(0, 160))
  await p.screenshot({ path: `${SHOTS}/mpr70-${vp}-unset-form-error.png`, fullPage: true })
  // 값이 있는 항목을 열면 기존 날짜 그대로(회귀)
  await p.keyboard.press('Escape'); await p.waitForTimeout(500)
  await rowOf(p, '개월항목').getByRole('button', { name: /수정/ }).click(); await p.waitForTimeout(500)
  ok(`[${vp}] 값이 있는 항목 양식은 기존 마지막 교체일 그대로`, (await p.getByRole('dialog').getByLabel(/마지막 교체일/).inputValue()) === '2026-01-05')
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  // 새 항목 추가의 기본값은 오늘(회귀)
  await panel(p).getByRole('button', { name: /항목 추가/ }).first().click(); await p.waitForTimeout(500)
  const addVal = await p.getByRole('dialog').getByLabel(/마지막 교체일/).inputValue()
  ok(`[${vp}] 새 항목 추가의 마지막 교체일 기본값은 오늘(빈 칸이 아님)`, /^\d{4}-\d{2}-\d{2}$/.test(addVal), addVal)
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  // AC-24-8 미입력 두 개 중 하나만 채우면 MSG-38 유지, 둘 다 채우면 사라짐
  for (const [n, name] of [[1, '엔진오일'], [2, '와이퍼']]) {
    await rowOf(p, name).getByRole('button', { name: /수정/ }).click(); await p.waitForTimeout(500)
    const d = p.getByRole('dialog'); await d.getByLabel(/마지막 교체일/).fill('2026-06-01'); if (n === 1) await d.getByLabel(/마지막 교체 주행거리/).fill('40000'); await d.getByRole('button', { name: '저장' }).click(); await p.waitForTimeout(1200)
    const still = (await panel(p).getByText('마지막 교체일을 입력하면 다음 교체일을 계산합니다').count()) === 1
    ok(`[${vp}] AC-24-8 ${n}번째 항목 입력 뒤 MSG-38 ${n === 1 ? '유지' : '사라짐'}`, n === 1 ? still : !still && (await p.getByRole('dialog').count()) === 0)
  }
  ok(`[${vp}] AC-24-3 입력한 항목은 "미입력"·MSG-26이 사라지고 다음 교체일이 보임`, !/미입력|마지막 교체일을 입력하세요/.test(await rowOf(p, '엔진오일').innerText()) && /\d{4}-\d{2}-\d{2}/.test(await rowOf(p, '엔진오일').innerText()), await rowOf(p, '엔진오일').innerText())
  ok(`[${vp}] 페이지 오류 0건`, a.errors.length === 0, a.errors.join('|'))
  await a.close()
}

// ───── 2. 미입력이 없는 차량(v0.1 데이터)에는 MSG-38이 없고 행 모양이 이전과 같다(AC-24-5) ─────
for (const [label, dist] of SEC('2') ? [['새', NEW], ['이전', OLD]] : []) {
  const a = await openApp(browser, dist, { vp: 'desktop1280' })
  const p = a.page; await p.getByRole('tab', { name: '기록' }).waitFor()
  const w0 = a.s.log.length
  await tab(p, '교체 알림').click(); await p.waitForTimeout(900)
  const t = await panel(p).innerText(); a.__t = t
  ok(`[${label} 빌드] 미입력 항목이 없는 차량: MSG-38·"미입력"·MSG-26 없음`, !/미입력|마지막 교체일을 입력/.test(t), t.slice(0, 200))
  ok(`[${label} 빌드] 열기만 하면 쓰기 요청 0건`, writes(a, w0).length === 0)
  globalThis[`rows_${label}`] = t.replace(/\s+/g, ' ')
  await a.close()
}
if (SEC('2')) ok('AC-24-5 v0.1 데이터의 교체 알림 탭 글자가 이전 빌드와 같음("추정" 표시만 예외)', globalThis.rows_새.replace(/ ?추정 주행거리 기준 추정/g, '').replace(/ 주행거리 기준 추정/g, '').replace(/ 추정/g, '') === globalThis.rows_이전, (() => { const x = globalThis.rows_새, y = globalThis.rows_이전; let i = 0; while (i < x.length && x[i] === y[i]) i++; return `첫 차이 위치 ${i}: 새 …${x.slice(Math.max(0, i - 20), i + 60)} || 이전 …${y.slice(Math.max(0, i - 20), i + 60)}` })())

// ───── 3. 교체 완료 안내 MSG-27(AC-25-1~4)과 aria-describedby ─────
for (const vp of SEC('3') ? ['mobile375', 'desktop1280'] : []) {
  for (const [kind, name] of [['값 있는 항목', '개월항목'], ['미입력 항목', '와이퍼']]) {
    const a = await openApp(browser, NEW, { vp, seed: unsetSeed() })
    const p = a.page; await p.getByRole('tab', { name: '기록' }).waitFor()
    await tab(p, '교체 알림').click(); await p.waitForTimeout(800)
    const recs0 = await (async () => { await tab(p, '기록').click(); await p.waitForTimeout(300); const n = await p.locator('section ul li').count(); await tab(p, '교체 알림').click(); await p.waitForTimeout(300); return n })()
    await rowOf(p, name).getByRole('button', { name: new RegExp(`^교체 완료, ${name}`) }).click(); await p.waitForTimeout(600)
    const dlg = p.getByRole('dialog')
    const hint = dlg.getByText('비용은 기록 탭에서 정비로 추가하세요')
    ok(`[${vp}] AC-25-1/3 ${kind}: 교체 완료 대화상자에 MSG-27이 보임`, (await hint.count()) === 1 && (await hint.isVisible()))
    ok(`[${vp}] AC-25-1 안내가 주행거리 입력 칸 아래, 확인 버튼 위에 있음`, await dlg.evaluate((d) => { const h = [...d.querySelectorAll('p')].find((x) => x.textContent.includes('비용은 기록 탭')); const odo = d.querySelector('input[inputmode=numeric]'); const ok = [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === '확인'); return h.getBoundingClientRect().top >= odo.getBoundingClientRect().bottom - 1 && h.getBoundingClientRect().bottom <= ok.getBoundingClientRect().top + 1 }))
    const dd = await descOfDialog(a)
    ok(`[${vp}] AC-25-4 대화상자의 설명(aria-describedby)이 안내 문구이고 이름은 대화상자 이름`, !!dd && dd.desc?.includes('비용은 기록 탭에서 정비로 추가하세요'), JSON.stringify(dd))
    ok(`[${vp}] AC-25-4 aria-describedby가 가리키는 요소가 실제로 안내 문구`, await dlg.evaluate((d) => { const id = d.getAttribute('aria-describedby'); const el = id && document.getElementById(id); return !!el && el.textContent.includes('비용은 기록 탭에서 정비로 추가하세요') }))
    ok(`[${vp}] 가로 스크롤 없음`, await noHScroll(p))
    await p.screenshot({ path: `${SHOTS}/mpr70-${vp}-complete-${kind === '미입력 항목' ? 'unset' : 'set'}.png`, fullPage: true })
    if (name === '개월항목') {
      // AC-25-4 Esc: 닫히고 항목 불변(쓰기 0건)
      const w1 = a.s.log.length
      const actBefore = await p.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.getAttribute('name')}|dialogs ${document.querySelectorAll('[role=dialog]').length}`)
      await p.keyboard.press('Escape'); const closeMs = await waitNoDialog(p, 3000) // 닫힘 애니메이션이 끝날 때까지 기다린다(첫 실행은 600ms 고정 대기라 모바일에서 끝나기 전에 셌다)
      const escDialogs = await p.getByRole('dialog').count(), escWrites = writes(a, w1)
      console.log(`  · [${vp}] Esc 뒤 대화상자가 사라지기까지 ${closeMs}ms`)
      ok(`[${vp}] AC-25-4 Esc → 대화상자가 닫히고 쓰기 요청 0건`, escDialogs === 0 && escWrites.length === 0, `before ${actBefore}, dialogs ${escDialogs}, writes ${JSON.stringify(escWrites.map((e) => e.m + ' ' + e.t))}`)
      // AC-25-2 확정해도 정비 기록을 만들지 않는다
      await rowOf(p, name).getByRole('button', { name: new RegExp(`^교체 완료, ${name}`) }).click(); await p.waitForTimeout(500)
      const w2 = a.s.log.length
      await p.getByRole('dialog').getByLabel(/마지막 교체일/).fill('2026-11-21'); await p.getByRole('dialog').getByLabel(/마지막 교체 주행거리/).fill('48000')
      await p.getByRole('dialog').getByRole('button', { name: '확인' }).click(); await p.waitForTimeout(1200)
      const w = writes(a, w2)
      ok(`[${vp}] AC-25-2 교체 완료 확정: 항목 수정만 있고 car_records 쓰기 0건, 기록 목록 개수 그대로`, w.every((e) => e.t !== 'car_records') && w.some((e) => e.t === 'car_maintenance_items') && await (async () => { await tab(p, '기록').click(); await p.waitForTimeout(300); return (await p.locator('section ul li').count()) === recs0 })(), JSON.stringify(w.map((e) => `${e.m} ${e.t}`)))
    }
    await a.close()
  }
}

// ───── 4. 재시도 버튼 줄바꿈(AC-21-1~3): 새 빌드와 이전 빌드를 같은 조건으로 ─────
const retrySeed = () => { const s = baseSeed(); s.events = s.events.filter((e) => e.id !== 'e0000000-0000-4000-8000-0000000000a1'); return s }
async function retryMetrics(page) {
  return page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=tabpanel]:not([hidden]) button')].find((x) => /캘린더 반영 실패, 다시 시도/.test(x.textContent))
    if (!b) return null
    const tn = [...b.querySelectorAll('*')].concat(b).flatMap((el) => [...el.childNodes]).filter((n) => n.nodeType === 3 && n.textContent.trim())
    const node = tn.find((n) => n.textContent.includes('캘린더'))
    const text = node.textContent
    const lineCount = (from, to) => { const r = document.createRange(); r.setStart(node, from); r.setEnd(node, to); const tops = new Set([...r.getClientRects()].map((x) => Math.round(x.top))); return tops.size }
    const i1 = text.indexOf('캘린더'), i2 = text.indexOf('다시')
    const chunk1 = lineCount(i1, text.indexOf(',', i1) + 1), chunk2 = lineCount(i2, text.indexOf('시도', i2) + 2)
    const words = ['캘린더', '반영', '실패,', '다시', '시도'].map((w) => lineCount(text.indexOf(w), text.indexOf(w) + w.length))
    const r = b.getBoundingClientRect(), li = b.closest('li').getBoundingClientRect()
    const cs = getComputedStyle(b), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4
    return { chunk1, chunk2, wordLines: words, h: Math.round(r.height), lh: Math.round(lh), inRow: r.left >= li.left - 1 && r.right <= li.right + 1, inViewport: r.right <= window.innerWidth + 1 && r.left >= -1, vis: r.width > 0 && r.height > 0, text: b.textContent.trim() }
  })
}
const sizes = [[375, true], [899, true], [1024, false], [1280, false], [1920, false]]
const result = {}
for (const [label, dist] of SEC('4') ? [['새', NEW], ['이전', OLD]] : []) {
  for (const [w, touch] of sizes) {
    const a = await openApp(browser, dist, { vp: { width: w, height: 800 }, touch, seed: retrySeed(), goto: false })
    a.s.cfg.fail['POST events'] = 500
    const p = a.page; await p.goto('http://localhost:4173/car'); await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(1200)
    await tab(p, '교체 알림').click(); await p.waitForTimeout(900)
    const m = await retryMetrics(p); result[`${label}${w}`] = m
    if (!m) { ok(`[${label} 빌드 ${w}px] 재시도 버튼이 보임`, false); await a.close(); continue }
    if (w >= 1024) {
      ok(`[${label} 빌드 ${w}px] AC-21-1/2 "캘린더 반영 실패," 와 "다시 시도" 두 덩어리가 각각 한 줄, 어느 낱말도 끊기지 않음`, m.chunk1 === 1 && m.chunk2 === 1 && m.wordLines.every((x) => x === 1), JSON.stringify(m))
      ok(`[${label} 빌드 ${w}px] AC-21-1/2 버튼이 항목 줄과 화면 밖으로 넘치지 않음, 가로 스크롤 없음`, m.inRow && m.inViewport && (await noHScroll(p)), JSON.stringify(m))
    } else {
      ok(`[${label} 빌드 ${w}px] AC-21-3 문구 전체가 보이고 낱말이 끊기지 않음`, m.vis && m.wordLines.every((x) => x === 1) && m.inRow && m.inViewport, JSON.stringify(m))
      const bh = await p.getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ }).first().evaluate((e) => Math.round(e.getBoundingClientRect().height))
      ok(`[${label} 빌드 ${w}px] AC-21-3 터치 영역 높이 44px 이상`, bh >= 44, String(bh))
      a.s.cfg.fail['POST events'] = undefined; delete a.s.cfg.fail['POST events']
      await p.getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ }).first().click(); await p.waitForTimeout(1500)
      ok(`[${label} 빌드 ${w}px] AC-21-3 재시도 성공 뒤 버튼이 사라짐`, (await p.getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ }).count()) === 0)
    }
    if (label === '새') await p.screenshot({ path: `${SHOTS}/mpr70-${w}-retry.png`, fullPage: true })
    await a.close()
  }
}
console.log('  · 재시도 버튼 측정:', JSON.stringify(result))
done()
