// MPR-45 QA 임시 스크립트: 토큰 교체 전(ca60541) 빌드와 후(08032cf) 빌드의 /car 화면 12개 상태를 375·1280px × 라이트·다크·동작 줄이기에서 열어, 모든 요소의 계산된 스타일과 위치·크기를 DOM 순서대로 비교한다.
// 또 캘린더 화면을 탭이 없던 때(30ad796 직전)와 비교하고(AC-14-4: 360·899px), 파일철 탭·하위 탭의 터치 크기(AC-14-5)와 동작 줄이기에서의 눌림 크기 범위를 잰다.
// 실행: node docs/qa/scripts/mpr45_styles.mjs <playwright-core index.mjs> <교체 전 빌드> <교체 후 빌드> <탭 없던 때 빌드> <스크린샷 폴더>
import { mkdirSync } from 'node:fs'
import { launch, openApp, reporter, tab, baseSeed } from './mpr38_lib.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 900000)
const [, , PW, PRE, POST, NOTABS, SHOTS] = process.argv
mkdirSync(SHOTS, { recursive: true })
const { ok, done } = reporter()
const browser = await launch(PW)
const PROPS = ['display', 'position', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'color', 'backgroundColor', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'borderTopStyle', 'borderBottomStyle',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'gap', 'rowGap', 'columnGap',
  'justifyContent', 'alignItems', 'flexDirection', 'gridTemplateColumns', 'boxShadow', 'opacity', 'transitionDuration', 'transform', 'zIndex', 'outlineWidth', 'outlineOffset', 'textDecorationLine', 'overflowX', 'overflowY']

// 화면에 보이는 모든 요소의 계산된 스타일·위치를 DOM 순서로 모은다
const snap = (page, rootSel) => page.evaluate(([sel, props]) => {
  const root = document.querySelector(sel) ?? document.body
  const out = []
  for (const el of [root, ...root.querySelectorAll('*')]) {
    if (['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE'].includes(el.tagName)) continue
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    const o = { tag: el.tagName.toLowerCase() + (el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''), text: (el.children.length ? '' : el.textContent.trim()).slice(0, 18), x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }
    for (const p of props) o[p] = cs[p]
    out.push(o)
  }
  return out
}, [rootSel, PROPS])

const views = [
  ['기록 탭', async () => {}],
  ['교체 알림 탭', async (p) => { await tab(p, '교체 알림').click() }],
  ['만기일 탭', async (p) => { await tab(p, '만기일').click() }],
  ['통계 탭', async (p) => { await tab(p, '통계').click() }],
  ['기록 추가 양식', async (p) => { await p.getByRole('button', { name: '기록 추가' }).click() }],
  ['삭제 확인(양식 위)', async (p) => { await p.locator('section ul li button', { hasText: '15,000원' }).click(); await p.waitForTimeout(500); await p.getByRole('dialog', { name: '기록 수정' }).getByRole('button', { name: '삭제' }).click() }],
  ['차량 추가 양식', async (p) => { await p.getByRole('button', { name: '차량 추가' }).click() }],
  ['교체 완료 창', async (p) => { await tab(p, '교체 알림').click(); await p.waitForTimeout(300); await p.getByRole('button', { name: '교체 완료, 엔진오일' }).click() }],
  ['교체 항목 추가 양식', async (p) => { await tab(p, '교체 알림').click(); await p.waitForTimeout(300); await p.getByRole('button', { name: '항목 추가' }).first().click() }],
  ['만기일 입력 양식(자동차세)', async (p) => { await tab(p, '만기일').click(); await p.waitForTimeout(300); await p.getByRole('button', { name: '자동차세 납부 입력' }).click() }],
]

async function collect(dist, vpName, scheme, reduced) {
  const res = {}
  for (const [name, act] of views) {
    const a = await openApp(browser, dist, { vp: vpName, scheme, reduced, blockExternal: true })
    const p = a.page; await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(700)
    await act(p); await p.waitForTimeout(900)
    res[name] = await snap(p, 'body')
    await a.close()
  }
  { // 빈 상태(차량 0대), 불러오기 실패
    const seed = baseSeed(); for (const k of Object.keys(seed)) if (k !== 'categories') seed[k] = []
    const a = await openApp(browser, dist, { vp: vpName, scheme, reduced, seed, blockExternal: true }); await a.page.waitForTimeout(1500); res['차량 0대 빈 상태'] = await snap(a.page, 'body'); await a.close()
    const b = await openApp(browser, dist, { vp: vpName, scheme, reduced, goto: false, blockExternal: true }); b.s.cfg.fail['GET vehicles'] = 500
    await b.page.goto('http://localhost:4173/car'); await b.page.waitForTimeout(1500); res['불러오기 실패'] = await snap(b.page, 'body'); await b.close()
  }
  return res
}
const diffs = (a, b) => {
  const out = []
  if (a.length !== b.length) return [`요소 수 ${a.length} → ${b.length}`]
  a.forEach((x, i) => { for (const k of Object.keys(x)) if (x[k] !== b[i][k]) out.push(`#${i} ${x.tag}"${x.text}" ${k}: ${x[k]} → ${b[i][k]}`) })
  return out
}

