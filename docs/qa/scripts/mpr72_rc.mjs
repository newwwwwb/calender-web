// MPR-72 QA 임시 스크립트: v0.2 릴리스 후보를 실제 /car 앱(모의 Supabase)으로 확인한다. 기본 차량(AC-19), 계정 메뉴·로그아웃(AC-18), 로그인 실패·만료 안내(AC-27)
// 실행: PART=A,D,E node docs/qa/scripts/mpr72_rc.mjs <playwright-core index.mjs> <앱 빌드 폴더(--base /)> <스크린샷 폴더>  (PART를 안 주면 모두)
// 모의 서버라 RLS·실제 Supabase 지연은 보지 못한다(AC-19-9는 MPR-62 PGlite 확인, 로그인 시작 요청 자체의 네트워크 실패 AC-27-2는 브라우저에서 만들 수 없다)
import { mkdirSync } from 'node:fs'
import { launch, openApp, panel, tab, reporter, baseSeed, noHScroll, pct, NET, PORT } from './mpr38_lib.mjs'
import { ids, USER } from './mpr38_server.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 900000)
const [, , PW, DIST, SHOTS] = process.argv
mkdirSync(SHOTS, { recursive: true })
const { ok, done } = reporter()
const SEC = (n) => !process.env.PART || process.env.PART.split(',').includes(n)
const browser = await launch(PW)

