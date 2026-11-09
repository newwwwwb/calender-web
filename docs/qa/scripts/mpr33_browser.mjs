// MPR-33 QA 임시 스크립트: (1) 기록 탭 harness를 375px·1280px로 열어 레이아웃·열 위치·겹친 창(양식 위 확인창)의 Esc·Tab·DOM 제거를 확인하고, (2) 실제 캘린더 앱에서 공용 Overlay(일정 편집창, 반복 일정 범위 창)의 Esc·Tab 동작이 그대로인지 본다.
// 실행: node docs/qa/scripts/mpr33_browser.mjs <playwright-core index.mjs> <harness 빌드 폴더> <앱 빌드 폴더(--base ./, Supabase 환경변수 비움)> <스크린샷 폴더> (서버 없이 route로 파일을 내려준다)
import { pathToFileURL } from 'node:url'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const [, , pwPath, HARNESS, APP, SHOTS] = process.argv
const { chromium } = await import(pathToFileURL(pwPath).href)
mkdirSync(SHOTS, { recursive: true })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`) }
const ORIGIN = 'http://qa.local'

async function open(dir, vp, { query = '', touch = false, init } = {}) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch })
  if (init) await ctx.addInitScript(init)
  await ctx.route(`${ORIGIN}/**`, (r) => { const p = new URL(r.request().url()).pathname; const f = join(dir, p === '/' ? 'index.html' : p); return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: types[extname(f)] ?? 'application/octet-stream' }) : r.fulfill({ status: 404 }) })
  await ctx.route((u) => u.origin !== ORIGIN, (r) => r.abort())
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/${query}`); await page.waitForTimeout(700)
  return { ctx, page }
}
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
const inDialog = (p, name) => p.evaluate((n) => { const d = document.querySelector(`[role="dialog"][aria-label="${n}"]`); return !!d && d.contains(document.activeElement) }, name)
const dialogs = (p) => p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('aria-label')))
const waitNoDialog = async (p, ms = 1500) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await dialogs(p)).length === 0) return Date.now() - t0; await p.waitForTimeout(50) } return -1 }

// ───── 1. 기록 탭 harness ─────
for (const [label, vp] of [['mobile375', { width: 375, height: 760 }], ['desktop1280', { width: 1280, height: 800 }]]) {
  const { ctx, page } = await open(HARNESS, vp, { touch: label === 'mobile375' })
  const rowCount = await page.locator('ul li button').count()
  ok(`[${label}] 기록 5건이 목록에 보이고 가로 스크롤 없음`, rowCount === 5 && (await noHScroll(page)), `rows=${rowCount}`)
  await page.screenshot({ path: `${SHOTS}/mpr33-${label}-records.png`, fullPage: true })
  // 연비 요약: harness 데이터의 가득 주유 r1(10-01, 46,800km)과 r4(11-03, 47,800km, 38.5L) 사이 (47,800−46,800)÷(20+38.5)=17.1
  ok(`[${label}] 연비 요약 "연비 17.1km/L"와 11-03 행의 구간 연비`, (await page.locator('body').innerText()).includes('연비 17.1km/L') && (await page.locator('ul li button').nth(1).getAttribute('aria-label')).includes('연비 17.1km/L'))
  // 열 위치(행마다 같은 x)
  const cols = await page.evaluate(() => [...document.querySelectorAll('ul li button')].map((b) => {
    const g = (sel) => { const e = b.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), r: Math.round(r.right), y: Math.round(r.y) } }
    const r = b.getBoundingClientRect()
    return { row: { x: Math.round(r.x), r: Math.round(r.right), h: Math.round(r.height) }, main: g('[class*="main"]'), amount: g('[class*="amount"]'), detail: g('[class*="detail"]'), memo: g('[class*="memo"]'), over: b.scrollWidth > b.clientWidth }
  }))
  const same = (k, f) => new Set(cols.map((c) => (c[k] ? c[k][f] : 'none')).filter((v) => v !== 'none')).size <= 1
  if (label === 'desktop1280') {
    ok('[desktop1280] 날짜·종류 열(main)의 왼쪽 x가 모든 행에서 같음', same('main', 'x'), JSON.stringify(cols.map((c) => c.main)))
    ok('[desktop1280] 금액 열의 왼쪽·오른쪽 x가 모든 행에서 같음', same('amount', 'x') && same('amount', 'r'), JSON.stringify(cols.map((c) => c.amount)))
    ok('[desktop1280] 주행거리·주유량·연비(detail) 열의 왼쪽 x가 모든 행에서 같음', same('detail', 'x'), JSON.stringify(cols.map((c) => c.detail)))
    ok('[desktop1280] 열 폭: main 220px, amount 120px (행 안 위치 차이)', cols.every((c) => Math.abs(c.amount.x - c.main.x - 220) <= 16 && Math.abs(c.amount.r - c.amount.x - 120) <= 16), JSON.stringify(cols.map((c) => [c.main?.x, c.amount?.x, c.amount?.r])))
    ok('[desktop1280] 메모가 있는 행: 메모는 detail 열과 같은 x에서 시작하고 겹치지 않음', cols.filter((c) => c.memo).every((c) => c.memo.x === (c.detail?.x ?? c.memo.x) && (!c.detail || c.memo.y > c.detail.y)), JSON.stringify(cols.filter((c) => c.memo)))
    ok('[desktop1280] 어느 행도 내용이 넘치지 않음', cols.every((c) => !c.over))
  } else {
    ok('[mobile375] 행 내용이 넘치지 않고 금액이 오른쪽 끝에 정렬', cols.every((c) => !c.over && c.amount.r <= c.row.r), JSON.stringify(cols.map((c) => [c.row, c.amount])))
  }
  await ctx.close()
}
// 1023/1024 경계
for (const w of [1023, 1024]) {
  const { ctx, page } = await open(HARNESS, { width: w, height: 800 })
  const c = await page.evaluate(() => { const b = document.querySelector('ul li button'); const m = b.querySelector('[class*="main"]').getBoundingClientRect(), a = b.querySelector('[class*="amount"]').getBoundingClientRect(); return { dx: Math.round(a.x - m.x), over: b.scrollWidth > b.clientWidth } })
  ok(`[${w}px] 경계에서 가로 넘침 없음(열 간격 ${c.dx}px)`, !c.over && (await noHScroll(page)))
  await ctx.close()
}

// 겹친 창: 양식 위 삭제 확인창 / 주행거리 확인창
for (const [label, vp] of [['desktop1280', { width: 1280, height: 800 }], ['mobile375', { width: 375, height: 760 }]]) {
  const { ctx, page } = await open(HARNESS, vp, { touch: label === 'mobile375' })
  const firstRow = page.locator('ul li button').first()
  await firstRow.click(); await page.waitForTimeout(500)
  ok(`[${label}] 행을 누르면 "기록 수정" 양식이 열림`, (await dialogs(page)).join() === '기록 수정')
  // Tab 순환(양식 하나)
  let allIn = true; for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); allIn = allIn && (await inDialog(page, '기록 수정')) }
  ok(`[${label}] 양식에서 Tab 14번 눌러도 포커스가 양식 안에 머묾`, allIn)
  await page.keyboard.press('Shift+Tab'); ok(`[${label}] Shift+Tab도 양식 안`, await inDialog(page, '기록 수정'))
  await page.getByRole('dialog', { name: '기록 수정' }).getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(500)
  ok(`[${label}] 양식 위에 "삭제 확인"이 열려 둘이 겹침`, JSON.stringify((await dialogs(page)).sort()) === JSON.stringify(['기록 수정', '삭제 확인'].sort()), JSON.stringify(await dialogs(page)))
  ok(`[${label}] 확인창의 첫 포커스는 "취소"`, (await page.evaluate(() => document.activeElement?.textContent)) === '취소')
  await page.screenshot({ path: `${SHOTS}/mpr33-${label}-confirm-over-form.png` })
  let inConfirm = true; for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); inConfirm = inConfirm && (await inDialog(page, '삭제 확인')) }
  ok(`[${label}] 확인창에서 Tab 8번 눌러도 포커스가 확인창 안(아래 양식으로 새지 않음)`, inConfirm)
  await page.keyboard.press('Shift+Tab'); ok(`[${label}] 확인창에서 Shift+Tab도 확인창 안`, await inDialog(page, '삭제 확인'))
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  ok(`[${label}] Esc 한 번: 확인창만 닫히고 양식은 남음`, (await dialogs(page)).join() === '기록 수정', JSON.stringify(await dialogs(page)))
  ok(`[${label}] 확인창이 닫힌 뒤 포커스가 양식 안으로 돌아옴`, await inDialog(page, '기록 수정'))
  await page.keyboard.press('Escape'); await page.waitForTimeout(700)
  ok(`[${label}] Esc 두 번째: 양식이 닫히고 DOM에서 제거`, (await dialogs(page)).length === 0)
  ok(`[${label}] 양식이 닫힌 뒤 포커스가 눌렀던 행으로 돌아옴`, await page.evaluate(() => document.activeElement?.closest('li') !== null && document.activeElement?.tagName === 'BUTTON'))
  // 삭제 실행: 확인창에서 "삭제"
  await firstRow.click(); await page.waitForTimeout(500); await page.getByRole('dialog', { name: '기록 수정' }).getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(400)
  await page.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '삭제' }).click(); const t = await waitNoDialog(page)
  ok(`[${label}] 삭제 확인 → 확인창과 양식이 모두 DOM에서 제거(${t}ms)`, t >= 0 && (await page.locator('ul li button').count()) === 4, `t=${t}`)
  await page.waitForTimeout(1500)
  ok(`[${label}] 삭제 후(1.5초 뒤) 포커스가 body로 떨어지지 않고 목록 안 버튼에 있음(NFR-18, WCAG 2.4.3)`, await page.evaluate(() => document.activeElement !== document.body), '포커스가 body: 모바일 시트 퇴장(약 0.7초)이 복구 타이머 OVERLAY_EXIT_MS=350ms보다 길다')
  await ctx.close()
}
// 주행거리 확인창(MSG-10)
{
  const { ctx, page } = await open(HARNESS, { width: 1280, height: 800 })
  await page.getByRole('button', { name: '기록 추가' }).first().click(); await page.waitForTimeout(500)
  await page.getByLabel(/종류/).selectOption('other'); await page.getByLabel(/금액/).fill('1000'); await page.getByLabel(/주행거리/).fill('100')
  await page.getByRole('dialog', { name: '기록 추가' }).getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(500)
  ok('MSG-10: 양식 위에 "주행거리 확인"이 겹쳐 열리고 48,000km 문구', (await dialogs(page)).includes('주행거리 확인') && (await page.getByRole('dialog', { name: '주행거리 확인' }).innerText()).includes('48,000km'))
  await page.screenshot({ path: `${SHOTS}/mpr33-desktop1280-odometer-confirm.png` })
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  ok('MSG-10: Esc → 확인창만 닫히고 양식·입력값(100) 유지, 저장 안 됨', (await dialogs(page)).join() === '기록 추가' && (await page.getByLabel(/주행거리/).inputValue()) === '100' && (await page.locator('ul li button').count()) === 5)
  await page.getByRole('dialog', { name: '기록 추가' }).getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(400)
  await page.getByRole('dialog', { name: '주행거리 확인' }).getByRole('button', { name: '저장' }).click(); const t = await waitNoDialog(page)
  ok(`MSG-10: "저장" → 확인창과 양식이 모두 DOM에서 제거(${t}ms)하고 새 기록이 목록에 보임`, t >= 0 && (await page.locator('ul li button').count()) === 6, `t=${t} rows=${await page.locator('ul li button').count()}`)
  await ctx.close()
}
// 빈 상태
{
  const { ctx, page } = await open(HARNESS, { width: 375, height: 760 }, { query: '?empty=1' })
  ok('빈 상태: "기록이 없습니다"와 버튼 하나', (await page.getByText('기록이 없습니다').count()) === 1 && (await page.getByRole('button', { name: '기록 추가' }).count()) === 1)
  await page.screenshot({ path: `${SHOTS}/mpr33-mobile375-empty.png` }); await ctx.close()
}

// ───── 2. 실제 캘린더 앱: 공용 Overlay 회귀 ─────
const today = new Date(); const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const seed = JSON.stringify([{ id: 'rec1', title: '반복QA', allDay: true, start: ymd(today), end: ymd(today), recurrence: { freq: 'weekly', interval: 1, byWeekday: [today.getDay()] } }])
for (const [label, vp, touch] of [['desktop1280', { width: 1280, height: 800 }, false], ['mobile375', { width: 375, height: 760 }, true]]) {
  const { ctx, page } = await open(APP, vp, { touch, init: `localStorage.setItem('calendar.events', ${JSON.stringify(seed)})` })
  await page.waitForTimeout(500)
  const fab = page.getByRole('button', { name: /새 일정/ }).first()
  await fab.click(); await page.waitForTimeout(600)
  ok(`[앱 ${label}] 새 일정 편집창이 열림`, (await dialogs(page)).join() === '새 일정', JSON.stringify(await dialogs(page)))
  let allIn = true; for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); allIn = allIn && (await inDialog(page, '새 일정')) }
  ok(`[앱 ${label}] 편집창에서 Tab 16번 눌러도 포커스가 창 안에 머묾`, allIn)
  await page.keyboard.press('Shift+Tab'); ok(`[앱 ${label}] Shift+Tab도 창 안`, await inDialog(page, '새 일정'))
  await page.keyboard.press('Escape'); await page.waitForTimeout(700)
  ok(`[앱 ${label}] Esc로 편집창이 닫히고 DOM에서 제거`, (await dialogs(page)).length === 0)
  ok(`[앱 ${label}] 닫힌 뒤 포커스가 "새 일정" 버튼으로 돌아옴`, await page.evaluate(() => /새 일정/.test(document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '')))
  await ctx.close()
}
// 반복 일정 범위 창(드래그): 데스크톱 월 보기
{
  const { ctx, page } = await open(APP, { width: 1280, height: 800 }, { init: `localStorage.setItem('calendar.events', ${JSON.stringify(seed)})` })
  await page.waitForTimeout(600)
  const chip = page.getByText('반복QA').first()
  const has = (await chip.count()) > 0
  ok('[앱 desktop1280] 반복 일정(시드)이 월 보기에 보임', has)
  if (has) {
    const b = await chip.boundingBox(); let shown = false, names = []
    for (const dx of [150, -150, 180]) {
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 + dx / 2, b.y + b.height / 2 + 4, { steps: 6 }); await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + 4, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(700)
      names = await dialogs(page); if (names.includes('반복 일정 적용 범위')) { shown = true; break }
    }
    ok('[앱 desktop1280] 반복 일정을 끌어 옮기면 "반복 일정 적용 범위" 창이 열림', shown, JSON.stringify(names))
    if (shown) {
      await page.screenshot({ path: `${SHOTS}/mpr33-app-desktop1280-scope-dialog.png` })
      let allIn = true; for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); allIn = allIn && (await inDialog(page, '반복 일정 적용 범위')) }
      ok('[앱 desktop1280] 범위 창에서 Tab 8번 눌러도 포커스가 창 안', allIn)
      await page.keyboard.press('Escape'); await page.waitForTimeout(700)
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('calendar.events') || '[]'))
      ok('[앱 desktop1280] Esc → 범위 창 닫힘(DOM 제거), 일정은 바뀌지 않음', (await dialogs(page)).length === 0 && stored.length === 1 && stored[0].start === ymd(today) && !(stored[0].excludedDates?.length), JSON.stringify(stored))
    }
  }
  await ctx.close()
}
await browser.close()
console.log(`\nRESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
