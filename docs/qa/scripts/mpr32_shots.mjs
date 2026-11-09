// MPR-32 QA 임시 스크립트: 차량 영역(빈 상태·카드·추가 양식 오류·삭제 확인창)을 375px·1280px로 열어 레이아웃·포커스·대화상자 동작을 확인하고 스크린샷을 남긴다.
// 실행: node docs/qa/scripts/mpr32_shots.mjs <playwright-core index.mjs> <harness 빌드 폴더> <스크린샷 폴더> (서버 없이 Playwright route로 파일을 내려준다)
import { pathToFileURL } from 'node:url'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const [, , pwPath, DIST, SHOTS] = process.argv
const { chromium } = await import(pathToFileURL(pwPath).href)
mkdirSync(SHOTS, { recursive: true })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`) }
const ORIGIN = 'http://qa.local'

async function open(vp, query = '') {
  const ctx = await browser.newContext({ viewport: vp })
  await ctx.route(`${ORIGIN}/**`, (r) => { const p = new URL(r.request().url()).pathname; const f = join(DIST, p === '/' ? 'index.html' : p); return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: types[extname(f)] ?? 'application/octet-stream' }) : r.fulfill({ status: 404 }) })
  await ctx.route((u) => u.origin !== ORIGIN, (r) => r.abort()) // 외부(웹폰트 CDN) 요청 차단: 오프라인 측정
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/${query}`); await page.waitForSelector('section[aria-label="차량 영역"]'); await page.waitForTimeout(300)
  return { ctx, page }
}
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
const inView = (p, sel) => p.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight })

for (const [label, vp] of [['mobile375', { width: 375, height: 760 }], ['desktop1280', { width: 1280, height: 800 }]]) {
  // 카드
  { const { ctx, page } = await open(vp)
    ok(`[${label}] 차량 카드: 선택 상자·카드·번호판·주행거리 표시, 가로 스크롤 없음`, (await page.getByText('12가3456').count()) === 1 && (await page.getByText('48,000 km').count()) === 1 && (await noHScroll(page)))
    await page.screenshot({ path: `${SHOTS}/mpr32-${label}-card.png` })
    await page.getByRole('combobox').selectOption('b'); ok(`[${label}] 선택 상자 '가족' → 카드가 가족 정보`, (await page.getByText('카니발 · 2022').count()) === 1 && (await page.getByText('12가3456').count()) === 0)
    await ctx.close() }
  // 빈 상태
  { const { ctx, page } = await open(vp, '?empty=1')
    ok(`[${label}] 빈 상태: "차량을 추가해 주세요"와 "차량 추가" 버튼`, (await page.getByText('차량을 추가해 주세요').count()) === 1 && (await page.getByRole('button', { name: '차량 추가' }).count()) === 1)
    await page.screenshot({ path: `${SHOTS}/mpr32-${label}-empty.png` }); await ctx.close() }
  // 추가 양식: 입력 오류
  { const { ctx, page } = await open(vp)
    await page.getByRole('button', { name: '차량 추가' }).click(); await page.waitForTimeout(300)
    ok(`[${label}] 추가 양식이 열리고 포커스가 "별칭" 칸`, (await page.getByRole('dialog', { name: '차량 추가' }).count()) === 1 && (await page.evaluate(() => document.activeElement?.getAttribute('name'))) === 'name')
    await page.getByLabel('연식').fill('1949'); await page.getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(200)
    ok(`[${label}] 별칭 비움·연식 1949 → 칸 아래 MSG-05·MSG-08, 첫 오류 칸(별칭)에 포커스`, (await page.getByText('별칭을(를) 입력해 주세요').count()) === 1 && (await page.getByText(/연식은 1950부터/).count()) === 1 && (await page.evaluate(() => document.activeElement?.getAttribute('name'))) === 'name')
    ok(`[${label}] 양식이 화면 안에 들어오고 저장·취소 버튼이 보임, 가로 스크롤 없음`, (await inView(page, 'dialog, [role="dialog"]')) && (await page.getByRole('button', { name: '저장' }).isVisible()) && (await noHScroll(page)))
    await page.screenshot({ path: `${SHOTS}/mpr32-${label}-form-errors.png` })
    await page.keyboard.press('Escape'); await page.waitForTimeout(400); ok(`[${label}] Esc로 양식 닫힘, 포커스가 "차량 추가" 버튼으로 복귀`, (await page.getByRole('dialog').count()) === 0 && (await page.evaluate(() => document.activeElement?.textContent)) === '차량 추가')
    await ctx.close() }
  // 저장 실패: 입력값 유지(앱에서는 토스트는 훅 몫)
  { const { ctx, page } = await open(vp, '?fail=1')
    await page.getByRole('button', { name: '차량 추가' }).click(); await page.getByLabel(/별칭/).fill('새차'); await page.getByLabel('번호판').fill('99가9999'); await page.getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(400)
    ok(`[${label}] 저장 실패: 양식이 열린 채 입력값 유지, 저장 버튼 다시 활성`, (await page.getByRole('dialog').count()) === 1 && (await page.getByLabel(/별칭/).inputValue()) === '새차' && (await page.getByLabel('번호판').inputValue()) === '99가9999' && (await page.getByRole('button', { name: '저장' }).isEnabled()))
    await ctx.close() }
  // 삭제 확인창
  { const { ctx, page } = await open(vp)
    await page.getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(300)
    const dlg = page.getByRole('dialog', { name: '삭제 확인' })
    ok(`[${label}] 삭제 확인창: 차량 이름 문구와 MSG-14, 포커스가 "취소"`, (await dlg.getByText('차량 출퇴근을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다').count()) === 1 && (await dlg.getByText('이 차량의 기록, 교체 항목, 만기일, 캘린더 일정이 모두 삭제됩니다').count()) === 1 && (await page.evaluate(() => document.activeElement?.textContent)) === '취소')
    ok(`[${label}] 확인창이 화면 안에 있고 가로 스크롤 없음`, (await inView(page, '[role="dialog"]')) && (await noHScroll(page)))
    await page.screenshot({ path: `${SHOTS}/mpr32-${label}-confirm.png` })
    await page.keyboard.press('Escape'); await page.waitForTimeout(400); ok(`[${label}] Esc 취소: 창 닫힘, 차량 그대로`, (await page.getByRole('dialog').count()) === 0 && (await page.getByRole('option').count()) === 2)
    await page.getByRole('button', { name: '삭제' }).click(); await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(500)
    ok(`[${label}] "삭제" 확인: 첫째 차량 삭제되고 둘째(가족)가 선택됨`, (await page.getByRole('dialog').count()) === 0 && (await page.getByRole('option').count()) === 1 && (await page.getByRole('combobox').inputValue()) === 'b')
    await ctx.close() }
}
await browser.close()
console.log(`\nRESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
