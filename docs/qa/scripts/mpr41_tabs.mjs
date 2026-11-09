// MPR-41 QA 임시 스크립트: navigate 중복 기록 방지, 현재 탭 포커스 때 막대 유지, 강제색(밝은·어두운 팔레트) 구분, 캘린더 배치 불변(AC-14-4)을 Playwright로 확인한다.
// 실행: node docs/qa/scripts/mpr41_tabs.mjs <playwright-core index.mjs> <현재 URL> <탭 없던 때(ec21359) URL> <스크린샷 폴더>
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const [, , pwPath, NOW, NOTABS, SHOTS] = process.argv
const { chromium } = await import(pathToFileURL(pwPath).href)
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`) }
const VPS = [['mobile375', { width: 375, height: 760 }], ['desktop1280', { width: 1280, height: 800 }]]

async function open(url, vp, media) {
  const ctx = await browser.newContext({ viewport: vp })
  await ctx.addInitScript(() => { window.__push = 0; const o = history.pushState.bind(history); history.pushState = (...a) => { window.__push++; return o(...a) } })
  const page = await ctx.newPage(); if (media) await page.emulateMedia(media)
  await page.goto(url); await page.waitForSelector('nav[aria-label="화면 전환"], h1', { state: 'attached' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400)
  return { ctx, page }
}
const tab = (p, name) => p.locator('nav[aria-label="화면 전환"] a', { hasText: name })
const state = (p) => p.evaluate(() => ({ path: location.pathname, push: window.__push, len: history.length }))

// 1) navigate: 같은 화면이면 기록을 쌓지 않는다
for (const [label, vp] of VPS) {
  for (const [start, clickName, wantPush, wantPath, why] of [
    ['/car/', '차계부', 0, '/car/', '/car/에서 차계부 탭(BR-01: 같은 화면)'],
    ['/car', '차계부', 0, '/car', '/car에서 차계부 탭'],
    ['/', '캘린더', 0, '/', '/에서 캘린더 탭'],
    ['/car/', '캘린더', 1, '/', '/car/에서 캘린더 탭(다른 화면)'],
    ['/car', '캘린더', 1, '/', '/car에서 캘린더 탭'],
    ['/', '차계부', 1, '/car', '/에서 차계부 탭'],
  ]) {
    const { ctx, page } = await open(NOW + start, vp); const before = await state(page)
    await tab(page, clickName).click(); await page.waitForTimeout(300)
    const after = await state(page)
    ok(`[${label}] ${why}: pushState ${wantPush}회, 주소 ${wantPath}, history.length 증가 ${wantPush}`, after.push === wantPush && after.path === wantPath && after.len - before.len === wantPush, JSON.stringify({ before, after }))
    await ctx.close()
  }
  // 연속 클릭·왕복
  const { ctx, page } = await open(NOW + '/car/', vp); const b = await state(page)
  for (let i = 0; i < 3; i++) await tab(page, '차계부').click()
  const s1 = await state(page)
  ok(`[${label}] /car/에서 차계부 탭 3번 연속 클릭: 기록 0건, 주소 그대로`, s1.push === 0 && s1.len === b.len && s1.path === '/car/', JSON.stringify(s1))
  await tab(page, '캘린더').click(); await tab(page, '차계부').click(); await page.waitForTimeout(200)
  await page.goBack(); await page.waitForTimeout(200)
  ok(`[${label}] 캘린더→차계부 뒤 뒤로 가기: /로 돌아가고 차계부 화면이 사라짐`, (await state(page)).path === '/' && (await tab(page, '캘린더').getAttribute('aria-current')) === 'page')
  await page.goBack(); await page.waitForTimeout(200)
  ok(`[${label}] 한 번 더 뒤로: 원래 /car/(탭 클릭 3번이 기록을 안 쌓았으므로 그 앞은 시작 주소)`, ['/car/', '/car'].includes((await state(page)).path), JSON.stringify(await state(page)))
  await ctx.close()
}
// 알 수 없는 경로(캘린더 화면)에서의 동작 기록(스펙 BR-01: 알 수 없는 경로는 캘린더). 판정 보조 정보
{
  const { ctx, page } = await open(NOW + '/zzz', { width: 375, height: 760 }); const b = await state(page)
  await tab(page, '캘린더').click(); await page.waitForTimeout(200); const a = await state(page)
  console.log(`INFO 알 수 없는 경로 /zzz에서 캘린더 탭: pushState ${a.push - b.push}회, 주소 ${a.path}(캘린더 화면이 이미 보이는 상태)`)
  await ctx.close()
}

// 2) 현재 탭 포커스: 왼쪽 막대와 외곽선이 함께 보인다
const read = (p, name) => tab(p, name).evaluate((a) => { const c = getComputedStyle(a); const l = getComputedStyle(a.querySelector('span')); const r = a.getBoundingClientRect(); return { bl: [c.borderLeftWidth, c.borderLeftStyle, c.borderLeftColor].join(' '), bg: c.backgroundColor, color: c.color, shadow: c.boxShadow, outline: [c.outlineWidth, c.outlineStyle, c.outlineColor].join(' '), outlineOffset: c.outlineOffset, weight: c.fontWeight, label: l.color, w: r.width, h: r.height, x: r.x } })
for (const [label, vp] of VPS) {
  for (const route of ['/', '/car']) {
    const cur = route === '/car' ? '차계부' : '캘린더', other = route === '/car' ? '캘린더' : '차계부'
    const { ctx, page } = await open(NOW + route, vp)
    const idle = await read(page, cur), idleOther = await read(page, other)
    await page.keyboard.press('Tab'); await tab(page, cur).focus()
    ok(`[${label}] ${route} 현재 탭(${cur}) 포커스는 키보드 포커스로 잡힘(:focus-visible)`, await tab(page, cur).evaluate((a) => a.matches(':focus-visible')))
    const foc = await read(page, cur)
    ok(`[${label}] ${route} 현재 탭 평상시 왼쪽 막대 4px solid(${idle.bl})`, /^4px solid /.test(idle.bl) && idle.bl.split(' ').slice(2).join(' ') !== 'rgba(0, 0, 0, 0)', idle.bl)
    ok(`[${label}] ${route} 현재 탭 포커스 때도 왼쪽 막대 그대로(${foc.bl})`, foc.bl === idle.bl, `${idle.bl} -> ${foc.bl}`)
    ok(`[${label}] ${route} 현재 탭 포커스 때 외곽선도 함께 보임(${foc.outline})`, /^2px solid /.test(foc.outline) && !/rgba\(0, 0, 0, 0\)/.test(foc.outline), foc.outline)
    ok(`[${label}] ${route} 현재 탭 포커스 때 면·글자 굵기 유지, 크기 그대로(${Math.round(foc.w)}×${Math.round(foc.h)})`, foc.bg === idle.bg && foc.weight === idle.weight && foc.w === idle.w && foc.h === idle.h, JSON.stringify({ idle, foc }))
    ok(`[${label}] ${route} 현재 탭과 비선택 탭이 구분됨(면 색, 굵기, 막대 폭)`, idle.bg !== idleOther.bg && idle.weight !== idleOther.weight && idle.bl !== idleOther.bl, JSON.stringify({ idle, idleOther }))
    ok(`[${label}] ${route} 현재·비선택 탭의 크기 같음(막대가 테두리여도 탭 상자는 안 커짐)`, idle.w === idleOther.w && idle.h === idleOther.h, `${idle.w}x${idle.h} vs ${idleOther.w}x${idleOther.h}`)
    // 비선택 탭 포커스: 외곽선 보이고 막대 없음
    await tab(page, other).focus(); const fo = await read(page, other)
    ok(`[${label}] ${route} 비선택 탭 포커스: 외곽선 2px, 막대 없음(1px 테두리)`, /^2px solid /.test(fo.outline) && /^1px /.test(fo.bl), JSON.stringify(fo))
    await tab(page, cur).focus(); await page.screenshot({ path: `${SHOTS}/mpr41-${label}-${route === '/' ? 'calendar' : 'car'}-focus-current.png`, clip: { x: vp.width - 120, y: 0, width: 120, height: vp.height } })
    await ctx.close()
  }
}

// 3) 강제색: 두 팔레트(밝은·어두운)
for (const [label, vp] of VPS) {
  for (const scheme of ['light', 'dark']) {
    for (const route of ['/', '/car']) {
      const cur = route === '/car' ? '차계부' : '캘린더', other = route === '/car' ? '캘린더' : '차계부'
      const { ctx, page } = await open(NOW + route, vp, { forcedColors: 'active', colorScheme: scheme })
      ok(`[${label}/${scheme}] ${route} 강제색 모드가 켜짐(emulation)`, await page.evaluate(() => matchMedia('(forced-colors: active)').matches))
      const c = await read(page, cur), o = await read(page, other)
      ok(`[${label}/${scheme}] ${route} 현재 탭 면(Highlight)이 비선택 탭 면(Canvas)과 다름: ${c.bg} vs ${o.bg}`, c.bg !== o.bg)
      ok(`[${label}/${scheme}] ${route} 현재 탭 글자색이 면과 다름(읽힘): 글자 ${c.color}, 면 ${c.bg}, 라벨 ${c.label}`, c.color !== c.bg && c.label === c.color, JSON.stringify(c))
      ok(`[${label}/${scheme}] ${route} 비선택 탭 글자색이 면과 다름: ${o.color} / ${o.bg}`, o.color !== o.bg && o.label === o.color)
      ok(`[${label}/${scheme}] ${route} 현재 탭 왼쪽 막대 4px가 있음(${c.bl}), 비선택은 1px(${o.bl})`, /^4px solid /.test(c.bl) && /^1px solid /.test(o.bl))
      await page.keyboard.press('Tab'); await tab(page, cur).focus(); const cf = await read(page, cur)
      ok(`[${label}/${scheme}] ${route} 현재 탭 포커스 링 2px solid, 색(${cf.outline})이 현재 탭 면(${cf.bg})과 다름`, /^2px solid /.test(cf.outline) && cf.outline.split(' ').slice(2).join(' ') !== cf.bg, cf.outline + ' / ' + cf.bg)
      ok(`[${label}/${scheme}] ${route} 현재 탭 포커스 링이 면 안쪽(오프셋 ${cf.outlineOffset} < 0), 포커스 때도 막대 유지(${cf.bl})`, parseFloat(cf.outlineOffset) < 0 && cf.bl === c.bl, `${cf.outlineOffset} ${cf.bl}`)
      await tab(page, other).focus(); const of = await read(page, other)
      ok(`[${label}/${scheme}] ${route} 비선택 탭 포커스 링 2px solid, 색(${of.outline})이 면(${of.bg})과 다름`, /^2px solid /.test(of.outline) && of.outline.split(' ').slice(2).join(' ') !== of.bg, of.outline + ' / ' + of.bg)
      ok(`[${label}/${scheme}] ${route} 현재·비선택 탭 상자 크기 같음`, c.w === o.w && c.h === o.h)
      await tab(page, cur).focus()
      await page.screenshot({ path: `${SHOTS}/mpr41-${label}-forced-${scheme}-${route === '/' ? 'calendar' : 'car'}.png`, clip: { x: vp.width - 120, y: 0, width: 120, height: vp.height } })
      await ctx.close()
    }
  }
}

// 4) AC-14-4: 탭이 있는 화면의 캘린더 요소(탭 제외) 위치·크기가 탭 없던 때(ec21359)와 같음
for (const w of [360, 899]) {
  const vp = { width: w, height: 760 }
  const rects = (p) => p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => !e.closest('nav[aria-label="화면 전환"]') && e.getBoundingClientRect().width > 0)
    .map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName}.${String(e.className).split(' ').map((c) => c.replace(/_[a-zA-Z0-9]{5}_\d+$/, '')).join(' ')}|${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}` }))
  const a = await open(NOW + '/', vp), b = await open(NOTABS + '/', vp); await a.page.waitForTimeout(800); await b.page.waitForTimeout(800)
  const ra = await rects(a.page), rb = await rects(b.page); const d = ra.filter((r, i) => r !== rb[i])
  ok(`[${w}px] AC-14-4 캘린더 요소 ${ra.length}개 위치·크기가 탭 없던 때와 같음`, ra.length === rb.length && d.length === 0, `now=${ra.length} before=${rb.length} 첫 차이=${d[0]}`)
  ok(`[${w}px] 가로 스크롤 없음`, await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await a.ctx.close(); await b.ctx.close()
}
await browser.close()
console.log(`\nRESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
