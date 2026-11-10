// MPR-46 QA 임시 스크립트: 375x760 터치에서 삭제 확인 직후 2.5초 동안 activeElement를 20ms마다 표집해 포커스가 body에 머문 시간과 최종 위치를 잰다(기록·교체 항목·만기일). 취소 경로(확인창 취소→양식 안, 양식 닫기→눌렀던 행)도 확인한다.
// 실행: node docs/qa/scripts/mpr46_focus.mjs <playwright-core index.mjs> <h33 폴더> <h34 폴더> <h35 폴더>
import { pathToFileURL } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
const [, , pwPath, H33, H34, H35] = process.argv
const { chromium } = await import(pathToFileURL(pwPath).href)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' :: ' + x}`) }
async function open(dir, vp, touch) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch })
  await ctx.route('http://qa.local/**', (r) => { const p = new URL(r.request().url()).pathname; const f = join(dir, p === '/' ? 'index.html' : p); return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: types[extname(f)] || 'application/octet-stream' }) : r.abort() })
  await ctx.route((u) => u.origin !== 'http://qa.local', (r) => r.abort())
  const page = await ctx.newPage(); await page.goto('http://qa.local/'); await page.waitForTimeout(700); return { ctx, page }
}
// 클릭 직후부터 2.5초간 20ms마다 activeElement 서술을 모은다
const probe = (page) => page.evaluate(() => new Promise((res) => { const t0 = performance.now(), trail = []; const d = () => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 24) }; const id = setInterval(() => { trail.push([Math.round(performance.now() - t0), d()]); if (performance.now() - t0 > 2500) { clearInterval(id); res(trail) } }, 20) }))
const summarize = (trail) => { const body = trail.filter((x) => x[1] === 'BODY'); return { bodyMs: body.length * 20, last: trail.at(-1)[1], firstBodyAt: body[0]?.[0], lastBodyAt: body.at(-1)?.[0] } }
const flows = {
  records: { dir: H33, open: async (p) => { await p.locator('ul li button').first().click(); await p.waitForTimeout(500) }, form: '기록 수정', delBtn: { name: '삭제' }, count: async (p) => p.locator('ul li button').count(), before: 5 },
  maintenance: { dir: H34, open: async (p) => { await p.getByRole('button', { name: /^와이퍼.*수정$/ }).click(); await p.waitForTimeout(500) }, form: '교체 항목 수정', count: async (p) => p.locator('ul li').count(), before: 5 },
}
for (const [name, f] of Object.entries(flows)) {
  for (const [label, vp, touch] of [['mobile375', { width: 375, height: 760 }, true], ['desktop1280', { width: 1280, height: 800 }, false]]) {
    // 삭제 확정
    let { ctx, page } = await open(f.dir, vp, touch)
    await f.open(page); await page.getByRole('dialog', { name: f.form }).getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(400)
    const del = page.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '삭제' })
    const pr = probe(page); await del.click(); const s = summarize(await pr)
    ok(`[${name} ${label}] 삭제 확정 뒤 최종 포커스가 body가 아님(최종 "${s.last}")`, s.last !== 'BODY')
    console.log(`  · body에 머문 시간 ${s.bodyMs}ms (처음 ${s.firstBodyAt}ms, 마지막 ${s.lastBodyAt}ms)`)
    ok(`[${name} ${label}] 항목이 하나 줄어듦`, (await f.count(page)) === f.before - 1)
    await ctx.close()
    // 확인창 취소 → 양식 안 버튼, 양식 닫기(Esc) → 눌렀던 행
    ;({ ctx, page } = await open(f.dir, vp, touch))
    await f.open(page); await page.getByRole('dialog', { name: f.form }).getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(400)
    await page.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '취소' }).click(); await page.waitForTimeout(1000)
    ok(`[${name} ${label}] 확인창 취소 → 포커스가 양식 안("삭제" 버튼)`, await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.contains(document.activeElement) && document.activeElement.textContent.trim() === '삭제' }))
    await page.keyboard.press('Escape'); await page.waitForTimeout(1500)
    ok(`[${name} ${label}] 양식을 Esc로 닫으면 포커스가 눌렀던 행(목록의 첫 버튼으로 새지 않음)`, await page.evaluate(() => { const a = document.activeElement; return a !== document.body && !!a.closest('li') }))
    await ctx.close()
  }
}
// 만기일: 정기검사 삭제
for (const [label, vp, touch] of [['mobile375', { width: 375, height: 760 }, true], ['desktop1280', { width: 1280, height: 800 }, false]]) {
  const { ctx, page } = await open(H35, vp, touch)
  await page.locator('li', { hasText: '정기검사' }).first().getByRole('button', { name: '삭제' }).click(); await page.waitForTimeout(500)
  const pr = probe(page); await page.getByRole('dialog', { name: '삭제 확인' }).getByRole('button', { name: '삭제' }).click(); const s = summarize(await pr)
  ok(`[dueDates ${label}] 삭제 확정 뒤 최종 포커스가 body가 아님(최종 "${s.last}")`, s.last !== 'BODY')
  console.log(`  · body에 머문 시간 ${s.bodyMs}ms (처음 ${s.firstBodyAt}ms, 마지막 ${s.lastBodyAt}ms)`)
  await ctx.close()
}
await browser.close(); console.log(`\nRESULT pass=${pass} fail=${fail}`); process.exit(fail ? 1 : 0)
