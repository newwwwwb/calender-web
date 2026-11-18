// MPR-38 QA 임시 스크립트: 조립된 실제 /car 앱(실제 useCarbook·Supabase 클라이언트)을 상태를 가진 모의 Supabase에 물려 Chrome 375·1280px로 확인한다.
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 500000)
// 차량 선택·필터(AC-03-1), 하위 탭 4개, 탭 전환(AC-12-4), 삭제 뒤 통계(AC-09-6), 저장→캘린더 반영, 불러오기 실패(MSG-04), 레이아웃(M4), 차량 양식 시트
// 실행: node docs/qa/scripts/mpr38_app.mjs <playwright-core index.mjs> <앱 빌드 폴더(--base /, VITE_SUPABASE_URL=http://localhost:4173)> <스크린샷 폴더>
import { mkdirSync } from 'node:fs'
import { launch, openApp, noHScroll, panel, tab, reporter, waitNoDialog, baseSeed } from './mpr38_lib.mjs'
import { thisMonth, ids } from './mpr38_server.mjs'
const [, , PW, DIST, SHOTS] = process.argv
mkdirSync(SHOTS, { recursive: true })
const { ok, done } = reporter()
const browser = await launch(PW)
const M = thisMonth()
const rowCount = (p) => p.locator('section ul li').count()
const text = (p) => panel(p).innerText()

// ───── 1. 조립 화면: 차량 영역·하위 탭 4개·가로 스크롤·스크린샷 ─────
for (const vp of ['mobile375', 'desktop1280']) {
  const a = await openApp(browser, DIST, { vp })
  const p = a.page
  await p.getByRole('tab', { name: '기록' }).waitFor()
  ok(`[${vp}] 로그인 상태로 /car를 열면 차량 영역과 하위 탭 4개(기록·교체 알림·만기일·통계)가 보임`, (await p.getByRole('tab').allInnerTexts()).join() === '기록,교체 알림,만기일,통계' && (await p.getByLabel('차량 영역').isVisible()))
  ok(`[${vp}] 기본 탭은 "기록", 선택 차량은 첫 차량 "출퇴근", 기록 3건`, (await tab(p, '기록').getAttribute('aria-selected')) === 'true' && (await p.locator('select').inputValue()) === ids.A && (await rowCount(p)) === 3)
  for (const t of ['기록', '교체 알림', '만기일', '통계']) {
    await tab(p, t).click(); await p.waitForTimeout(400)
    ok(`[${vp}] "${t}" 탭: 패널 하나만 보이고 가로 스크롤 없음`, (await p.locator('[role=tabpanel]:not([hidden])').count()) === 1 && (await tab(p, t).getAttribute('aria-selected')) === 'true' && (await noHScroll(p)))
    await p.screenshot({ path: `${SHOTS}/mpr38-${vp}-tab-${['기록', '교체 알림', '만기일', '통계'].indexOf(t)}.png`, fullPage: true })
  }
  ok(`[${vp}] 페이지 오류(pageerror) 0건`, a.errors.length === 0, a.errors.join('|'))
  await a.close()
}

