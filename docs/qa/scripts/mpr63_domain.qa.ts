// MPR-63 QA 임시 테스트: v0.2 domain 변경(미입력·km 기준·되돌리기 계획·문구·계정 표시)이 스펙 숫자 예시와 맞고, 날짜가 있는 항목의 v0.1 동작이 그대로인지 개발자 테스트와 별개로 확인한다.
// 실행: npx vitest run --config <vitest.qa.config.mjs(include docs/qa/scripts/*.qa.ts)> docs/qa/scripts/mpr63_domain.qa.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as MSG from '../../../src/carbook/domain/messages'
import { accountDisplay } from '../../../src/carbook/domain/account'
import { BADGE_LABEL } from '../../../src/carbook/components/StatusBadge'
import * as OLD from './mpr63_old/maintenance'

// QA_DOMAIN_DIR(절대 경로)을 주면 그 폴더의 maintenance.ts를 검사한다(대조 실험용). 기본은 실제 소스
const NEWM: typeof OLD & typeof import('../../../src/carbook/domain/maintenance') = process.env.QA_DOMAIN_DIR ? await import(/* @vite-ignore */ `${process.env.QA_DOMAIN_DIR}/maintenance.ts`) : await import('../../../src/carbook/domain/maintenance')

const V = 'v-1', OTHER = 'v-2'
const item = (o: Partial<Record<string, unknown>> & { id: string; name: string }) => ({ vehicleId: V, intervalKm: null, intervalMonths: null, lastDate: '2026-08-01', lastOdometerKm: 44000, eventId: null, createdAt: '', ...o }) as never