const acct = (p) => p.locator('button[aria-haspopup="menu"]')
const sel = (p) => p.locator('select').first()
const selVal = (p) => sel(p).inputValue()
const rest = (a, from = 0) => a.s.log.slice(from).filter((e) => !String(e.t).startsWith('/auth/v1'))
const writes = (a, from = 0) => rest(a, from).filter((e) => e.m !== 'GET' && !String(e.t).startsWith('rpc/ensure_carbook_category'))
const wait = (p, ms = 500) => p.waitForTimeout(ms)
const active = (p) => p.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName}:${e.getAttribute('aria-haspopup') ? 'acct' : (e.textContent || '').trim().slice(0, 12)}` : 'none' })
const seedSettings = (def, vehiclesOnly) => { const s = baseSeed(); s.car_settings = def === undefined ? [] : [{ user_id: USER, default_vehicle_id: def, created_at: '2026-01-01T00:00:00Z' }]; if (vehiclesOnly) { s.vehicles = []; s.car_records = []; s.car_maintenance_items = []; s.car_due_dates = []; s.events = [] } return s }
async function start(vp, seed, opts = {}) {
  const a = await openApp(browser, DIST, { vp, seed, ...opts })
  if (opts.signedIn === false) return a
  await a.page.getByRole('tab', { name: '기록' }).or(a.page.getByText('차량을 추가해 주세요')).first().waitFor({ timeout: 20000 }).catch(() => {})
  await wait(a.page, 700)
  return a
}
async function openSettings(p) { await acct(p).click(); await p.getByRole('menuitem', { name: '설정' }).click(); await p.getByRole('dialog', { name: '설정' }).waitFor(); await wait(p, 400) }
const radio = (p, name) => p.getByRole('dialog', { name: '설정' }).getByRole('radio', { name })
const checkedRadios = (p) => p.getByRole('dialog', { name: '설정' }).locator('input[type=radio]:checked').count()
const toastText = (p) => p.locator('body').innerText()
const DEFAULT_OF = (a) => a.s.db.car_settings[0]?.default_vehicle_id ?? null

// ───── A. 기본 차량(AC-19) ─────
if (SEC('A')) for (const vp of ['mobile375', 'desktop1280']) {
  // AC-19-1·3·12·4
  let a = await start(vp, seedSettings(undefined)); let p = a.page
  ok(`[${vp}] AC-19 시작: 기본 차량이 없으면 가장 먼저 만든 "출퇴근"이 선택됨`, (await selVal(p)) === ids.A)
  await openSettings(p)
  ok(`[${vp}] AC-19-13(성공 경로) 읽기가 성공한 경우 MSG-33이 없고 "지정 안 함"에 선택 표시가 있음`, !(await toastText(p)).includes('현재 지정을 불러오지 못했습니다') && (await radio(p, /지정 안 함/).isChecked()))
  await radio(p, /가족/).click(); await wait(p, 900)
  ok(`[${vp}] AC-19-1 설정에서 "가족"을 고르면 DB의 기본 차량이 가족 차로 저장됨`, DEFAULT_OF(a) === ids.B, String(DEFAULT_OF(a)))
  ok(`[${vp}] AC-19-3 지금 보는 차량은 그대로 "출퇴근"`, (await selVal(p)) === ids.A)
  ok(`[${vp}] AC-19 MSG-36 적용 시점 안내가 보임`, (await p.getByRole('dialog', { name: '설정' }).innerText()).includes('다음에 차계부를 열 때부터 적용됩니다'))
  await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-settings.png`, fullPage: true })
  await p.keyboard.press('Escape'); await wait(p, 700)
  ok(`[${vp}] AC-19-11 Esc로 닫으면 포커스가 계정 영역 버튼으로 돌아옴`, (await active(p)) === 'BUTTON:acct', await active(p))
  await p.reload(); await p.getByRole('tab', { name: '기록' }).waitFor(); await wait(p, 700)
  ok(`[${vp}] AC-19-1·2 새로 열면(다른 곳에서 열어도 서버 값이라 같음) "가족"이 선택됨`, (await selVal(p)) === ids.B, await selVal(p))
  await sel(p).selectOption(ids.A); await wait(p, 400)
  await p.locator('nav[aria-label="화면 전환"] a', { hasText: '캘린더' }).click(); await wait(p, 900)
  await p.locator('nav[aria-label="화면 전환"] a', { hasText: '차계부' }).click(); await p.getByRole('tab', { name: '기록' }).waitFor(); await wait(p, 700)
  ok(`[${vp}] AC-19-12 탭 왕복 뒤 "가족"이 선택되고 하위 탭은 "기록"`, (await selVal(p)) === ids.B && (await tab(p, '기록').getAttribute('aria-selected')) === 'true', await selVal(p))
  await openSettings(p)
  ok(`[${vp}] AC-19-13 읽기 성공: "가족"에 선택 표시`, (await radio(p, /가족/).isChecked()))
  await radio(p, /지정 안 함/).click(); await wait(p, 900)
  ok(`[${vp}] AC-19-4 "지정 안 함"을 고르면 기본 차량이 비워짐`, DEFAULT_OF(a) === null)
  await p.keyboard.press('Escape'); await wait(p, 600); await p.reload(); await p.getByRole('tab', { name: '기록' }).waitFor(); await wait(p, 600)
  ok(`[${vp}] AC-19-4 새로 열면 가장 먼저 만든 "출퇴근"이 선택됨`, (await selVal(p)) === ids.A)
  ok(`[${vp}] 페이지 오류 0건`, a.errors.length === 0, a.errors.join('|')); await a.close()

  // AC-19-5 기본 차량 삭제
  a = await start(vp, seedSettings(ids.B)); p = a.page
  ok(`[${vp}] AC-19-5 시작: 기본 차량 "가족"이 선택됨`, (await selVal(p)) === ids.B)
  await p.locator('section[aria-label="차량 영역"]').getByRole('button', { name: '삭제' }).click(); await wait(p, 500)
  await p.getByRole('dialog').getByRole('button', { name: '삭제' }).click(); await wait(p, 1200)
  await p.reload(); await p.getByRole('tab', { name: '기록' }).waitFor(); await wait(p, 600)
  ok(`[${vp}] AC-19-5 삭제 뒤 새로 열면 "출퇴근"이 선택되고 설정은 "지정 안 함"`, (await selVal(p)) === ids.A && DEFAULT_OF(a) === null)
  await openSettings(p)
  ok(`[${vp}] AC-19-5 설정 창의 "지정 안 함"에 선택 표시`, await radio(p, /지정 안 함/).isChecked()); await a.close()

  // AC-19-6 새 차량 등록
  a = await start(vp, seedSettings(ids.B)); p = a.page
  await sel(p).selectOption(ids.A); await wait(p, 400)
  await p.locator('section[aria-label="차량 영역"]').getByRole('button', { name: '차량 추가' }).first().click(); await wait(p, 600)
  const dlg = p.getByRole('dialog'); await dlg.getByLabel(/별칭/).fill('세컨드'); await dlg.getByRole('button', { name: '저장' }).click(); await wait(p, 1500)
  const newId = a.s.db.vehicles.find((v) => v.name === '세컨드')?.id
  ok(`[${vp}] AC-19-6 새 차량 등록 직후 "세컨드"가 선택됨`, !!newId && (await selVal(p)) === newId)
  await p.reload(); await p.getByRole('tab', { name: '기록' }).waitFor(); await wait(p, 600)
  ok(`[${vp}] AC-19-6 새로 열면 기본 차량 "가족"이 선택됨`, (await selVal(p)) === ids.B); await a.close()

  // AC-19-7 저장 실패, AC-27-10(다) 만료
  for (const [label, code, expectExpired] of [['500', 500, false], ['401', 401, true]]) {
    a = await start(vp, seedSettings(undefined)); p = a.page
    a.s.cfg.fail['POST car_settings'] = code
    await openSettings(p); await radio(p, /가족/).click(); await wait(p, 1200)
    const body = await toastText(p)
    if (!expectExpired) ok(`[${vp}] AC-19-7 저장 ${label} 실패: MSG-01이 보이고 MSG-30은 없음`, body.includes('저장하지 못했습니다. 다시 시도해 주세요') && !body.includes('로그인이 만료됐습니다'))
    else ok(`[${vp}] AC-27-10(다) 기본 차량 저장 401: MSG-30과 "로그인" 버튼이 보이고 MSG-01은 없음`, body.includes('로그인이 만료됐습니다') && (await p.getByRole('dialog', { name: '설정' }).getByRole('button', { name: '로그인' }).count()) >= 1 && !body.includes('저장하지 못했습니다'))
    ok(`[${vp}] AC-19-7/27-10 선택이 이전 값("지정 안 함")으로 돌아옴`, await radio(p, /지정 안 함/).isChecked() && DEFAULT_OF(a) === null)
    delete a.s.cfg.fail['POST car_settings']; await p.keyboard.press('Escape'); await wait(p, 500); await p.reload(); await p.getByRole('tab', { name: '기록' }).waitFor(); await wait(p, 500)
    ok(`[${vp}] AC-19-7 이후 새로 열면 "출퇴근"이 선택됨(${label})`, (await selVal(p)) === ids.A); await a.close()
  }

  // AC-19-8·13 읽기 실패
  a = await openApp(browser, DIST, { vp, seed: seedSettings(ids.B), goto: false }); p = a.page
  a.s.cfg.fail['GET car_settings'] = 500
  await p.goto(`http://localhost:${PORT}/car`); await p.getByRole('tab', { name: '기록' }).waitFor({ timeout: 20000 }); await wait(p, 800)
  ok(`[${vp}] AC-19-8 기본 차량 읽기만 실패해도 MSG-04 없이 열리고 "출퇴근"이 선택됨`, !(await toastText(p)).includes('차계부 데이터를 불러오지 못했습니다') && (await selVal(p)) === ids.A)
  await openSettings(p)
  ok(`[${vp}] AC-19-13 읽기 실패: 라디오 어느 것에도 선택 표시가 없고 MSG-33이 보임`, (await checkedRadios(p)) === 0 && (await toastText(p)).includes('현재 지정을 불러오지 못했습니다'))
  await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-settings-readfail.png`, fullPage: true })
  delete a.s.cfg.fail['GET car_settings']
  await radio(p, /지정 안 함/).click(); await wait(p, 900)
  ok(`[${vp}] AC-19-13 "지정 안 함"과 차량을 고를 수 있음(저장됨)`, DEFAULT_OF(a) === null && (await radio(p, /지정 안 함/).isChecked())); await a.close()

  // AC-19-10 차량 0대, AC-19-11 탭 가두기
  a = await start(vp, seedSettings(undefined, true)); p = a.page
  await openSettings(p)
  const sd = await p.getByRole('dialog', { name: '설정' }).innerText()
  ok(`[${vp}] AC-19-10 차량 0대: "차량을 추가해 주세요"가 보이고 라디오가 없음`, sd.includes('차량을 추가해 주세요') && (await p.getByRole('dialog', { name: '설정' }).locator('input[type=radio]').count()) === 0)
  ok(`[${vp}] AC-20-10 차량 0대: "되돌리기"를 누를 수 없음(aria-disabled)`, (await p.getByRole('dialog', { name: '설정' }).getByRole('button', { name: '되돌리기' }).getAttribute('aria-disabled')) === 'true')
  await a.close()
  a = await start(vp, seedSettings(undefined)); p = a.page
  await openSettings(p)
  ok(`[${vp}] AC-19-11 설정 창이 열려도 주소는 /car`, new URL(p.url()).pathname === '/car')
  let trapped = true
  for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))) trapped = false }
  for (let i = 0; i < 14; i++) { await p.keyboard.press('Shift+Tab'); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))) trapped = false }
  ok(`[${vp}] AC-19-11 설정 창 안에서 Tab·Shift+Tab이 밖으로 나가지 않음`, trapped)
  await a.close()
}

// ───── D. 계정 메뉴·로그아웃(AC-18) ─────
if (SEC('D')) for (const vp of ['mobile375', 'desktop1280']) {
  let a = await start(vp, baseSeed()); let p = a.page
  await acct(p).click(); await wait(p, 300)
  const items = await p.getByRole('menu').getByRole('menuitem').allInnerTexts()
  ok(`[${vp}] AC-18-1 계정 영역을 누르면 "설정"·"로그아웃" 메뉴가 열림`, items.join() === '설정,로그아웃', items.join())
  await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-account-menu.png`, fullPage: true })
  await p.keyboard.press('Escape'); await wait(p, 400)
  ok(`[${vp}] AC-18-1 Esc로 닫히고 포커스가 계정 버튼에 있음`, (await p.getByRole('menu').count()) === 0 && (await active(p)) === 'BUTTON:acct', await active(p))
  await acct(p).click(); await wait(p, 300); await p.mouse.click(5, 5); await wait(p, 400)
  ok(`[${vp}] AC-18-1 메뉴 밖 클릭으로도 닫힘`, (await p.getByRole('menu').count()) === 0)
  // AC-18-2 확인창
  await acct(p).click(); await p.getByRole('menuitem', { name: '로그아웃' }).click(); await wait(p, 600)
  const lc = p.getByRole('dialog', { name: '로그아웃 확인' })
  const logLen = a.s.log.length
  ok(`[${vp}] AC-18-2 확인창에 MSG-22, 버튼 "로그아웃"·"취소", 포커스는 "취소", 로그아웃 요청 0건`, (await lc.innerText()).includes('로그아웃할까요? 모든 기기에서 로그아웃됩니다') && (await lc.getByRole('button').allInnerTexts()).join() === '로그아웃,취소' && (await active(p)) === 'BUTTON:취소' && !a.s.log.some((e) => e.t === '/auth/v1/logout'), await active(p))
  await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-logout-confirm.png`, fullPage: true })
  // AC-18-5 취소 세 가지
  for (const how of ['취소', 'Esc', '창 밖 클릭']) {
    if (how === '취소') await lc.getByRole('button', { name: '취소' }).click(); else if (how === 'Esc') await p.keyboard.press('Escape'); else await p.mouse.click(3, 3)
    await wait(p, 700)
    ok(`[${vp}] AC-18-5 ${how}: 확인창이 닫히고 로그인 유지, 로그아웃 요청 0건, 포커스가 계정 버튼`, (await p.getByRole('dialog', { name: '로그아웃 확인' }).count()) === 0 && (await acct(p).count()) === 1 && !a.s.log.some((e) => e.t === '/auth/v1/logout') && (await active(p)) === 'BUTTON:acct', await active(p))
    await acct(p).click(); await p.getByRole('menuitem', { name: '로그아웃' }).click(); await wait(p, 600)
  }
  // AC-18-6 실패
  a.s.cfg.fail['POST /auth/v1/logout'] = 500
  await p.getByRole('dialog', { name: '로그아웃 확인' }).getByRole('button', { name: '로그아웃' }).click(); await wait(p, 1500)
  const f6 = { toast: (await toastText(p)).includes('로그아웃하지 못했습니다. 다시 시도해 주세요'), acct: await acct(p).count(), tabs: await p.getByRole('tab', { name: '기록' }).count(), tokenLeft: await p.evaluate(() => Object.keys(localStorage).some((k) => k.includes('auth-token'))) }
  ok(`[${vp}] AC-18-6 로그아웃 실패: MSG-23이 보이고 계정 영역·차계부 화면이 그대로`, f6.toast && f6.acct === 1 && f6.tabs === 1, JSON.stringify(f6))
  delete a.s.cfg.fail['POST /auth/v1/logout']
  if (f6.acct === 0) { await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-logout-fail-state.png`, fullPage: true }); await a.close(); a = await start(vp, baseSeed()); p = a.page } // 실패했는데도 이 기기가 로그아웃된 상태(supabase-js가 로컬 세션을 지움) → 뒤 확인을 위해 새로 로그인한 상태로 이어간다
  // AC-18-3·4·7 완료
  await p.keyboard.press('Escape').catch(() => {}); await wait(p, 500)
  let clicks = 0
  await acct(p).click(); clicks++; await p.getByRole('menuitem', { name: '로그아웃' }).click(); clicks++
  const mark = a.s.log.length
  await p.getByRole('dialog', { name: '로그아웃 확인' }).getByRole('button', { name: '로그아웃' }).click(); clicks++
  await p.getByText('로그인하면 사용할 수 있습니다').waitFor({ timeout: 8000 }); await wait(p, 1200)
  const lo = a.s.log.filter((e) => e.t === '/auth/v1/logout').at(-1)
  ok(`[${vp}] AC-18-3 로그아웃 뒤 주소 /car, MSG-02와 로그인 버튼이 보이고 계정 영역 없음`, new URL(p.url()).pathname === '/car' && (await p.getByRole('button', { name: /로그인/ }).count()) >= 1 && (await acct(p).count()) === 0)
  ok(`[${vp}] AC-18-3 로그아웃 뒤 차계부 4개 테이블·events·categories 요청 0건`, rest(a, mark).filter((e) => /^(vehicles|car_|events|categories|rpc)/.test(e.t)).length === 0, JSON.stringify(rest(a, mark).map((e) => e.m + ' ' + e.t)))
  ok(`[${vp}] AC-18-4 로그아웃 요청 범위가 모든 기기(global, local 아님)`, !!lo && !/scope=local/.test(lo.q) && (/scope=global/.test(lo.q) || !/scope/.test(lo.q)), lo?.q)
  ok(`[${vp}] AC-18-7 누름 3번으로 로그인 안내까지`, clicks === 3)
  await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-loggedout.png`, fullPage: true })
  // AC-18-8 캘린더
  await p.locator('nav[aria-label="화면 전환"] a', { hasText: '캘린더' }).click(); await wait(p, 1200)
  ok(`[${vp}] AC-18-8 로그아웃 뒤 캘린더가 기존 동작으로 보임(오류 없음)`, a.errors.length === 0 && (await p.locator('h1', { hasText: '캘린더' }).count()) >= 1, a.errors.join('|'))
  ok(`[${vp}] AC-18-9 로그아웃 뒤 이 기기에 로그인 세션이 남지 않음(localStorage 키 없음)`, !(await p.evaluate(() => Object.keys(localStorage).some((k) => k.includes('auth-token')))))
  await a.close()
  // AC-18-10 키보드
  a = await start(vp, baseSeed()); p = a.page
  await acct(p).focus(); await p.keyboard.press('Enter'); await wait(p, 300)
  const menuOpen = (await p.getByRole('menu').count()) === 1
  const first = await active(p)
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(p, 600)
  const confirmOpen = (await p.getByRole('dialog', { name: '로그아웃 확인' }).count()) === 1
  let trap2 = true
  for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))) trap2 = false }
  await p.getByRole('dialog', { name: '로그아웃 확인' }).getByRole('button', { name: '로그아웃' }).focus(); await p.keyboard.press('Enter')
  await p.getByText('로그인하면 사용할 수 있습니다').waitFor({ timeout: 8000 }).catch(() => {})
  ok(`[${vp}] AC-18-10 키보드만으로 메뉴 열기·항목 선택·확인창 로그아웃이 끝까지 되고 확인창 안에서 Tab이 밖으로 나가지 않음`, menuOpen && confirmOpen && trap2 && (await p.getByText('로그인하면 사용할 수 있습니다').count()) === 1, JSON.stringify({ menuOpen, first, confirmOpen, trap2 }))
  await a.close()
}
// AC-18-11 로그아웃 시간(Fast 4G, 30회)
if (SEC('D')) {
  const ms = []
  for (let i = 0; i < 30; i++) {
    const a = await start('desktop1280', baseSeed(), { net: NET.fast4g }); const p = a.page
    await acct(p).click(); await p.getByRole('menuitem', { name: '로그아웃' }).click(); await wait(p, 500)
    const t0 = Date.now(); await p.getByRole('dialog', { name: '로그아웃 확인' }).getByRole('button', { name: '로그아웃' }).click()
    await p.getByText('로그인하면 사용할 수 있습니다').waitFor({ timeout: 20000 }); ms.push(Date.now() - t0)
    await a.close()
  }
  ok(`AC-18-11 로그아웃 확인→MSG-02 ${ms.length}회 p95 ${pct(ms, 0.95)}ms ≤ 3000ms`, pct(ms, 0.95) <= 3000, ms.join(','))
  console.log(`  · AC-18-11 중앙 ${pct(ms, 0.5)} / p95 ${pct(ms, 0.95)} / 최댓값 ${Math.max(...ms)} ms | raw ${ms.join(',')}`)
}

// ───── E. 로그인 실패·만료 안내(AC-27) ─────
if (SEC('E')) {
  for (const vp of ['mobile375', 'desktop1280']) {
    // AC-27-1 직접 복귀, AC-27-1/3/7 로그인 버튼 왕복
    let a = await openApp(browser, DIST, { vp, signedIn: false, goto: false }); let p = a.page
    await p.goto(`http://localhost:${PORT}/car?error=access_denied&error_description=cancelled`); await p.getByText('로그인하면 사용할 수 있습니다').waitFor(); await wait(p, 600)
    ok(`[${vp}] AC-27-1 취소로 돌아오면 MSG-29(알림)가 보이고 로그인 버튼이 그대로, 차계부 데이터 요청 0건`, (await p.getByRole('alert').filter({ hasText: '로그인하지 못했습니다. 다시 시도해 주세요' }).count()) === 1 && (await p.getByRole('button', { name: /로그인/ }).count()) >= 1 && rest(a).filter((e) => /^(vehicles|car_|events|categories|rpc)/.test(e.t)).length === 0)
    await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-login-failed.png`, fullPage: true })
    ok(`[${vp}] AC-27 접근성: MSG-29는 role=alert`, (await p.getByRole('alert').count()) >= 1)
    await p.goto(`http://localhost:${PORT}/car`); await p.getByText('로그인하면 사용할 수 있습니다').waitFor(); await wait(p, 400)
    ok(`[${vp}] AC-27-3 오류 없이 처음 열면 MSG-29가 없음`, (await p.getByText('로그인하지 못했습니다').count()) === 0)
    await p.goto(`http://localhost:${PORT}/car?error=access_denied`); await p.getByText('로그인하지 못했습니다').waitFor()
    a.s.cfg.authorizeTo = '/car?error=access_denied&error_description=cancelled'
    const mark = a.s.log.length
    await p.getByRole('button', { name: /로그인/ }).first().click(); await wait(p, 1500)
    const auth = a.s.log.slice(mark).find((e) => e.t === '/auth/v1/authorize')
    ok(`[${vp}] AC-27-7·AC-02-2 로그인 시작 요청이 공급자 google, 돌아올 주소가 /car`, !!auth && /provider=google/.test(auth.q) && /redirect_to=http:\/\/localhost:\d+\/car/.test(auth.q), auth?.q)
    ok(`[${vp}] AC-27-1 로그인을 취소하고 돌아오면 다시 MSG-29가 보이고 로그인 버튼이 그대로`, (await p.getByRole('alert').filter({ hasText: '로그인하지 못했습니다' }).count()) === 1 && (await p.getByRole('button', { name: /로그인/ }).count()) >= 1)
    a.s.cfg.authorizeTo = '/car'
    await p.getByRole('button', { name: /로그인/ }).first().click(); await wait(p, 1500)
    ok(`[${vp}] AC-27-3 다시 눌러 오류 없이 돌아오면 MSG-29가 없음`, (await p.getByText('로그인하지 못했습니다').count()) === 0)
    ok(`[${vp}] 페이지 오류 0건`, a.errors.length === 0, a.errors.join('|')); await a.close()

    // AC-27-4·5·11·9 기록 양식의 만료와 다른 실패, MPR-73 버튼 잠금
    for (const mode of ['401', '500', 'offline']) {
      a = await start(vp, baseSeed()); p = a.page
      await p.getByRole('button', { name: '기록 추가' }).first().click(); await wait(p, 500)
      const d = p.getByRole('dialog'); await d.getByLabel(/종류/).selectOption('other'); await d.getByLabel(/금액/).fill('12345'); await d.getByLabel(/메모/).fill('만료확인')
      if (mode === 'offline') await a.ctx.setOffline(true); else a.s.cfg.fail['POST car_records'] = Number(mode)
      const m = a.s.log.length
      await d.getByRole('button', { name: '저장' }).click(); await wait(p, 1500)
      const body = await toastText(p), expired = body.includes('로그인이 만료됐습니다. 다시 로그인해 주세요')
      if (mode === '401') {
        ok(`[${vp}] AC-27-4 저장 401: MSG-30과 "로그인" 버튼이 보이고 MSG-01은 없음`, expired && (await p.getByRole('dialog').getByRole('button', { name: '로그인' }).count()) >= 1 && !body.includes('저장하지 못했습니다. 다시 시도해 주세요'))
        ok(`[${vp}] AC-27-4 양식의 입력값(금액·메모)이 그대로`, (await d.getByLabel(/금액/).inputValue()).replace(/,/g, '') === '12345' && (await d.getByLabel(/메모/).inputValue()) === '만료확인')
        ok(`[${vp}] AC-27-9 만료 안내는 role=alert(화면낭독기가 자동으로 읽음)`, (await p.getByRole('alert').filter({ hasText: '로그인이 만료됐습니다' }).count()) === 1)
        ok(`[${vp}] AC-27-11 "로그인" 버튼 옆에 MSG-37이 보임`, body.includes('다시 로그인하면 입력한 내용은 사라집니다'))
        await wait(p, 2500)
        ok(`[${vp}] AC-27-4 만료 안내는 닫기 전까지 남음(2.5초 뒤에도)`, (await toastText(p)).includes('로그인이 만료됐습니다'))
        const m2 = a.s.log.length
        await d.getByRole('button', { name: '저장' }).click({ force: true, timeout: 3000 }).catch(() => {}); await wait(p, 600)
        ok(`[${vp}] MPR-73 만료 안내가 떠 있는 동안 저장 버튼이 잠겨 쓰기 요청이 더 나가지 않음`, writes(a, m2).length === 0, JSON.stringify(writes(a, m2).map((e) => e.m + ' ' + e.t)))
        const pos = await d.evaluate((dd) => { const n = dd.querySelector('[role=alert]'); const b = [...dd.querySelectorAll('button')].find((x) => x.textContent.trim() === '저장'); return n && b ? n.getBoundingClientRect().bottom <= b.getBoundingClientRect().top + 1 : null })
        ok(`[${vp}] MPR-73 만료 안내가 버튼 줄 위에 있음`, pos === true, String(pos))
        await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-expired.png`, fullPage: true })
        // AC-27-7 로그인 버튼
        a.s.cfg.authorizeTo = '/car'; const m3 = a.s.log.length
        await d.getByRole('button', { name: '로그인' }).click(); await wait(p, 1500)
        const au = a.s.log.slice(m3).find((e) => e.t === '/auth/v1/authorize')
        ok(`[${vp}] AC-27-7 "로그인"을 누르면 돌아올 주소가 /car인 Google 로그인이 시작됨`, !!au && /provider=google/.test(au.q) && /redirect_to=http:\/\/localhost:\d+\/car/.test(au.q), au?.q)
        ok(`[${vp}] AC-27-7 돌아온 뒤 이전 양식의 입력값은 없음(알려진 한계)`, (await p.getByRole('dialog').count()) === 0)
      } else {
        ok(`[${vp}] AC-27-5 ${mode === '500' ? '500' : '네트워크 끊김'}: MSG-01이 보이고 MSG-30은 없음`, body.includes('저장하지 못했습니다. 다시 시도해 주세요') && !expired)
      }
      if (mode === 'offline') await a.ctx.setOffline(false)
      await a.close()
    }
    // AC-27-11 닫으면 MSG-30·37이 함께 사라짐
    a = await start(vp, baseSeed()); p = a.page
    await p.getByRole('button', { name: '기록 추가' }).first().click(); await wait(p, 500)
    let d = p.getByRole('dialog'); await d.getByLabel(/종류/).selectOption('other'); await d.getByLabel(/금액/).fill('777'); a.s.cfg.fail['POST car_records'] = 401
    await d.getByRole('button', { name: '저장' }).click(); await wait(p, 1200)
    await p.keyboard.press('Escape'); await wait(p, 900)
    const after = await toastText(p)
    ok(`[${vp}] AC-27-11 대화상자를 닫으면 MSG-30과 MSG-37이 함께 사라짐`, !after.includes('로그인이 만료됐습니다') && !after.includes('다시 로그인하면 입력한 내용은 사라집니다') && (await p.getByRole('dialog').count()) === 0, after.slice(0, 120))
    await a.close()
    // AC-27-6 삭제 만료
    a = await start(vp, baseSeed()); p = a.page
    const rowsBefore = await p.locator('section ul li').count()
    await p.locator('section ul li').first().getByRole('button').first().click(); await wait(p, 600)
    await p.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click(); await wait(p, 600)
    await p.getByRole('dialog', { name: '삭제 확인' }).waitFor({ timeout: 5000 })
    a.s.cfg.fail['DELETE car_records'] = 401
    await p.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '삭제', exact: true }).click(); await wait(p, 1500)
    const dt = await toastText(p)
    ok(`[${vp}] AC-27-6 삭제 401: MSG-03 대신 MSG-30과 "로그인" 버튼이 보이고 항목은 그대로`, dt.includes('로그인이 만료됐습니다') && !dt.includes('삭제하지 못했습니다') && (await p.getByRole('button', { name: '로그인' }).count()) >= 1 && a.s.db.car_records.length >= rowsBefore, dt.slice(0, 160))
    await a.close()
  }
}


// ───── B. 추천 교체 주기 되돌리기(AC-20) ─────
const ITEM = (n, vehicle, name, km, mo, ld, lo, ev = null) => ({ id: `c0000000-0000-4000-8000-0000000000${n}`, vehicle_id: vehicle, name, interval_km: km, interval_months: mo, last_date: ld, last_odometer_km: lo, event_id: ev, created_at: `2026-01-10T00:00:00.0${String(n).slice(-2)}Z` })
const EVA = 'e0000000-0000-4000-8000-0000000000a1'
function resetSeed(variant) {
  const s = baseSeed()
  const A = ids.A
  const items = variant === 'names'
    ? [ITEM(11, A, '엔진오일', 15000, 6, '2026-05-01', 40000), ITEM(12, A, '엔진오일', 20000, null, '2026-05-01', 40000), ITEM(13, A, '오일 교환', 15000, 6, '2026-05-01', 40000)]
    : variant === 'none'
      ? [ITEM(11, A, '엔진오일', 10000, 12, '2026-05-01', 40000), ITEM(12, A, '와이퍼', null, 12, '2026-03-01', null)]
      : variant === 'unset'
        ? [ITEM(11, A, '엔진오일', 15000, 6, null, null), ITEM(12, A, '에어컨 필터', 5000, null, '2026-08-01', 44000)]
        : [ITEM(11, A, '엔진오일', 15000, 6, '2026-05-01', 40000, EVA), ITEM(12, A, '에어컨 필터', 5000, null, '2026-08-01', 44000), ITEM(13, A, '타이어 위치 교환', 10000, 6, '2026-08-01', 44000),
          ITEM(14, A, '에어 필터', 20000, 12, '2026-01-01', 30000), ITEM(15, A, '브레이크 패드 점검', 20000, null, '2026-01-01', 30000), ITEM(16, A, '배터리 점검', null, 36, '2026-01-01', null), ITEM(17, A, '겨울 타이어', 5000, null, '2026-02-01', 44000)]
  items.push(ITEM(31, ids.B, '엔진오일', 15000, 6, '2026-05-01', 40000))
  s.car_maintenance_items = items
  s.events = s.events.filter((e) => e.id !== 'e0000000-0000-4000-8000-0000000000b1') // 가족 차 타이어 일정은 쓰지 않는다
  return s
}
const resetDlg = (p) => p.getByRole('dialog', { name: '추천 교체 주기 되돌리기' })
const itemsOf = (a, v) => a.s.db.car_maintenance_items.filter((i) => i.vehicle_id === v)
const cyc = (i) => `${i.interval_km ?? '-'}/${i.interval_months ?? '-'}`
async function openReset(p) { await openSettings(p); await p.getByRole('dialog', { name: '설정' }).getByRole('button', { name: '되돌리기' }).click(); await resetDlg(p).waitFor(); await wait(p, 400) }
if (SEC('B')) for (const vp of ['mobile375', 'desktop1280']) {
  let a = await start(vp, resetSeed()); let p = a.page
  const before = structuredClone(a.s.db.car_maintenance_items)
  const w0 = a.s.log.length
  await openReset(p)
  const txt = await resetDlg(p).innerText()
  ok(`[${vp}] AC-20-1 미리 보기: 항목 3개, MSG-25의 {N}=3, 쓰기 요청 0건`, /주기가 바뀌는 항목 3개/.test(txt) && writes(a, w0).length === 0, txt.replace(/\s+/g, ' ').slice(0, 300))
  ok(`[${vp}] AC-20-1 변경 내용이 엔진오일·에어컨 필터·타이어 위치 교환 순서로 "이전 → 추천" 모양`, /엔진오일[\s\S]*15,000km \/ 6개월[\s\S]*10,000km \/ 12개월[\s\S]*에어컨 필터[\s\S]*5,000km[\s\S]*10,000km \/ 6개월[\s\S]*타이어 위치 교환[\s\S]*10,000km \/ 6개월[\s\S]*10,000km/.test(txt.replace(/지금 |추천 /g, '')), txt.replace(/\s+/g, ' ').slice(0, 400))
  await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-reset-preview.png`, fullPage: true })
  // AC-20-5 취소 세 가지
  for (const how of ['취소', 'Esc', '창 밖 클릭']) {
    if (how === '취소') await resetDlg(p).getByRole('button', { name: '취소' }).click(); else if (how === 'Esc') await p.keyboard.press('Escape'); else await p.mouse.click(3, 3)
    await wait(p, 900)
    ok(`[${vp}] AC-20-5 ${how}: 미리 보기만 닫히고 항목 변경 0, 쓰기 요청 0건`, (await resetDlg(p).count()) === 0 && writes(a, w0).length === 0 && JSON.stringify(a.s.db.car_maintenance_items) === JSON.stringify(before))
    if ((await p.getByRole('dialog', { name: '설정' }).count()) === 0) await openSettings(p)
    await p.getByRole('dialog', { name: '설정' }).getByRole('button', { name: '되돌리기' }).click(); await resetDlg(p).waitFor(); await wait(p, 400)
  }
  // AC-20-9 연속 누름 + AC-20-2 적용
  const m1 = a.s.log.length, evBefore = a.s.db.events.find((e) => e.id === EVA)?.start_at
  await resetDlg(p).getByRole('button', { name: '되돌리기' }).dblclick({ delay: 0 }); await wait(p, 1800)
  const w = writes(a, m1)
  ok(`[${vp}] AC-20-9 "되돌리기"를 연달아 눌러도 항목 쓰기 요청이 1회(한 upsert)`, w.filter((e) => e.t === 'car_maintenance_items').length === 1, JSON.stringify(w.map((e) => e.m + ' ' + e.t)))
  const byName = (n) => itemsOf(a, ids.A).find((i) => i.name === n)
  ok(`[${vp}] AC-20-2 세 항목의 주기가 추천 값으로 바뀜(엔진오일 10000/12, 에어컨 필터 10000/6, 타이어 위치 교환 10000/-)`, cyc(byName('엔진오일')) === '10000/12' && cyc(byName('에어컨 필터')) === '10000/6' && cyc(byName('타이어 위치 교환')) === '10000/-', itemsOf(a, ids.A).map((i) => i.name + ':' + cyc(i)).join(' '))
  ok(`[${vp}] AC-20-2 마지막 교체일·주행거리·연결 일정 id는 그대로`, itemsOf(a, ids.A).every((i) => { const b = before.find((x) => x.id === i.id); return b.last_date === i.last_date && b.last_odometer_km === i.last_odometer_km && b.event_id === i.event_id && b.name === i.name && b.created_at === i.created_at }))
  ok(`[${vp}] AC-20-2 "와이퍼"는 다시 생기지 않고, "겨울 타이어"와 다른 차량 항목은 그대로`, !byName('와이퍼') && cyc(byName('겨울 타이어')) === '5000/-' && cyc(itemsOf(a, ids.B)[0]) === '15000/6')
  ok(`[${vp}] AC-20-3 엔진오일의 연결 일정 날짜가 바뀌고(일정 쓰기 1건) 에어컨 필터·타이어 위치 교환 일정은 만들어지지 않음`, writes(a, m1).filter((e) => e.t === 'events').length === 1 && a.s.db.events.find((e) => e.id === EVA)?.start_at !== evBefore && !a.s.db.events.some((e) => /에어컨 필터|타이어 위치/.test(e.title)), `${evBefore} → ${a.s.db.events.find((e) => e.id === EVA)?.start_at}`)
  const dlgText = await p.getByRole('dialog', { name: '설정' }).innerText()
  ok(`[${vp}] AC-20-11 설정 창에 MSG-34 "3개 항목의 주기를 되돌렸습니다"가 보이고 MSG-35는 없음`, dlgText.includes('3개 항목의 주기를 되돌렸습니다') && !dlgText.includes('일부 항목은 캘린더에 반영하지 못했습니다'), dlgText.replace(/\s+/g, ' ').slice(-200))
  await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-reset-done.png`, fullPage: true })
  // AC-20-4 되돌릴 것 없음
  const m2 = a.s.log.length
  await p.getByRole('dialog', { name: '설정' }).getByRole('button', { name: '되돌리기' }).click(); await wait(p, 700)
  const dt2 = await p.getByRole('dialog', { name: '설정' }).innerText()
  ok(`[${vp}] AC-20-4 이제 되돌릴 것이 없으면 MSG-24가 보이고 쓰기 요청 0건`, dt2.includes('추천 주기와 다른 항목이 없습니다') && writes(a, m2).length === 0 && !dt2.includes('주기를 되돌렸습니다'))
  await p.keyboard.press('Escape'); await wait(p, 600); await openSettings(p)
  const dt2b = await p.getByRole('dialog', { name: '설정' }).innerText()
  ok(`[${vp}] AC-20-11 설정 창을 닫았다 다시 열면 결과 줄이 없음`, !dt2b.includes('주기를 되돌렸습니다') && !dt2b.includes('추천 주기와 다른'))
  ok(`[${vp}] 페이지 오류 0건`, a.errors.length === 0, a.errors.join('|')); await a.close()

  // AC-20-6 저장 실패, AC-27-10(나)·AC-20-13(다) 만료
  for (const [mode, code] of [['500', 500], ['401', 401]]) {
    a = await start(vp, resetSeed()); p = a.page; const bf = JSON.stringify(a.s.db.car_maintenance_items)
    a.s.cfg.fail['POST car_maintenance_items'] = code
    await openReset(p); await resetDlg(p).getByRole('button', { name: '되돌리기' }).click(); await wait(p, 1500)
    const bodyText = await toastText(p)
    if (mode === '500') ok(`[${vp}] AC-20-6 저장 500 실패: MSG-01이 보이고 세 항목 모두 이전 주기 그대로, 결과 줄(MSG-34) 없음`, bodyText.includes('저장하지 못했습니다. 다시 시도해 주세요') && JSON.stringify(a.s.db.car_maintenance_items) === bf && !bodyText.includes('주기를 되돌렸습니다'))
    else ok(`[${vp}] AC-27-10(나)/AC-20-13(다) 되돌리기 401: MSG-30과 "로그인" 버튼, 항목 주기 불변, MSG-34 없음`, bodyText.includes('로그인이 만료됐습니다') && (await p.getByRole('button', { name: '로그인' }).count()) >= 1 && JSON.stringify(a.s.db.car_maintenance_items) === bf && !bodyText.includes('주기를 되돌렸습니다') && !bodyText.includes('저장하지 못했습니다'))
    await a.close()
  }
  // AC-20-7·12 일정 반영 실패
  a = await start(vp, resetSeed()); p = a.page
  a.s.cfg.fail['POST events'] = 500
  await openReset(p); await resetDlg(p).getByRole('button', { name: '되돌리기' }).click(); await wait(p, 2000)
  const dt3 = await p.getByRole('dialog', { name: '설정' }).innerText()
  ok(`[${vp}] AC-20-7/12 일정 쓰기만 실패: 항목 주기는 바뀌고 MSG-34에 이어 MSG-35가 보임`, cyc(itemsOf(a, ids.A).find((i) => i.name === '엔진오일')) === '10000/12' && dt3.includes('3개 항목의 주기를 되돌렸습니다') && dt3.includes('일부 항목은 캘린더에 반영하지 못했습니다. 교체 알림 탭에서 다시 시도하세요'), dt3.replace(/\s+/g, ' ').slice(-220))
  await p.keyboard.press('Escape'); await wait(p, 600); await tab(p, '교체 알림').click(); await wait(p, 700)
  const rb = panel(p).getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ })
  ok(`[${vp}] AC-20-12 교체 알림 탭의 엔진오일 행에 "캘린더 반영 실패, 다시 시도"(MSG-11) 버튼이 있음`, (await rb.count()) === 1)
  delete a.s.cfg.fail['POST events']
  const evBefore2 = a.s.db.events.filter((e) => e.id === EVA).length
  await rb.first().click(); await wait(p, 300); await rb.first().click({ timeout: 1000 }).catch(() => {}); await wait(p, 1500)
  ok(`[${vp}] AC-20-7 재시도 버튼을 여러 번 눌러 성공해도 엔진오일 일정은 1건`, a.s.db.events.filter((e) => e.id === EVA).length === 1 && evBefore2 === 1 && (await panel(p).getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ }).count()) === 0)
  await a.close()
  // AC-20-8 이름 기준
  a = await start(vp, resetSeed('names')); p = a.page
  await openReset(p); await resetDlg(p).getByRole('button', { name: '되돌리기' }).click(); await wait(p, 1500)
  ok(`[${vp}] AC-20-8 이름이 "엔진오일"인 두 항목은 10000/12가 되고 "오일 교환"은 그대로`, itemsOf(a, ids.A).filter((i) => i.name === '엔진오일').every((i) => cyc(i) === '10000/12') && cyc(itemsOf(a, ids.A).find((i) => i.name === '오일 교환')) === '15000/6')
  await a.close()
  // AC-20-4 처음부터 없음
  a = await start(vp, resetSeed('none')); p = a.page; const m5 = a.s.log.length
  await openSettings(p); await p.getByRole('dialog', { name: '설정' }).getByRole('button', { name: '되돌리기' }).click(); await wait(p, 700)
  ok(`[${vp}] AC-20-4 처음부터 추천 주기뿐이면 MSG-24, 쓰기 요청 0건, 미리 보기 창 없음`, (await p.getByRole('dialog', { name: '설정' }).innerText()).includes('추천 주기와 다른 항목이 없습니다') && writes(a, m5).length === 0 && (await resetDlg(p).count()) === 0)
  await a.close()
  // AC-24-7 미입력 항목은 주기만
  a = await start(vp, resetSeed('unset')); p = a.page
  await openReset(p); await resetDlg(p).getByRole('button', { name: '되돌리기' }).click(); await wait(p, 1500)
  const u = itemsOf(a, ids.A).find((i) => i.name === '엔진오일')
  ok(`[${vp}] AC-24-7 미입력 엔진오일은 주기만 10000/12가 되고 마지막 교체일은 계속 비어 있으며 일정이 만들어지지 않음`, cyc(u) === '10000/12' && u.last_date === null && u.event_id === null)
  await p.keyboard.press('Escape'); await wait(p, 600); await tab(p, '교체 알림').click(); await wait(p, 700)
  ok(`[${vp}] AC-24-7 교체 알림 탭에서도 엔진오일은 계속 "미입력"`, (await panel(p).locator('li').filter({ hasText: '엔진오일' }).first().innerText()).includes('미입력'))
  await a.close()
}

// ───── C. 미입력 항목·첫 기록·일정 memo(AC-24·AC-06-13/15·AC-26·AC-28) ─────
const rows = (p) => panel(p).locator('li')
if (SEC('C')) for (const vp of ['mobile375', 'desktop1280']) {
  let a = await start(vp, baseSeed()); let p = a.page
  await p.locator('section[aria-label="차량 영역"]').getByRole('button', { name: '차량 추가' }).first().click(); await wait(p, 600)
  let d = p.getByRole('dialog'); await d.getByLabel(/별칭/).fill('신차'); await d.getByLabel(/현재 주행거리/).fill('48000'); const mC = a.s.log.length
  await d.getByRole('button', { name: '저장' }).click(); await wait(p, 2000)
  const nv = a.s.db.vehicles.find((v) => v.name === '신차'); const nvItems = a.s.db.car_maintenance_items.filter((i) => i.vehicle_id === nv?.id)
  ok(`[${vp}] AC-24-1/AC-06-13 새 차량: 추천 7개 모두 마지막 교체일·주행거리가 비고(null) 일정 쓰기 0건`, nvItems.length === 7 && nvItems.every((i) => i.last_date === null && i.last_odometer_km === null && i.event_id === null) && writes(a, mC).filter((e) => e.t === 'events').length === 0, `items ${nvItems.length}`)
  await tab(p, '교체 알림').click(); await wait(p, 800)
  const t1 = await panel(p).innerText()
  ok(`[${vp}] AC-24-1 새 차량의 교체 알림 탭: "미입력" 7개, MSG-26 7개, MSG-38 1개, 상태 배지 없음`, (t1.match(/미입력/g) ?? []).length === 7 && (t1.match(/마지막 교체일을 입력하세요/g) ?? []).length === 7 && (t1.match(/마지막 교체일을 입력하면 다음 교체일을 계산합니다/g) ?? []).length === 1 && !/교체 시기 지남|곧 교체/.test(t1), t1.replace(/\s+/g, ' ').slice(0, 200))
  await p.screenshot({ path: `${SHOTS}/mpr72-${vp}-newvehicle-unset.png`, fullPage: true })
  // AC-24-2 첫 기록이 채우지 않음
  await tab(p, '기록').click(); await wait(p, 500)
  await p.getByRole('button', { name: '기록 추가' }).first().click(); await wait(p, 500); d = p.getByRole('dialog')
  await d.getByLabel(/종류/).selectOption('other'); await d.getByLabel(/금액/).fill('5000'); await d.getByLabel(/주행거리/).fill('48500')
  const mC2 = a.s.log.length
  await d.getByRole('button', { name: '저장' }).click(); await wait(p, 1800)
  ok(`[${vp}] AC-24-2 주행거리 기록을 저장해도 미입력 7개는 그대로이고 일정 0건`, a.s.db.car_maintenance_items.filter((i) => i.vehicle_id === nv.id).every((i) => i.last_odometer_km === null && i.last_date === null) && writes(a, mC2).filter((e) => e.t === 'events').length === 0, JSON.stringify(writes(a, mC2).map((e) => e.m + ' ' + e.t)))
  // AC-24-3 날짜 입력(엔진오일)
  await tab(p, '교체 알림').click(); await wait(p, 600)
  await rows(p).filter({ hasText: '엔진오일' }).first().getByRole('button', { name: /수정/ }).click(); await wait(p, 600); d = p.getByRole('dialog')
  await d.locator('input[name="lastDate"]').fill('2026-06-01'); await d.locator('input[name="lastOdometer"]').fill('40000'); const mC3 = a.s.log.length
  await d.getByRole('button', { name: '저장' }).click(); await wait(p, 2000)
  const e1 = a.s.db.car_maintenance_items.find((i) => i.vehicle_id === nv.id && i.name === '엔진오일')
  const row1 = await rows(p).filter({ hasText: '엔진오일' }).first().innerText()
  ok(`[${vp}] AC-24-3 엔진오일에 날짜를 넣으면 "미입력"·MSG-26이 사라지고 다음 교체일이 보이며 일정이 1건 생김, 다른 6개는 미입력`, !row1.includes('미입력') && /\d{4}-\d{2}-\d{2}/.test(row1) && !!e1.event_id && a.s.db.events.filter((e) => e.id === e1.event_id).length === 1 && writes(a, mC3).filter((e) => e.t === 'events').length === 1 && (await panel(p).innerText()).match(/미입력/g)?.length === 6, row1.replace(/\s+/g, ' '))
  const toastC3 = await toastText(p)
  ok(`[${vp}] AC-28-1 일정이 생기면 "캘린더에 {날짜} 일정으로 추가했습니다" 안내`, /캘린더에 \d{4}-\d{2}-\d{2} 일정으로 추가했습니다/.test(toastC3), toastC3.slice(0, 160))
  // AC-24-4 교체 완료로 입력
  await rows(p).filter({ hasText: '에어컨 필터' }).first().getByRole('button', { name: /교체 완료/ }).click(); await wait(p, 600); d = p.getByRole('dialog')
  await d.getByLabel(/마지막 교체일/).fill('2026-11-20'); await d.getByLabel(/마지막 교체 주행거리/).fill('48000'); await d.getByRole('button', { name: '확인' }).click(); await wait(p, 1800)
  const ac = a.s.db.car_maintenance_items.find((i) => i.vehicle_id === nv.id && i.name === '에어컨 필터')
  ok(`[${vp}] AC-24-4 미입력 에어컨 필터를 "교체 완료"로 확인하면 마지막 교체일·주행거리가 채워지고 다음 교체일이 계산됨`, ac.last_date === '2026-11-20' && ac.last_odometer_km === 48000 && !(await rows(p).filter({ hasText: '에어컨 필터' }).first().innerText()).includes('미입력'))
  ok(`[${vp}] AC-24-8 아직 미입력 5개가 있어 MSG-38이 계속 보임`, (await panel(p).innerText()).includes('마지막 교체일을 입력하면 다음 교체일을 계산합니다'))
  ok(`[${vp}] 페이지 오류 0건`, a.errors.length === 0, a.errors.join('|')); await a.close()

  // AC-06-15 v0.2 이전 차량: 첫 주행거리 기록이 빈 주행거리를 채움(미입력 항목은 제외)
  const s15 = baseSeed(); s15.vehicles[0].odometer_km = null
  s15.car_records = s15.car_records.filter((r) => r.vehicle_id !== ids.A)
  s15.car_maintenance_items = [ITEM(41, ids.A, '엔진오일', 10000, 12, '2026-11-05', null), ITEM(42, ids.A, '와이퍼', null, 12, null, null)]
  a = await start(vp, s15); p = a.page; const mC4 = a.s.log.length
  await p.getByRole('button', { name: '기록 추가' }).first().click(); await wait(p, 500); d = p.getByRole('dialog')
  await d.getByLabel(/종류/).selectOption('other'); await d.getByLabel(/금액/).fill('1000'); await d.getByLabel(/주행거리/).fill('48000'); await d.getByRole('button', { name: '저장' }).click(); await wait(p, 2000)
  const o1 = a.s.db.car_maintenance_items.find((i) => i.name === '엔진오일'), o2 = a.s.db.car_maintenance_items.find((i) => i.name === '와이퍼')
  ok(`[${vp}] AC-06-15 이전 차량의 마지막 교체일이 있는 km 항목은 첫 기록의 48,000으로 채워지고 미입력 항목은 비어 있음, 일정은 안 만들어짐`, o1.last_odometer_km === 48000 && o2.last_odometer_km === null && writes(a, mC4).filter((e) => e.t === 'events').length === 0, JSON.stringify([o1.last_odometer_km, o2.last_odometer_km]))
  await a.close()

  // AC-26-1·3·5·6·7 일정 memo
  const s26 = baseSeed(); s26.car_maintenance_items = []; s26.events = s26.events.filter((e) => e.id !== EVA && !e.title.includes('엔진오일'))
  a = await start(vp, s26); p = a.page
  await tab(p, '교체 알림').click(); await wait(p, 500)
  await panel(p).getByRole('button', { name: /항목 추가/ }).first().click(); await wait(p, 600); d = p.getByRole('dialog')
  await d.locator('input[name="name"]').fill('km전용')
  await d.locator('input[name="intervalKm"]').fill('5000'); await d.locator('input[name="lastDate"]').fill('2026-11-10'); await d.locator('input[name="lastOdometer"]').fill('48000')
  await d.getByRole('button', { name: '저장' }).click(); await wait(p, 2000)
  const k1 = a.s.db.car_maintenance_items.find((i) => i.name === 'km전용'); const ev1 = a.s.db.events.find((e) => e.id === k1?.event_id)
  ok(`[${vp}] AC-26-1 km 기준 일정: 메모가 MSG-28이고 제목이 "[별칭] km전용 교체 예정"`, !!ev1 && ev1.memo === '주행거리 기준 추정 날짜입니다. 기록이 쌓이면 바뀝니다' && ev1.title === '[출퇴근] km전용 교체 예정', JSON.stringify(ev1 && [ev1.title, ev1.start_at, ev1.memo]))
  ok(`[${vp}] AC-26-6 같은 행의 다음 교체일 옆에 "추정"이 보임`, (await rows(p).filter({ hasText: 'km전용' }).first().innerText()).includes('추정'))
  const kmDate = ev1?.start_at
  await rows(p).filter({ hasText: 'km전용' }).first().getByRole('button', { name: /수정/ }).click(); await wait(p, 600); d = p.getByRole('dialog')
  await d.locator('input[name="intervalMonths"]').fill('2'); await d.locator('input[name="lastDate"]').fill('2026-11-01'); await d.getByRole('button', { name: '저장' }).click(); await wait(p, 2000)
  const ev2 = a.s.db.events.find((e) => e.id === k1?.event_id)
  ok(`[${vp}] AC-26-3 개월 주기를 더하면 같은 일정의 날짜가 개월 날짜로 바뀌고 메모가 비워짐`, !!ev2 && ev2.start_at !== kmDate && (ev2.memo === null || ev2.memo === '') && a.s.db.events.filter((e) => e.id === k1.event_id).length === 1, JSON.stringify([kmDate, ev2?.start_at, ev2?.memo]))
  ok(`[${vp}] AC-26-7 개월 기준이 되면 "추정"이 보이지 않음`, !(await rows(p).filter({ hasText: 'km전용' }).first().innerText()).includes('추정'))
  ok(`[${vp}] AC-26-5 모든 연결 일정의 제목·메모에 번호판 문자열이 없음`, a.s.db.events.every((e) => !String(e.title).includes('12가3456') && !String(e.memo ?? '').includes('12가3456')))
  await a.close()
}

console.log(`\n(스크립트 끝: PART=${process.env.PART ?? '전체'})`)
await browser.close()
done()