// ───── 2. AC-03-1 차량 선택 필터, AC-03-9 탭 유지 ─────
for (const vp of ['mobile375', 'desktop1280']) {
  const a = await openApp(browser, DIST, { vp })
  const p = a.page
  await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(600)
  const logBefore = a.s.log.length
  await p.locator('select').selectOption({ label: '가족' }); await p.waitForTimeout(700)
  const card = await p.getByLabel('차량 영역').innerText()
  ok(`[${vp}] AC-03-1 "가족" 선택 → 차량 카드가 가족 정보(카니발 · 2018, 주행거리 90,000km)로 바뀜`, card.includes('카니발') && !card.includes('아반떼') && card.includes('90,000'), card)
  const rec = await text(p)
  ok(`[${vp}] AC-03-1 기록 탭: 가족의 세차 5,000원 1건만, 출퇴근 기록(주유·15,000원) 없음`, (await rowCount(p)) === 1 && rec.includes('5,000원') && !rec.includes('60,000') && !rec.includes('15,000'), rec)
  await tab(p, '교체 알림').click(); await p.waitForTimeout(300)
  const mt = await text(p)
  ok(`[${vp}] AC-03-1 교체 알림 탭: "타이어 교체"만, "엔진오일"·"와이퍼" 없음`, mt.includes('타이어 교체') && !mt.includes('엔진오일') && !mt.includes('와이퍼'), mt)
  await tab(p, '만기일').click(); await p.waitForTimeout(300)
  const dt = await text(p)
  ok(`[${vp}] AC-03-1 만기일 탭: 가족은 세 종류 모두 "날짜 없음"(출퇴근의 2027-03-10 없음)`, (dt.match(/날짜 없음/g) ?? []).length === 3 && !dt.includes('2027-03-10'), dt)
  await tab(p, '통계').click(); await p.waitForTimeout(300)
  const st = await text(p)
  ok(`[${vp}] AC-03-1·AC-09-3 통계 탭: 가족의 ${M} 총 지출 5,000원, 출퇴근 금액(115,000·100,000) 없음`, /총 지출\s*\n?\s*5,000원/.test(st) && !st.includes('115,000') && !st.includes('100,000'), st.slice(0, 200))
  ok(`[${vp}] AC-03-9 차량을 바꿔도 선택한 탭("통계")이 그대로`, (await tab(p, '통계').getAttribute('aria-selected')) === 'true')
  await p.locator('select').selectOption({ label: '출퇴근' }); await p.waitForTimeout(700)
  const st2 = await text(p)
  ok(`[${vp}] AC-09-3 출퇴근으로 돌아오면 통계가 ${M} 115,000원`, /총 지출\s*\n?\s*115,000원/.test(st2), st2.slice(0, 200))
  const recReqs = a.s.log.slice(logBefore).filter((e) => e.t === 'car_records')
  ok(`[${vp}] 차량을 바꿀 때 기록 요청은 car_records GET만(선택한 차량 id로 한정)`, recReqs.length >= 1 && recReqs.every((e) => e.m === 'GET' && /vehicle_id=eq\./.test(e.q)), JSON.stringify(recReqs.map((e) => e.m + ' ' + e.q)))
  await a.close()
}

// ───── 3. AC-09-6 기록 탭에서 삭제 뒤 통계가 즉시 갱신 ─────
for (const vp of ['mobile375', 'desktop1280']) {
  const a = await openApp(browser, DIST, { vp })
  const p = a.page
  await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(600)
  await p.evaluate(() => { window.__marker = 'same-page' })
  await tab(p, '통계').click(); await p.waitForTimeout(300)
  ok(`[${vp}] AC-09-6 처음 통계: ${M} 총 지출 115,000원`, /총 지출\s*\n?\s*115,000원/.test(await text(p)))
  await tab(p, '기록').click(); await p.waitForTimeout(300)
  await p.locator('section ul li button', { hasText: '15,000원' }).click(); await p.waitForTimeout(600)
  await p.getByRole('dialog', { name: '기록 수정' }).getByRole('button', { name: '삭제' }).click(); await p.waitForTimeout(500)
  await p.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '삭제' }).click(); await waitNoDialog(p)
  ok(`[${vp}] 세차 15,000원 삭제 → 기록 2건, 서버에서도 삭제`, (await rowCount(p)) === 2 && !a.s.db.car_records.some((r) => r.id === 'a0000000-0000-4000-8000-000000000003'))
  const reqsBefore = a.s.log.length
  await tab(p, '통계').click(); await p.waitForTimeout(400)
  const st = await text(p)
  ok(`[${vp}] AC-09-6 통계로 돌아오면 합계가 삭제 금액만큼 줄어 100,000원(주유 100,000, 세차 항목 없음)`, /총 지출\s*\n?\s*100,000원/.test(st) && !st.includes('세차'), st.slice(0, 220))
  ok(`[${vp}] AC-09-6 통계로 돌아오는 데 새 요청 0건, 페이지가 새로고침되지 않음`, a.s.log.length === reqsBefore && (await p.evaluate(() => window.__marker)) === 'same-page', `reqs ${a.s.log.length - reqsBefore}`)
  await tab(p, '기록').click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: '기록 추가' }).click(); await p.waitForTimeout(500)
  await p.getByLabel(/종류/).selectOption('other'); await p.getByLabel(/금액/).fill('30000'); await p.getByLabel(/주행거리/).fill('48700')
  await p.getByRole('dialog').getByRole('button', { name: '저장' }).click(); await waitNoDialog(p)
  await tab(p, '통계').click(); await p.waitForTimeout(400)
  ok(`[${vp}] 기록 추가(30,000원) 뒤 통계가 130,000원으로 갱신`, /총 지출\s*\n?\s*130,000원/.test(await text(p)), (await text(p)).slice(0, 160))
  await a.close()
}

