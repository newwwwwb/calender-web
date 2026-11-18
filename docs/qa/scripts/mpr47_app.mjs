// MPR-47 QA 임시 스크립트: 실제 /car 앱(모의 Supabase)에서 F-11 삭제 확인(AC-11-1~4)과 F-12 안내 문구(AC-12-1~4)를 Chrome 375·1280px로 확인한다. 삭제 요청 수는 모의 서버의 요청 기록(DELETE)으로 센다.
// 실행: node docs/qa/scripts/mpr47_app.mjs <playwright-core index.mjs> <앱 빌드 폴더> <스크린샷 폴더>
import { mkdirSync } from 'node:fs'
import { launch, openApp, panel, tab, reporter, waitNoDialog, dialogs, baseSeed } from './mpr38_lib.mjs'
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2) }, 500000)
const [, , PW, DIST, SHOTS] = process.argv
mkdirSync(SHOTS, { recursive: true })
const { ok, done } = reporter()
const browser = await launch(PW)
const HINT = '참고용 값입니다. 차량 매뉴얼을 우선하세요'
const dels = (a, table) => a.s.log.filter((e) => e.m === 'DELETE' && e.t === table).length
const allDels = (a) => a.s.log.filter((e) => e.m === 'DELETE').length

// 대상별: 열기(삭제 확인창이 뜰 때까지) 함수, 확인창에 들어갈 이름, 서버 표, 사라졌는지 판정
const targets = (a) => ({
  기록: { open: async (p) => { await p.locator('section ul li button', { hasText: '15,000원' }).click(); await p.waitForTimeout(600); await p.getByRole('dialog', { name: '기록 수정' }).getByRole('button', { name: '삭제' }).click() }, name: /기록/, table: 'car_records', gone: () => !a.s.db.car_records.some((r) => r.id === 'a0000000-0000-4000-8000-000000000003'), left: () => a.page.locator('section ul li').count().then((n) => n === 2) }, // 출퇴근의 기록 3건 중 1건 삭제 → 2건
  교체항목: { tab: '교체 알림', open: async (p) => { await p.getByRole('button', { name: /^와이퍼.*수정$/ }).click(); await p.waitForTimeout(600); await p.getByRole('dialog', { name: '교체 항목 수정' }).getByRole('button', { name: '삭제' }).click() }, name: /와이퍼/, table: 'car_maintenance_items', gone: () => !a.s.db.car_maintenance_items.some((r) => r.name === '와이퍼'), left: () => a.page.getByText('와이퍼').count().then((n) => n === 0) },
  만기일: { tab: '만기일', open: async (p) => { await p.getByRole('button', { name: '보험 만기 삭제' }).click() }, name: /보험 만기/, table: 'car_due_dates', gone: () => !a.s.db.car_due_dates.some((r) => r.kind === 'insurance'), left: () => a.page.getByText('2027-03-10').count().then((n) => n === 0) },
  차량: { open: async (p) => { await p.getByLabel('차량 영역').getByRole('button', { name: '삭제', exact: true }).click() }, name: /출퇴근/, table: 'vehicles', gone: () => !a.s.db.vehicles.some((r) => r.name === '출퇴근'), left: () => a.page.locator('select option').count().then((n) => n === 1) },
})