const combos = []
for (const vp of ['mobile375', 'desktop1280']) for (const [scheme, reduced, lab] of [['light', false, '라이트'], ['dark', false, '다크'], ['light', true, '동작 줄이기']]) combos.push([vp, scheme, reduced, lab])
let totalDiff = 0
for (const [vp, scheme, reduced, lab] of combos) {
  const before = await collect(PRE, vp, scheme, reduced), after = await collect(POST, vp, scheme, reduced)
  const names = Object.keys(before)
  const allDiffs = names.flatMap((n) => diffs(before[n], after[n]).map((d) => `${n} ${d}`))
  const counted = names.reduce((s, n) => s + before[n].length, 0)
  totalDiff += allDiffs.length
  ok(`[${vp} ${lab}] 차계부 ${names.length}개 상태, 요소 ${counted}개의 계산된 스타일·위치·크기(${PROPS.length + 4}개 속성)가 교체 전과 같음`, allDiffs.length === 0, `${allDiffs.length}건: ${allDiffs.slice(0, 12).join(' || ')}`)
  if (allDiffs.length) console.log('  차이 목록(앞 40):\n   ' + allDiffs.slice(0, 40).join('\n   '))
}

// ───── 동작 줄이기: 눌림 크기 변화는 차계부(.main)·파일철 탭(.nav) 아래에서만 없어지고 캘린더는 그대로(AC-01-5) ─────
for (const vp of ['mobile375']) {
  const a = await openApp(browser, POST, { vp, reduced: true }); const p = a.page
  await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(600)
  const car = await p.evaluate(() => ({ main: getComputedStyle(document.querySelector('#main-content')).getPropertyValue('--press-scale').trim(), nav: getComputedStyle(document.querySelector('nav[aria-label="화면 전환"]')).getPropertyValue('--press-scale').trim(), root: getComputedStyle(document.documentElement).getPropertyValue('--press-scale').trim() }))
  ok(`[${vp} 동작 줄이기] 차계부 본문·파일철 탭의 --press-scale은 1, 전역 값은 그대로(${JSON.stringify(car)})`, car.main === '1' && car.nav === '1' && car.root !== '1' && car.root !== '', JSON.stringify(car))
  await p.getByRole('link', { name: '캘린더' }).click(); await p.waitForTimeout(900)
  const cal = await p.evaluate(() => ({ root: getComputedStyle(document.documentElement).getPropertyValue('--press-scale').trim(), main: getComputedStyle(document.querySelector('main') ?? document.body).getPropertyValue('--press-scale').trim(), nav: getComputedStyle(document.querySelector('nav[aria-label="화면 전환"]')).getPropertyValue('--press-scale').trim() }))
  console.log('  · 캘린더 화면(동작 줄이기):', JSON.stringify(cal))
  ok(`[${vp} 동작 줄이기] 캘린더 화면의 본문 --press-scale은 전역 값 그대로(1이 아님)`, cal.main !== '1' && cal.main !== '', JSON.stringify(cal))
  await a.close()
}

// ───── AC-14-4 캘린더 배치 불변: 탭이 없던 때(30ad796 직전)와 비교, 폭 360·899px ─────
for (const w of [360, 899]) {
  const rect = async (dist) => {
    const a = await openApp(browser, dist, { vp: { width: w, height: 760 }, touch: w === 360, path: '/', blockExternal: true }); const p = a.page
    await p.waitForTimeout(1800)
    const all = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => !e.closest('nav[aria-label="화면 전환"]') && !['SCRIPT', 'STYLE', 'LINK'].includes(e.tagName)).map((el) => { const r = el.getBoundingClientRect(); return `${el.tagName.toLowerCase()}|${(el.children.length ? '' : el.textContent.trim()).slice(0, 12)}|${Math.round(r.x * 10) / 10},${Math.round(r.y * 10) / 10},${Math.round(r.width * 10) / 10},${Math.round(r.height * 10) / 10}` }))
    await a.close(); return all
  }
  const base = await rect(NOTABS), now = await rect(POST)
  const bad = base.length === now.length ? base.map((x, i) => (x === now[i] ? null : `${x} → ${now[i]}`)).filter(Boolean) : [`요소 수 ${base.length} → ${now.length}`]
  ok(`[${w}px] AC-14-4 캘린더 요소 ${base.length}개의 위치·크기가 탭이 없던 때(30ad796 직전)와 같음(파일철 탭 제외)`, bad.length === 0, bad.slice(0, 8).join(' || '))
}

// ───── AC-14-5 터치 크기: 폭 360px 터치에서 탭 각각 ─────
{
  const a = await openApp(browser, POST, { vp: { width: 360, height: 760 }, touch: true }); const p = a.page
  await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(700)
  const sizes = await p.evaluate(() => [...document.querySelectorAll('nav[aria-label="화면 전환"] a, [role=tab]')].map((e) => { const r = e.getBoundingClientRect(); return { n: e.textContent.trim(), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 } }))
  console.log('  · 360px 탭 크기:', JSON.stringify(sizes))
  ok('[360px 터치] AC-14-5 파일철 탭 2개·하위 탭 4개의 터치 영역이 너비 24px 이상, 높이 44px 이상', sizes.length === 6 && sizes.every((s) => s.w >= 24 && s.h >= 44), JSON.stringify(sizes))
  await p.screenshot({ path: `${SHOTS}/mpr45-mobile360-tabs.png` })
  await a.close()
}
await browser.close()
console.log(`총 차이 ${totalDiff}건`)
done()