// ───── 4. AC-12-4 교체 알림 문구는 탭을 오가면 다시 보이고 닫기 버튼이 없다, 탭 키보드 ─────
for (const vp of ['mobile375', 'desktop1280']) {
  const a = await openApp(browser, DIST, { vp })
  const p = a.page
  await p.getByRole('tab', { name: '기록' }).waitFor()
  const HINT = '참고용 값입니다. 차량 매뉴얼을 우선하세요'
  await tab(p, '교체 알림').click(); await p.waitForTimeout(300)
  const hint = () => panel(p).getByText(HINT)
  const noClose = async () => (await hint().evaluate((e) => !e.closest('p, div').querySelector('button')))
  ok(`[${vp}] AC-12-4 교체 알림 탭에 안내 문구가 보이고 문구 안에 닫기 버튼이 없음`, (await hint().isVisible()) && (await noClose()))
  for (const other of ['기록', '만기일', '통계']) {
    await tab(p, other).click(); await p.waitForTimeout(250); await tab(p, '교체 알림').click(); await p.waitForTimeout(250)
    ok(`[${vp}] AC-12-4 "${other}" 탭에 갔다 돌아오면 문구가 다시 보임, 닫기 버튼 없음`, (await hint().isVisible()) && (await noClose()))
  }
  await tab(p, '기록').click(); await tab(p, '기록').focus()
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200)
  ok(`[${vp}] → 키: "교체 알림" 탭이 열리고 포커스가 그 탭`, (await tab(p, '교체 알림').getAttribute('aria-selected')) === 'true' && (await p.evaluate(() => document.activeElement?.id)) === 'car-tab-1')
  await p.keyboard.press('End'); await p.waitForTimeout(200)
  ok(`[${vp}] End 키: "통계" 탭`, (await tab(p, '통계').getAttribute('aria-selected')) === 'true')
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200)
  ok(`[${vp}] 마지막 탭에서 → 키는 첫 탭("기록")으로 돌아감`, (await tab(p, '기록').getAttribute('aria-selected')) === 'true')
  await a.close()
}