for (const vp of ['mobile375', 'desktop1280']) {
  for (const key of ['기록', '교체항목', '만기일', '차량']) {
    const label = `${vp} ${key}`
    // AC-11-1 취소 / AC-11-4 Esc / AC-11-2 확인 삭제(+ AC-11-3 대상 이름 문구)
    for (const how of ['취소', 'Esc', '삭제']) {
      const a = await openApp(browser, DIST, { vp })
      const p = a.page; await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(700)
      const t = targets(a)[key]
      if (t.tab) { await tab(p, t.tab).click(); await p.waitForTimeout(300) }
      await t.open(p); await p.waitForTimeout(500)
      const dlg = p.getByRole('dialog', { name: '삭제 확인' })
      const msg = (await dlg.innerText()).replace(/\n+/g, ' / ')
      if (how === '취소') {
        ok(`[${label}] AC-11-3 삭제 확인창 문구에 대상 이름이 들어감(${key})${key === '차량' ? ', MSG-14(연결 일정 삭제 안내) 포함' : ''}`, t.name.test(msg) && (key !== '차량' || /일정/.test(msg)), msg)
        await p.screenshot({ path: `${SHOTS}/mpr47-${vp}-confirm-${key}.png` })
        ok(`[${label}] 확인창의 첫 포커스가 "취소"(파괴적 동작이 기본이 아님)`, (await p.evaluate(() => document.activeElement?.textContent?.trim())) === '취소')
        await dlg.getByRole('button', { name: '취소' }).click(); await p.waitForTimeout(900)
        ok(`[${label}] AC-11-1 "취소" → 대상이 남고 삭제 요청 0건`, allDels(a) === 0 && !t.gone() === true, `DELETE ${allDels(a)}`)
      } else if (how === 'Esc') {
        await p.keyboard.press('Escape'); await p.waitForTimeout(900)
        const open = await dialogs(p)
        ok(`[${label}] AC-11-4 Esc → 확인창이 닫히고(남은 창: ${open.join(',') || '없음'}) 삭제 요청 0건, 대상이 남음`, !open.includes('삭제 확인') && allDels(a) === 0 && !t.gone(), `DELETE ${allDels(a)}`)
      } else {
        await dlg.getByRole('button', { name: '삭제' }).click(); const ms = await waitNoDialog(p, 5000); await p.waitForTimeout(500)
        const n = dels(a, t.table)
        ok(`[${label}] AC-11-2 확인 "삭제" → ${t.table} 삭제 요청 정확히 1건${key === '차량' ? '(차량 삭제는 연결 일정 삭제 요청이 따로 있을 수 있음)' : ''}, 대상이 사라지고 창이 닫힘(${ms}ms)`, (key === '차량' ? n === 1 : n === 1) && t.gone() && ms >= 0 && (await t.left()), `${t.table} DELETE ${n}, gone=${t.gone()}, ms=${ms}`)
      }
      await a.close()
    }
  }
}

// ───── F-12 안내 문구 ─────
for (const vp of ['mobile375', 'desktop1280']) {
  const a = await openApp(browser, DIST, { vp })
  const p = a.page; await p.getByRole('tab', { name: '기록' }).waitFor(); await p.waitForTimeout(600)
  await tab(p, '교체 알림').click(); await p.waitForTimeout(400)
  const hb = await panel(p).getByText(HINT).boundingBox(), lb = await panel(p).locator('ul').first().boundingBox()
  ok(`[${vp}] AC-12-1 교체 알림 탭: MSG-12 문구가 보이고 항목 목록 위에 있음`, !!hb && !!lb && hb.y + hb.height <= lb.y, JSON.stringify({ hb, lb }))
  await p.screenshot({ path: `${SHOTS}/mpr47-${vp}-hint-tab.png`, fullPage: true })
  await panel(p).getByRole('button', { name: '항목 추가' }).first().click(); await p.waitForTimeout(600)
  const d = p.getByRole('dialog', { name: '교체 항목 추가' })
  const fb = await d.getByText(HINT).boundingBox(), kb = await d.getByLabel('km 주기', { exact: true }).boundingBox()
  ok(`[${vp}] AC-12-2 항목 추가 양식: MSG-12가 주기 입력 칸 위쪽에 겹치지 않고 보임`, !!fb && !!kb && fb.y + fb.height <= kb.y + 1, JSON.stringify({ fb, kb }))
  await p.screenshot({ path: `${SHOTS}/mpr47-${vp}-hint-form.png` })
  await p.keyboard.press('Escape'); await p.waitForTimeout(700)
  await a.close()
  // 빈 목록: 항목이 없는 차량
  const seed = baseSeed(); seed.car_maintenance_items = []
  const b = await openApp(browser, DIST, { vp, seed })
  const q = b.page; await q.getByRole('tab', { name: '기록' }).waitFor(); await tab(q, '교체 알림').click(); await q.waitForTimeout(500)
  ok(`[${vp}] AC-12-3 교체 항목 0개: "교체 항목이 없습니다"와 함께 MSG-12 문구도 보임`, (await panel(q).getByText('교체 항목이 없습니다').count()) === 1 && (await panel(q).getByText(HINT).isVisible()), (await panel(q).innerText()).slice(0, 120))
  await q.screenshot({ path: `${SHOTS}/mpr47-${vp}-hint-empty.png` })
  await b.close()
}
await browser.close()
done()
