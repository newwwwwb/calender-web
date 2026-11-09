// MPR-35·36 QA 임시 스크립트: 만기일 탭 harness를 375px·1280px로 열어 레이아웃·자동차세 빠른 선택(실제 Chrome 날짜 칸)·날짜 오류·Esc·Tab·재시도 포커스·삭제 뒤 포커스를 확인한다.
// 실행: node docs/qa/scripts/mpr35_browser.mjs <playwright-core index.mjs> <harness 빌드 폴더> <스크린샷 폴더> (서버 없이 route로 파일을 내려준다)
import { pathToFileURL } from 'node:url'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const [, , pwPath, HARNESS, SHOTS] = process.argv
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


const rowOf = (p, label) => p.locator('li', { hasText: label }).first()
// 목록 레이아웃
for (const [label, vp, touch] of [['mobile375', { width: 375, height: 760 }, true], ['desktop1280', { width: 1280, height: 800 }, false]]) {
  const { ctx, page } = await open(HARNESS, vp, { touch })
  ok(`[${label}] 세 행 고정, 가로 스크롤 없음`, (await page.locator('ul li').count()) === 3 && (await noHScroll(page)))
  ok(`[${label}] 값 없는 행은 "날짜 없음"+"입력"만, 값 있는 행은 "수정"·"삭제"만`, (await rowOf(page, '자동차세 납부').innerText()).includes('날짜 없음') && (await rowOf(page, '자동차세 납부').getByRole('button').allInnerTexts()).join() === '입력' && (await rowOf(page, '정기검사').getByRole('button').allInnerTexts()).join() === '수정,삭제')
  ok(`[${label}] 반영 실패 행(보험 만기)에만 "캘린더 반영 실패, 다시 시도" 버튼`, (await page.getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ }).count()) === 1 && (await rowOf(page, '보험 만기').getByRole('button', { name: /캘린더 반영 실패/ }).count()) === 1)
  ok(`[${label}] 행 내용이 넘치지 않음`, !(await page.evaluate(() => [...document.querySelectorAll('ul li')].some((li) => li.scrollWidth > li.clientWidth))))
  if (label === 'desktop1280') {
    const xs = await page.evaluate(() => [...document.querySelectorAll('ul li')].map((li) => { const k = li.querySelector('span'), a = li.querySelector('[class*="_actions_"]'); return [Math.round(k.getBoundingClientRect().x), a ? Math.round(a.getBoundingClientRect().right) : null] }))
    ok('[desktop1280] 종류 칸의 x와 버튼 묶음의 오른쪽 끝이 세 행에서 같음', new Set(xs.map((x) => x[0])).size === 1 && new Set(xs.map((x) => x[1])).size === 1, JSON.stringify(xs))
  }
  await page.screenshot({ path: `${SHOTS}/mpr35-${label}-list.png`, fullPage: true })
  await ctx.close()
}
// 자동차세 빠른 선택, 날짜 오류
for (const [label, vp, touch] of [['mobile375', { width: 375, height: 760 }, true], ['desktop1280', { width: 1280, height: 800 }, false]]) {
  const { ctx, page } = await open(HARNESS, vp, { touch })
  await rowOf(page, '자동차세 납부').getByRole('button', { name: '입력' }).click(); await page.waitForTimeout(500)
  const d = page.getByRole('dialog', { name: '자동차세 납부 만기일 입력' })
  ok(`[${label}] 빠른 선택 "6월 30일"·"12월 31일" 버튼이 날짜 칸 아래에 보이고 터치 크기 44px 이상`, (await d.getByRole('button', { name: '6월 30일' }).isVisible()) && (await d.getByRole('button', { name: '12월 31일' }).isVisible()) && (await d.getByRole('button', { name: '12월 31일' }).evaluate((e) => e.getBoundingClientRect().height)) >= (touch ? 44 : 32))
  const y = new Date(); const ymd = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  await d.getByRole('button', { name: '12월 31일' }).click()
  const v1 = await d.getByLabel('만기일 (필수)').inputValue(); const wantDec = `${y.getFullYear()}-12-31`
  await d.getByRole('button', { name: '6월 30일' }).click(); const v2 = await d.getByLabel('만기일 (필수)').inputValue(); const jun = new Date(y.getFullYear(), 5, 30); const wantJun = `${ymd(y) > `${y.getFullYear()}-06-30` ? y.getFullYear() + 1 : y.getFullYear()}-06-30`
  ok(`[${label}] 실제 Chrome에서 빠른 선택: 12월 31일 → ${v1}(기대 ${wantDec}), 6월 30일 → ${v2}(기대 ${wantJun})`, v1 === wantDec && v2 === wantJun)
  await page.screenshot({ path: `${SHOTS}/mpr35-${label}-carTax-form.png` })
  await page.keyboard.press('Escape'); await page.waitForTimeout(700)
  ok(`[${label}] 저장하지 않고 Esc로 닫으면 "날짜 없음" 그대로`, (await dialogs(page)).length === 0 && (await rowOf(page, '자동차세 납부').innerText()).includes('날짜 없음'))
  // 보험 양식엔 빠른 선택 없음
  await rowOf(page, '보험 만기').getByRole('button', { name: '수정' }).click(); await page.waitForTimeout(500)
  ok(`[${label}] 보험 만기 수정 양식에는 빠른 선택이 없고 기존 값(2027-03-10)이 채워짐`, (await page.getByRole('button', { name: '12월 31일' }).count()) === 0 && (await page.getByLabel('만기일 (필수)').inputValue()) === '2027-03-10')
  // 비우고 저장 → 오류
  await page.getByLabel('만기일 (필수)').fill(''); await page.getByRole('dialog').getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(300)
  ok(`[${label}] 날짜를 비우고 저장 → 칸 아래 오류와 오류 칸 포커스, 양식 유지`, (await page.getByRole('dialog').getByText(/입력해 주세요/).count()) === 1 && (await page.evaluate(() => document.activeElement?.getAttribute('name'))) === 'dueDate')
  await page.screenshot({ path: `${SHOTS}/mpr35-${label}-form-error.png` })
  // 존재하지 않는 날짜 2027-02-30을 손으로 입력(월·일·연 칸에 타이핑)
  await page.getByLabel('만기일 (필수)').focus(); await page.keyboard.type('02302027'); const typed = await page.getByLabel('만기일 (필수)').inputValue()
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(300)
  const msg = await page.getByRole('dialog').locator('p[id$="-error"]').allInnerTexts()
  ok(`[${label}] 2027-02-30을 입력하면(칸 값 "${typed}") 저장 요청 없이 오류(${msg.join('|')})가 보이고 양식 유지`, (await dialogs(page)).length === 1 && msg.length === 1 && /입력해 주세요|올바른 날짜/.test(msg[0]))
  await ctx.close()
}
// 키보드·겹침 없음·삭제 뒤 포커스·재시도 포커스
for (const [label, vp, touch] of [['desktop1280', { width: 1280, height: 800 }, false], ['mobile375', { width: 375, height: 760 }, true]]) {
  const { ctx, page } = await open(HARNESS, vp, { touch })
  await rowOf(page, '자동차세 납부').getByRole('button', { name: '입력' }).click(); await page.waitForTimeout(500)
  let allIn = true; for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); allIn = allIn && (await inDialog(page, '자동차세 납부 만기일 입력')) }
  ok(`[${label}] 양식에서 Tab 12번 눌러도 포커스가 양식 안`, allIn)
  await page.keyboard.press('Escape'); await page.waitForTimeout(700)
  ok(`[${label}] Esc로 양식이 닫히고 DOM에서 제거, 포커스가 눌렀던 "입력"으로`, (await dialogs(page)).length === 0 && (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === '자동차세 납부 입력')
  const retry = page.getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ }); await retry.focus(); await retry.click(); await page.waitForTimeout(500)
  ok(`[${label}] 재시도 성공 → 버튼 사라지고 포커스가 같은 행의 버튼으로`, (await retry.count()) === 0 && (await page.evaluate(() => !!document.activeElement?.closest('li')?.textContent?.includes('보험 만기'))))
  // 삭제
  await rowOf(page, '정기검사').getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(500)
  ok(`[${label}] 삭제 확인창: 첫 포커스 "취소", 문구 "만기일(정기검사)"`, (await page.evaluate(() => document.activeElement?.textContent)) === '취소' && (await page.getByRole('dialog', { name: '삭제 확인' }).innerText()).includes('만기일(정기검사)'))
  await page.screenshot({ path: `${SHOTS}/mpr35-${label}-confirm.png` })
  let inC = true; for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); inC = inC && (await inDialog(page, '삭제 확인')) }
  ok(`[${label}] 확인창에서 Tab 6번 눌러도 확인창 안`, inC)
  await page.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '삭제' }).click(); const t = await waitNoDialog(page)
  ok(`[${label}] 삭제 확인 → 확인창이 DOM에서 제거(${t}ms), 정기검사 행이 "날짜 없음"·"입력"`, t >= 0 && (await rowOf(page, '정기검사').innerText()).includes('날짜 없음') && (await rowOf(page, '정기검사').getByRole('button').allInnerTexts()).join() === '입력')
  await page.waitForTimeout(1500)
  ok(`[${label}] 삭제 후(1.5초 뒤) 포커스가 body로 떨어지지 않음(NFR-18, WCAG 2.4.3)`, await page.evaluate(() => document.activeElement !== document.body), '포커스가 body: 복구 타이머 OVERLAY_EXIT_MS=350ms가 모바일 시트 퇴장보다 짧다(DueDatesTab도 같은 구조)')
  await ctx.close()
}
// 빈 상태
{
  const { ctx, page } = await open(HARNESS, { width: 375, height: 760 }, { query: '?empty=1' })
  ok('만기일이 없는 차량: 세 행 모두 "날짜 없음", 날짜 문자열 없음', (await page.getByText('날짜 없음').count()) === 3 && !/\d{4}-\d{2}-\d{2}/.test(await page.locator('ul').innerText()))
  await page.screenshot({ path: `${SHOTS}/mpr35-mobile375-empty.png` }); await ctx.close()
}
await browser.close()
console.log(`\nRESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