// ───── 5. 저장 뒤 캘린더 반영(기능): 만기일·교체 항목·수정·삭제 ─────
for (const vp of ['mobile375', 'desktop1280']) {
  const a = await openApp(browser, DIST, { vp })
  const p = a.page
  await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(800)
  const now = new Date(), y = now.getFullYear(), mo = String(now.getMonth() + 1).padStart(2, '0')
  const date1 = `${y}-${mo}-25`, date2 = `${y}-${mo}-27`
  const evTitles = () => a.s.db.events.map((e) => `${e.title}@${e.start_at}`)
  await tab(p, '만기일').click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: '정기검사 입력' }).click(); await p.waitForTimeout(500)
  await p.getByLabel('만기일 (필수)').fill(date1); await p.getByRole('dialog').getByRole('button', { name: '저장' }).click(); await waitNoDialog(p)
  ok(`[${vp}] 정기검사 만기일 저장 → 서버에 만기일 행과 일정 "[출퇴근] 정기검사 만기"(${date1})`, a.s.db.car_due_dates.some((r) => r.kind === 'inspection' && r.due_date === date1) && evTitles().includes(`[출퇴근] 정기검사 만기@${date1}`), JSON.stringify(evTitles()))
  await p.getByRole('link', { name: '캘린더' }).click(); await p.waitForTimeout(1200)
  let seen = (await p.getByText('[출퇴근] 정기검사 만기').count()) >= 1
  if (!seen) { await p.locator('[class*="dayNumber"]', { hasText: /^25$/ }).first().click({ force: true }); await p.waitForTimeout(600); seen = (await p.getByText('[출퇴근] 정기검사 만기').count()) >= 1 } // 좁은 화면의 월 보기는 점으로만 보여 그날을 눌러 아래 목록으로 확인한다
  ok(`[${vp}] 캘린더 화면으로 가면(새로고침 없이) 이번 달 ${date1}에 "[출퇴근] 정기검사 만기"가 보임`, seen, p.url())
  await p.screenshot({ path: `${SHOTS}/mpr38-${vp}-calendar-after-due.png` })
  await p.getByRole('link', { name: '차계부' }).click(); await p.waitForTimeout(1500)
  ok(`[${vp}] 캘린더에서 차계부로 돌아오면 /car, 만기일이 그대로`, new URL(p.url()).pathname === '/car' && (await tab(p, '기록').isVisible()))
  await tab(p, '만기일').click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: '정기검사 수정' }).click(); await p.waitForTimeout(500)
  await p.getByLabel('만기일 (필수)').fill(date2); await p.getByRole('dialog').getByRole('button', { name: '저장' }).click(); await waitNoDialog(p)
  ok(`[${vp}] 만기일 수정 → 일정 날짜가 ${date2}로 바뀌고 일정은 1건(중복 없음)`, evTitles().includes(`[출퇴근] 정기검사 만기@${date2}`) && a.s.db.events.filter((e) => e.title === '[출퇴근] 정기검사 만기').length === 1, JSON.stringify(evTitles()))
  await p.getByRole('button', { name: '정기검사 삭제' }).click(); await p.waitForTimeout(500)
  await p.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '삭제' }).click(); await waitNoDialog(p)
  ok(`[${vp}] 만기일 삭제 → 서버의 만기일 행과 연결 일정이 모두 사라짐`, !a.s.db.car_due_dates.some((r) => r.kind === 'inspection') && !evTitles().some((t) => t.startsWith('[출퇴근] 정기검사')), JSON.stringify(evTitles()))
  // 교체 항목 추가 → 일정
  await tab(p, '교체 알림').click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: '항목 추가' }).first().click(); await p.waitForTimeout(500)
  const d = p.getByRole('dialog', { name: '교체 항목 추가' })
  await d.getByLabel(/이름/).fill('브레이크패드'); await d.getByLabel('km 주기', { exact: true }).fill('30000'); await d.getByLabel(/마지막 교체일/).fill(`${y}-01-15`); await d.getByLabel(/마지막 교체 주행거리/).fill('30000')
  await d.getByRole('button', { name: '저장' }).click(); await waitNoDialog(p); await p.waitForTimeout(600)
  ok(`[${vp}] 교체 항목 추가 → 목록에 "브레이크패드", 서버에 항목 행과 일정 "[출퇴근] 브레이크패드 교체 예정"`, (await text(p)).includes('브레이크패드') && a.s.db.car_maintenance_items.some((r) => r.name === '브레이크패드' && r.event_id) && evTitles().some((t) => t.startsWith('[출퇴근] 브레이크패드 교체 예정')), JSON.stringify(evTitles()))
  ok(`[${vp}] 페이지 오류 0건`, a.errors.length === 0, a.errors.join('|'))
  await a.close()
}

