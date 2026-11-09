// MPR-34 QA 임시 스크립트: 교체 알림 탭 harness를 375px·1280px로 열어 레이아웃(표 열 위치, 배지, 안내 문구, 반영 실패 버튼)·항목 양식 오류·교체 완료 창·겹친 확인창(Esc·Tab)·삭제 뒤 포커스를 확인한다.
// 실행: node docs/qa/scripts/mpr34_browser.mjs <playwright-core index.mjs> <harness 빌드 폴더> <스크린샷 폴더> (서버 없이 route로 파일을 내려준다)
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


const HINT = '참고용 값입니다. 차량 매뉴얼을 우선하세요'
const rowBtn = (p, name) => p.getByRole('button', { name: new RegExp(`^${name}.*수정$`) })
for (const [label, vp, touch] of [['mobile375', { width: 375, height: 760 }, true], ['desktop1280', { width: 1280, height: 800 }, false]]) {
  const { ctx, page } = await open(HARNESS, vp, { touch })
  ok(`[${label}] 항목 5건, 가로 스크롤 없음`, (await page.locator('ul li').count()) === 5 && (await noHScroll(page)))
  const hintY = await page.getByText(HINT).first().evaluate((e) => e.getBoundingClientRect().bottom), listY = await page.locator('ul').first().evaluate((e) => e.getBoundingClientRect().top)
  ok(`[${label}] 안내 문구(MSG-12)가 목록 위에 보이고 닫기 버튼 없음`, hintY <= listY && (await page.getByText(HINT).first().evaluate((e) => !e.closest('p').querySelector('button'))))
  ok(`[${label}] 지남·곧 교체 배지가 글자로 보임`, (await page.locator('ul').innerText()).includes('교체 시기 지남') && (await page.locator('ul').innerText()).includes('곧 교체'))
  ok(`[${label}] 반영 실패 행에 "캘린더 반영 실패, 다시 시도" 버튼 1개`, (await page.getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ }).count()) === 1)
  await page.screenshot({ path: `${SHOTS}/mpr34-${label}-list.png`, fullPage: true })
  if (label === 'desktop1280') {
    const cols = await page.evaluate(() => {
      const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.x) }
      const head = [...document.querySelectorAll('[class*="columns"] span')].map(rect)
      const rows = [...document.querySelectorAll('ul li')].map((li) => ({ cycle: rect(li.querySelector('[class*="_cycle_"]')), last: rect(li.querySelector('[class*="_last_"]')), next: rect(li.querySelector('[class*="_next_"]')), remaining: rect(li.querySelector('[class*="_remaining_"]')), over: li.scrollWidth > li.clientWidth }))
      return { head, rows }
    })
    const same = (k) => new Set(cols.rows.map((r) => r[k])).size === 1
    ok('[desktop1280] 표 머리(6칸)가 보이고 주기·마지막 교체·다음 교체일·남은 거리 칸의 x가 모든 행에서 같음', cols.head.length === 6 && ['cycle', 'last', 'next', 'remaining'].every(same), JSON.stringify(cols))
    ok('[desktop1280] 머리 칸의 x가 각 열의 칸 x와 4px 안에서 맞음(주기·마지막 교체·다음 교체일)', [1, 2, 3].every((i) => Math.abs(cols.head[i] - cols.rows[0][['cycle', 'last', 'next'][i - 1]]) <= 4), JSON.stringify(cols))
    ok('[desktop1280] 행 내용이 넘치지 않음(긴 이름 포함)', cols.rows.every((r) => !r.over))
  } else {
    const o = await page.evaluate(() => [...document.querySelectorAll('ul li')].some((li) => li.scrollWidth > li.clientWidth))
    ok('[mobile375] 카드 내용이 넘치지 않음(긴 이름 포함)', !o)
  }
  await ctx.close()
}
// 항목 추가 양식: 안내 문구 위치·입력 오류
for (const [label, vp, touch] of [['mobile375', { width: 375, height: 760 }, true], ['desktop1280', { width: 1280, height: 800 }, false]]) {
  const { ctx, page } = await open(HARNESS, vp, { touch })
  await page.getByRole('button', { name: '항목 추가' }).first().click(); await page.waitForTimeout(500)
  const d = page.getByRole('dialog', { name: '교체 항목 추가' })
  const hb = await d.getByText(HINT).boundingBox(), kb = await d.getByLabel('km 주기', { exact: true }).boundingBox()
  ok(`[${label}] 양식에서 안내 문구가 주기 입력 칸 위쪽에 겹치지 않고 보임`, !!hb && !!kb && hb.y + hb.height <= kb.y + 1, JSON.stringify({ hb, kb }))
  await d.getByLabel(/이름/).fill('점검'); await d.getByLabel('km 주기', { exact: true }).fill('0'); await d.getByLabel('개월 주기').fill('-1'); await d.getByLabel(/마지막 교체 주행거리/).fill('100')
  await d.getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(300)
  ok(`[${label}] km 0·개월 -1 → MSG-21 2개, 첫 오류 칸에 포커스, 가로 스크롤 없음`, (await d.getByText(/은\(는\) 1 이상의 정수로 입력해 주세요/).count()) === 2 && (await page.evaluate(() => document.activeElement?.getAttribute('name'))) === 'intervalKm' && (await noHScroll(page)))
  await page.screenshot({ path: `${SHOTS}/mpr34-${label}-form-errors.png` })
  await d.getByLabel('km 주기', { exact: true }).fill('1000000'); await d.getByLabel('개월 주기').fill(''); await d.getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(200)
  ok(`[${label}] km 1000000 → MSG-17`, (await d.getByText(/999,999 이하로 입력해 주세요/).count()) === 1)
  await ctx.close()
}
// 교체 완료 창, 반영 실패 재시도 포커스, 겹친 확인창, 삭제 뒤 포커스
for (const [label, vp, touch] of [['desktop1280', { width: 1280, height: 800 }, false], ['mobile375', { width: 375, height: 760 }, true]]) {
  const { ctx, page } = await open(HARNESS, vp, { touch })
  await page.getByRole('button', { name: '교체 완료, 엔진오일' }).click(); await page.waitForTimeout(500)
  const cd = page.getByRole('dialog', { name: '교체 완료' })
  ok(`[${label}] 교체 완료 창: 날짜 기본값이 채워져 있고 포커스가 날짜 칸`, (await cd.getByLabel(/마지막 교체일/).inputValue()).length === 10 && (await page.evaluate(() => document.activeElement?.getAttribute('name'))) === 'date')
  await page.screenshot({ path: `${SHOTS}/mpr34-${label}-complete.png` })
  await cd.getByLabel(/마지막 교체 주행거리/).fill(''); await cd.getByRole('button', { name: '확인' }).click(); await page.waitForTimeout(200)
  ok(`[${label}] km 항목 교체 완료에서 주행거리를 비우면 MSG-19`, (await cd.getByText('마지막 교체 주행거리를 입력해 주세요').count()) === 1)
  await page.keyboard.press('Escape'); await page.waitForTimeout(700)
  ok(`[${label}] Esc로 교체 완료 창이 닫히고 DOM에서 제거, 포커스가 눌렀던 버튼`, (await dialogs(page)).length === 0 && (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === '교체 완료, 엔진오일')
  const retry = page.getByRole('button', { name: /캘린더 반영 실패, 다시 시도/ }); await retry.focus(); await retry.click(); await page.waitForTimeout(500)
  ok(`[${label}] 재시도 성공 → 버튼 사라지고 포커스가 같은 행의 "교체 완료"로`, (await retry.count()) === 0 && (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === '교체 완료, 엔진오일')
  await rowBtn(page, '와이퍼').click(); await page.waitForTimeout(500)
  ok(`[${label}] 행 이름을 누르면 "교체 항목 수정" 양식`, (await dialogs(page)).join() === '교체 항목 수정')
  await page.getByRole('dialog', { name: '교체 항목 수정' }).getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(500)
  ok(`[${label}] 양식 위 "삭제 확인"이 겹치고 첫 포커스는 "취소"`, JSON.stringify((await dialogs(page)).sort()) === JSON.stringify(['교체 항목 수정', '삭제 확인'].sort()) && (await page.evaluate(() => document.activeElement?.textContent)) === '취소')
  await page.screenshot({ path: `${SHOTS}/mpr34-${label}-confirm-over-form.png` })
  let inC = true; for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); inC = inC && (await inDialog(page, '삭제 확인')) }
  ok(`[${label}] 확인창에서 Tab 8번 눌러도 확인창 안`, inC)
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  ok(`[${label}] Esc 한 번: 확인창만 닫히고 양식 남음`, (await dialogs(page)).join() === '교체 항목 수정')
  await page.getByRole('dialog', { name: '교체 항목 수정' }).getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(400)
  await page.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '삭제' }).click(); const t = await waitNoDialog(page)
  ok(`[${label}] 삭제 확인 → 확인창·양식이 DOM에서 제거(${t}ms)하고 항목 4건`, t >= 0 && (await page.locator('ul li').count()) === 4)
  await page.waitForTimeout(1500)
  ok(`[${label}] 삭제 후(1.5초 뒤) 포커스가 body로 떨어지지 않음(NFR-18, WCAG 2.4.3)`, await page.evaluate(() => document.activeElement !== document.body), '포커스가 body: 모바일 시트 퇴장이 복구 타이머 OVERLAY_EXIT_MS=350ms보다 길다')
  await ctx.close()
}
// 빈 상태
{
  const { ctx, page } = await open(HARNESS, { width: 375, height: 760 }, { query: '?empty=1' })
  ok('빈 상태: 안내 문구와 "교체 항목이 없습니다", "항목 추가" 버튼 하나', (await page.getByText(HINT).count()) === 1 && (await page.getByText('교체 항목이 없습니다').count()) === 1 && (await page.getByRole('button', { name: '항목 추가' }).count()) === 1)
  await page.screenshot({ path: `${SHOTS}/mpr34-mobile375-empty.png` }); await ctx.close()
}
await browser.close()
console.log(`\nRESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