describe('MSG-22~39 문구가 스펙 표와 글자 그대로 같다', () => {
  const spec = readFileSync(new URL('../../03_spec.md', import.meta.url), 'utf8')
  const row = (n: number) => {
    const m = spec.match(new RegExp(`^\\| MSG-${n} \\|[^|]*\\|\\s*(.+?)\\s*\\|\\s*$`, 'm'))
    if (!m) throw new Error(`MSG-${n} 행 없음`)
    return m[1].replace(/`/g, '')
  }
  const table: Record<number, string> = {
    22: MSG.MSG_22_LOGOUT_CONFIRM, 23: MSG.MSG_23_LOGOUT_FAILED, 24: MSG.MSG_24_NO_RESET, 25: MSG.MSG_25_RESET_CONFIRM(7).replace('7', '{N}'),
    26: MSG.MSG_26_LAST_DATE_UNSET, 27: MSG.MSG_27_COMPLETE_HINT, 28: MSG.MSG_28_KM_BASIS_MEMO, 29: MSG.MSG_29_LOGIN_FAILED, 30: MSG.MSG_30_AUTH_EXPIRED,
    31: MSG.MSG_31_EVENT_SAVED('{YYYY-MM-DD}'), 32: MSG.MSG_32_SAVED, 33: MSG.MSG_33_DEFAULT_LOAD_FAILED, 34: MSG.MSG_34_RESET_DONE(7).replace('7', '{N}'),
    35: MSG.MSG_35_RESET_CALENDAR_PARTIAL, 36: MSG.MSG_36_DEFAULT_APPLY_NOTE, 37: MSG.MSG_37_RELOGIN_NOTE, 38: MSG.MSG_38_UNSET_NOTE, 39: MSG.MSG_39_ESTIMATE,
  }
  for (const [n, text] of Object.entries(table)) it(`MSG-${n}`, () => expect(text).toBe(row(Number(n))))
  it('MSG-25·34의 {N}에 3을 넣으면 AC-20-1 문구가 된다', () => {
    expect(MSG.MSG_25_RESET_CONFIRM(3)).toContain('주기가 바뀌는 항목 3개.')
    expect(MSG.MSG_34_RESET_DONE(3)).toBe('3개 항목의 주기를 되돌렸습니다')
  })
})

describe('AC-20-1 미리 보기(되돌리기 계획) · AC-20-8 이름 기준', () => {
  const items = [
    item({ id: 'oil', name: '엔진오일', intervalKm: 15000, intervalMonths: 6, lastDate: '2026-05-01', lastOdometerKm: 40000, eventId: 'ev1' }),
    item({ id: 'ac', name: '에어컨 필터', intervalKm: 5000, intervalMonths: null }),
    item({ id: 'tire', name: '타이어 위치 교환', intervalKm: 10000, intervalMonths: 6 }),
    item({ id: 'air', name: '에어 필터', intervalKm: 20000, intervalMonths: 12 }),
    item({ id: 'brake', name: '브레이크 패드 점검', intervalKm: 20000, intervalMonths: null }),
    item({ id: 'batt', name: '배터리 점검', intervalKm: null, intervalMonths: 36 }),
    item({ id: 'winter', name: '겨울 타이어', intervalKm: 1, intervalMonths: 1 }),
    item({ id: 'other', vehicleId: OTHER, name: '엔진오일', intervalKm: 1, intervalMonths: 1 }),
  ]
  const frozen = JSON.stringify(items)
  it('AC-20-1: 항목 3개가 추천 순서로 from → to와 함께 나오고 입력 배열은 바뀌지 않는다(쓰기 0건)', () => {
    const plan = NEWM.planRecommendedReset(items, V)
    expect(plan.changes.map((c) => [c.name, c.from, c.to])).toEqual([
      ['엔진오일', { intervalKm: 15000, intervalMonths: 6 }, { intervalKm: 10000, intervalMonths: 12 }],
      ['에어컨 필터', { intervalKm: 5000, intervalMonths: null }, { intervalKm: 10000, intervalMonths: 6 }],
      ['타이어 위치 교환', { intervalKm: 10000, intervalMonths: 6 }, { intervalKm: 10000, intervalMonths: null }],
    ])
    expect(plan.changes.length).toBe(3)
    expect(MSG.MSG_25_RESET_CONFIRM(plan.changes.length)).toContain('항목 3개')
    expect(JSON.stringify(items)).toBe(frozen)
  })
  it('AC-20-2 일부: 지운 와이퍼는 다시 생기지 않고 겨울 타이어·다른 차량은 계획에 없다', () => {
    const ids = NEWM.planRecommendedReset(items, V).changes.map((c) => c.itemId)
    expect(ids).toEqual(['oil', 'ac', 'tire'])
    expect(NEWM.planRecommendedReset(items, V).changes.some((c) => ['와이퍼', '겨울 타이어'].includes(c.name))).toBe(false)
  })
  it('AC-20-8: 이름이 엔진오일인 두 항목 모두 10,000km / 12개월, 오일 교환은 그대로', () => {
    const two = [
      item({ id: 'a', name: '엔진오일', intervalKm: 15000, intervalMonths: 6 }),
      item({ id: 'b', name: '엔진오일', intervalKm: 20000, intervalMonths: null }),
      item({ id: 'c', name: '오일 교환', intervalKm: 5000, intervalMonths: 3 }),
    ]
    const ch = NEWM.planRecommendedReset(two, V).changes
    expect(ch.map((c) => c.itemId)).toEqual(['a', 'b'])
    expect(ch.every((c) => c.to.intervalKm === 10000 && c.to.intervalMonths === 12)).toBe(true)
  })
  it('경계: 앞뒤 공백 이름은 대상이고 저장된 이름 그대로 나옴(BR-45), 이미 추천 값이면 제외, 비면 changes 0(MSG-24)', () => {
    const sp = NEWM.planRecommendedReset([item({ id: 's', name: ' 엔진오일 ', intervalKm: 1, intervalMonths: 1 })], V).changes
    expect(sp).toHaveLength(1); expect(sp[0].name).toBe(' 엔진오일 ')
    const same = [item({ id: 'x', name: '엔진오일', intervalKm: 10000, intervalMonths: 12 })]
    expect(NEWM.planRecommendedReset(same, V).changes).toEqual([])
    expect(NEWM.planRecommendedReset([], V).changes).toEqual([])
    expect(NEWM.planRecommendedReset(items, 'v-없음').changes).toEqual([])
    expect(MSG.MSG_24_NO_RESET).toBe('추천 주기와 다른 항목이 없습니다')
  })
  it('실패 쪽: 이름 대소문자·부분 일치는 대상이 아님', () => {
    expect(NEWM.planRecommendedReset([item({ id: 'p', name: '엔진오일 점검', intervalKm: 1, intervalMonths: 1 })], V).changes).toEqual([])
  })
})

describe('AC-20-3 재계산 날짜 · AC-26-1·2 km 기준', () => {
  const ctx = { today: '2026-11-21', currentKm: 48000, avgKmPerDay: 1000 / 30 }
  it('AC-20-3: 되돌리기 전 엔진오일은 다음 교체일 2026-11-01·교체 시기 지남, 후는 2027-01-20·정상', () => {
    const base = { lastDate: '2026-05-01', lastOdometerKm: 40000 }
    const before = NEWM.evaluateItem({ ...base, intervalKm: 15000, intervalMonths: 6 }, ctx as never)
    const after = NEWM.evaluateItem({ ...base, intervalKm: 10000, intervalMonths: 12 }, ctx as never)
    expect(before).toMatchObject({ nextDate: '2026-11-01', status: 'overdue' })
    expect(after).toMatchObject({ nextDate: '2027-01-20', status: 'ok', remainingKm: 2000 })
    expect(NEWM.evaluateItem({ ...base, intervalKm: 10000, intervalMonths: 12 }, { ...ctx, avgKmPerDay: null } as never).nextDate).toBe('2027-05-01') // 개월 날짜
  })
  it('AC-26-1: AC-06-3 데이터(km 주기만) → 다음 교체일 2027-01-04, 기준 km', () => {
    const r = NEWM.evaluateItem({ intervalKm: 10000, intervalMonths: null, lastDate: '2026-05-01', lastOdometerKm: 40000 }, { today: '2026-11-05', currentKm: 48000, avgKmPerDay: 1000 / 30 } as never)
    expect(r).toMatchObject({ nextDate: '2027-01-04', basis: 'km', remainingKm: 2000 })
  })
  it('AC-26-2: 개월 3개월(마지막 교체일 2026-10-01) 추가 → 2027-01-01, 기준 months(메모 없음)', () => {
    const r = NEWM.evaluateItem({ intervalKm: 10000, intervalMonths: 3, lastDate: '2026-10-01', lastOdometerKm: 40000 }, { today: '2026-11-05', currentKm: 48000, avgKmPerDay: 1000 / 30 } as never)
    expect(r).toMatchObject({ nextDate: '2027-01-01', basis: 'months' })
  })
  it('BR-55 경계: 같은 날이면 개월 기준, 개월 주기만이면 months, 계산 불가면 null', () => {
    // 개월 날짜 = km 날짜가 되도록: 마지막 2026-10-05 + 3개월 = 2027-01-05, km 날짜 = 2026-11-05 + 61일(2000/ (2000/61)) = 2027-01-05
    const same = NEWM.evaluateItem({ intervalKm: 10000, intervalMonths: 3, lastDate: '2026-10-05', lastOdometerKm: 40000 }, { today: '2026-11-05', currentKm: 48000, avgKmPerDay: 2000 / 61 } as never)
    expect(same).toMatchObject({ nextDate: '2027-01-05', basis: 'months' })
    expect(NEWM.evaluateItem({ intervalKm: null, intervalMonths: 12, lastDate: '2026-05-01', lastOdometerKm: null }, ctx as never).basis).toBe('months')
    expect(NEWM.evaluateItem({ intervalKm: 10000, intervalMonths: null, lastDate: '2026-05-01', lastOdometerKm: 40000 }, { ...ctx, avgKmPerDay: null } as never)).toMatchObject({ nextDate: null, basis: null })
  })
})

describe('AC-24-1 미입력', () => {
  it('새 차량 추천 항목 7개가 모두 lastDate·lastOdometerKm null(BR-51), 순서·주기는 v0.1과 같음', () => {
    const n = NEWM.buildRecommendedItems()
    expect(n).toHaveLength(7)
    expect(n.every((r) => r.lastDate === null && r.lastOdometerKm === null)).toBe(true)
    expect(n.map((r) => [r.name, r.intervalKm, r.intervalMonths])).toEqual(OLD.buildRecommendedItems(48000, '2026-11-21').map((r) => [r.name, r.intervalKm, r.intervalMonths]))
  })
  it('미입력 항목은 다음 교체일·남은 거리 null, 상태 unset, 기준 null, 목록 맨 뒤(배지 없음)', () => {
    const r = NEWM.evaluateItem({ intervalKm: 10000, intervalMonths: 12, lastDate: null, lastOdometerKm: null }, { today: '2026-11-21', currentKm: 48000, avgKmPerDay: 33 } as never)
    expect(r).toEqual({ nextDate: null, remainingKm: null, status: 'unset', basis: null })
    const sorted = NEWM.sortItems([{ status: 'unset', nextDate: null, id: 1 }, { status: 'ok', nextDate: '2027-01-01', id: 2 }, { status: 'overdue', nextDate: '2026-01-01', id: 3 }, { status: 'soon', nextDate: '2026-12-01', id: 4 }])
    expect(sorted.map((x) => x.id)).toEqual([3, 4, 2, 1])
    expect(MSG.MSG_26_LAST_DATE_UNSET).toBe('마지막 교체일을 입력하세요')
    expect('unset' in BADGE_LABEL).toBe(false) // 후속 6c42207: 미입력은 배지 라벨 표에서 제외
  })
  it('날짜가 없어도 주행거리만 있는 경계(lastOdometerKm만 있고 lastDate null)도 unset', () => {
    expect(NEWM.evaluateItem({ intervalKm: 10000, intervalMonths: 12, lastDate: null, lastOdometerKm: 40000 }, { today: '2026-11-21', currentKm: 48000, avgKmPerDay: 33 } as never).status).toBe('unset')
  })
})

describe('동작 변경 0: 날짜가 있는 항목의 v0.1 결과와 새 결과가 같다(차분 시험)', () => {
  // 시드 고정 난수(재현 가능)
  let s = 20261124
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
  const day = () => `${pick([2025, 2026, 2027])}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`
  it('evaluateItem 5,000건: nextDate·remainingKm·status 동일(basis만 추가)', () => {
    for (let i = 0; i < 5000; i++) {
      const it2 = { intervalKm: pick([null, 5000, 10000, 20000]), intervalMonths: pick([null, 1, 3, 6, 12, 36]), lastDate: day(), lastOdometerKm: pick([null, 0, 30000, 44000]) }
      const c = { today: day(), currentKm: pick([30000, 44000, 48000, 60000]), avgKmPerDay: pick([null, 10, 33.3, 120]) }
      const o = OLD.evaluateItem(it2 as never, c as never), n = NEWM.evaluateItem(it2 as never, c as never)
      expect({ nextDate: n.nextDate, remainingKm: n.remainingKm, status: n.status }).toEqual(o)
    }
  })
  it('sortItems 1,000회: unset이 없는 목록의 순서와 원본 불변이 v0.1과 같다', () => {
    for (let i = 0; i < 1000; i++) {
      const list = Array.from({ length: 8 }, (_, k) => ({ id: k, status: pick(['ok', 'soon', 'overdue'] as const), nextDate: pick([null, day(), day()]) }))
      const copy = JSON.stringify(list)
      expect(NEWM.sortItems(list as never).map((x) => x.id)).toEqual(OLD.sortItems(list as never).map((x) => x.id))
      expect(JSON.stringify(list)).toBe(copy)
    }
  })
  it('saveVehicle의 새 항목 생성 인자: v0.1(buildRecommendedItems(주행거리))과 새(buildRecommendedItems() + lastDate=오늘, lastOdometerKm=주행거리)가 같다', () => {
    for (const odo of [null, 0, 48000, 123456]) {
      const old = OLD.buildRecommendedItems(odo, '2026-11-21')
      const neu = NEWM.buildRecommendedItems().map((r) => ({ ...r, lastDate: '2026-11-21', lastOdometerKm: odo }))
      expect(neu).toEqual(old)
    }
  })
  it('추천 7개의 이름·주기·순서가 v0.1과 같다', () => {
    expect(NEWM.RECOMMENDED_ITEMS).toEqual(OLD.RECOMMENDED_ITEMS)
    expect(NEWM.SOON_DAYS).toBe(OLD.SOON_DAYS); expect(NEWM.SOON_KM).toBe(OLD.SOON_KM)
  })
  it('배지 라벨: soon·overdue는 v0.1 그대로', () => {
    expect(BADGE_LABEL.soon).toBe('곧 교체'); expect(BADGE_LABEL.overdue).toBe('교체 시기 지남')
  })
})

describe('계정 표시(AC-17-10)', () => {
  it('이름이 있으면 "계정 메뉴, 김차계", 없으면 이메일', () => {
    expect(accountDisplay({ email: 'carbook@example.com', user_metadata: { full_name: '김차계' } }).label).toBe('계정 메뉴, 김차계')
    expect(accountDisplay({ email: 'carbook@example.com', user_metadata: {} }).label).toBe('계정 메뉴, carbook@example.com')
  })
  it('http·javascript 사진 주소는 쓰지 않음', () => {
    expect(accountDisplay({ user_metadata: { avatar_url: 'http://x/a.png', picture: 'javascript:alert(1)' } }).photoUrl).toBeNull()
  })
})