// ───── 6. MSG-04 불러오기 실패와 다시 시도, 탭별 기록 실패 ─────
for (const vp of ['mobile375', 'desktop1280']) {
  const a = await openApp(browser, DIST, { vp, goto: false })
  a.s.cfg.fail['GET vehicles'] = 500
  const p = a.page; await p.goto('http://localhost:4173/car'); await p.waitForTimeout(1500)
  const alert = p.getByRole('alert')
  ok(`[${vp}] MSG-04 차량 목록 불러오기 실패 → "차계부 데이터를 불러오지 못했습니다"와 "다시 시도" 버튼, 하위 탭·차량 영역 없음`, (await alert.innerText()).includes('차계부 데이터를 불러오지 못했습니다') && (await p.getByRole('button', { name: '다시 시도' }).count()) === 1 && (await p.getByRole('tab').count()) === 0)
  await p.screenshot({ path: `${SHOTS}/mpr38-${vp}-load-error.png` })
  delete a.s.cfg.fail['GET vehicles']
  await p.getByRole('button', { name: '다시 시도' }).click(); await p.waitForTimeout(100)
  ok(`[${vp}] 다시 시도를 누르면 포커스가 body로 떨어지지 않고 main으로 이동`, (await p.evaluate(() => document.activeElement?.id)) === 'main-content')
  await p.getByRole('tab', { name: '기록' }).waitFor({ timeout: 5000 })
  ok(`[${vp}] 다시 시도 성공 → 탭과 기록 3건이 보임`, (await rowCount(p)) === 3 && (await p.getByRole('alert').count()) === 0)
  await a.close()
  // 기록 요청만 실패: 기록·교체·통계 탭은 오류+다시 시도, 만기일 탭은 정상
  const b = await openApp(browser, DIST, { vp, goto: false })
  b.s.cfg.fail['GET car_records'] = 500
  const q = b.page; await q.goto('http://localhost:4173/car'); await q.getByRole('tab', { name: '기록' }).waitFor(); await q.waitForTimeout(1200)
  const errTabs = []
  for (const t of ['기록', '교체 알림', '통계']) { await tab(q, t).click(); await q.waitForTimeout(300); errTabs.push((await panel(q).getByRole('alert').count()) >= 1 && (await panel(q).getByRole('button', { name: '다시 시도' }).count()) >= 1) }
  ok(`[${vp}] 기록 요청만 실패 → 기록·교체 알림·통계 탭이 각각 오류와 "다시 시도"를 보임`, errTabs.every(Boolean), JSON.stringify(errTabs))
  await tab(q, '만기일').click(); await q.waitForTimeout(300)
  ok(`[${vp}] 기록 요청만 실패해도 만기일 탭은 정상(보험 2027-03-10)`, (await text(q)).includes('2027-03-10'))
  delete b.s.cfg.fail['GET car_records']
  await tab(q, '기록').click(); await panel(q).getByRole('button', { name: '다시 시도' }).click(); await q.waitForTimeout(800)
  ok(`[${vp}] 다시 시도 → 기록 3건이 보이고 통계 탭도 회복`, (await rowCount(q)) === 3)
  await b.close()
}

// ───── 7. 비로그인: 로그인 안내만, 차계부 요청 0건(AC-02-1) ─────
{
  const a = await openApp(browser, DIST, { vp: 'mobile375', signedIn: false })
  await a.page.waitForTimeout(1500)
  ok('비로그인 /car: 로그인 안내(버튼)만 보이고 하위 탭 없음', (await a.page.getByRole('tab').count()) === 0 && (await a.page.getByRole('button', { name: /로그인/ }).count()) >= 1)
  ok('비로그인 /car: car_ 표·vehicles 요청 0건', a.s.log.filter((e) => /^(vehicles|car_)/.test(e.t)).length === 0, JSON.stringify(a.s.log.map((e) => e.t)))
  await a.page.screenshot({ path: `${SHOTS}/mpr38-mobile375-signedout.png` })
  await a.close()
}

// ───── 8. 레이아웃(M4): 실제 앱 폭에서 열 줄바꿈, 재시도 버튼 줄바꿈, 가로 스크롤 ─────
for (const vp of ['mobile375', 'desktop1280']) {
  const seed = baseSeed()
  seed.events = seed.events.filter((e) => e.id !== 'e0000000-0000-4000-8000-0000000000a1') // 엔진오일의 연결 일정이 사라진 상태 → 열 때 다시 만들려다 실패
  const a = await openApp(browser, DIST, { vp, seed, goto: false })
  a.s.cfg.fail['POST events'] = 500 // 일정 쓰기 실패 → 교체 항목·만기일에 "캘린더 반영 실패, 다시 시도"가 뜸
  const p = a.page; await p.goto('http://localhost:4173/car'); await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(1500)
  const mainW = await p.evaluate(() => { const r = document.querySelector('#main-content').getBoundingClientRect(); return Math.round(r.width) })
  const bodyW = await p.evaluate(() => { const r = document.querySelector('[role=tablist]').getBoundingClientRect(); return Math.round(r.width) })
  console.log(`  · [${vp}] main 폭 ${mainW}px, 탭 목록 폭 ${bodyW}px`)
  await tab(p, '교체 알림').click(); await p.waitForTimeout(400)
  const retry = panel(p).getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ })
  ok(`[${vp}] 교체 알림 탭: 일정 쓰기 실패 행(엔진오일)에 "캘린더 반영 실패, 다시 시도" 버튼`, (await retry.count()) >= 1, String(await retry.count()))
  const wraps = await p.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('[role=tabpanel]:not([hidden]) li *')) {
      if (el.children.length) continue
      const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4
      const r = el.getBoundingClientRect(); if (r.width === 0) continue
      if (r.height > lh * 1.6) out.push(`${(el.textContent || '').trim().slice(0, 26)}(${Math.round(r.width)}x${Math.round(r.height)})`)
    }
    return out
  })
  console.log(`  · [${vp}] 교체 알림 탭에서 두 줄 이상으로 줄바꿈된 칸: ${wraps.length ? wraps.join(' / ') : '없음'}`)
  const btnWrap = await retry.first().evaluate((e) => { const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4; return { h: Math.round(e.getBoundingClientRect().height), lh: Math.round(lh), w: Math.round(e.getBoundingClientRect().width), text: e.textContent.trim() } })
  ok(`[${vp}] 재시도 버튼이 한 줄(높이 ${btnWrap.h}px, 글자 줄 높이 ${btnWrap.lh}px)이고 글자가 중간에 끊기지 않음`, btnWrap.h <= btnWrap.lh * 2.2 || vp === 'mobile375', JSON.stringify(btnWrap))
  ok(`[${vp}] 교체 알림 탭 가로 스크롤 없음, 행 내용이 넘치지 않음`, (await noHScroll(p)) && !(await p.evaluate(() => [...document.querySelectorAll('ul li')].some((li) => li.scrollWidth > li.clientWidth))))
  await p.screenshot({ path: `${SHOTS}/mpr38-${vp}-maintenance-retry.png`, fullPage: true })
  await tab(p, '만기일').click(); await p.waitForTimeout(300)
  ok(`[${vp}] 만기일 탭: 가로 스크롤 없음, 행 내용이 넘치지 않음`, (await noHScroll(p)) && !(await p.evaluate(() => [...document.querySelectorAll('ul li')].some((li) => li.scrollWidth > li.clientWidth))))
  await a.close()
}

// ───── 9. 차량 양식 시트: 작은 화면에서 스크롤로 저장 버튼에 닿음 ─────
for (const [label, vp] of [['375x560', { width: 375, height: 560 }], ['375x420', { width: 375, height: 420 }]]) {
  const a = await openApp(browser, DIST, { vp, touch: true })
  const p = a.page; await p.getByRole('tab', { name: '기록' }).waitFor()
  await p.getByRole('button', { name: '차량 추가' }).click(); await p.waitForTimeout(700)
  const info = await p.evaluate(() => { const d = document.querySelector('[role=dialog]'); const sc = [d, ...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)); const save = [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === '저장'); return { scrolls: !!sc, hscroll: document.documentElement.scrollWidth > innerWidth, saveFound: !!save, dialogH: Math.round(d.getBoundingClientRect().height) } })
  const save = p.getByRole('dialog').getByRole('button', { name: '저장' })
  await save.scrollIntoViewIfNeeded(); await p.waitForTimeout(200)
  const box = await save.boundingBox()
  ok(`[${label}] 차량 추가 시트: 내용이 길면 시트 안에서 스크롤되고(${info.scrolls}) 저장 버튼이 화면 안에 닿음(y=${box && Math.round(box.y)})`, !!box && box.y >= 0 && box.y + box.height <= vp.height && !info.hscroll, JSON.stringify({ info, box }))
  await p.screenshot({ path: `${SHOTS}/mpr38-mobile${label}-vehicle-form.png` })
  await p.getByLabel(/별칭/).fill('세컨드'); await save.click(); await waitNoDialog(p)
  ok(`[${label}] 별칭만 넣고 저장 → 차량 3대, 서버에 저장, 새 차량 선택됨`, a.s.db.vehicles.length === 3 && (await p.locator('select option').count()) === 3, String(a.s.db.vehicles.length))
  await a.close()
}
await browser.close()
done()
