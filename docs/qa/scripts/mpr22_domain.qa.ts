// MPR-22 QA 임시 스크립트: 추천 항목·다음 교체일·상태·정렬·일정 제목·빠른 선택 날짜 AC를 정상·경계·실패로 확인한다(npm test 미포함).
import { describe, expect, it } from 'vitest'
import { buildRecommendedItems, evaluateItem, sortItems } from '../../../src/carbook/domain/maintenance'
import { dailyAverageKm } from '../../../src/carbook/domain/odometer'
import { dueEventTitle, itemEventTitle } from '../../../src/carbook/domain/titles'
import { nextCarTaxDate } from '../../../src/carbook/domain/dueDates'

const T = '2026-11-05'
type E = Parameters<typeof evaluateItem>[0]
const it0: E = { intervalKm: null, intervalMonths: null, lastDate: T, lastOdometerKm: null }
const ev = (o: Partial<E>, currentKm = 0, avg: number | null = null, today = T) => evaluateItem({ ...it0, ...o }, { today, currentKm, avgKmPerDay: avg })

describe('AC-06-1 추천 7개', () => {
  it('이름·km·개월·순서가 원본 4.1과 같고 마지막 교체일은 오늘', () => {
    const r = buildRecommendedItems(null, T)
    expect(r.map((x) => `${x.name}|${x.intervalKm}|${x.intervalMonths}`)).toEqual([
      '엔진오일|10000|12', '에어컨 필터|10000|6', '에어 필터|20000|12', '타이어 위치 교환|10000|null', '브레이크 패드 점검|20000|null', '와이퍼|null|12', '배터리 점검|null|36'])
    expect(new Set(r.map((x) => x.lastDate))).toEqual(new Set([T]))
  })
  it('호출마다 새 배열(공유 상태 변경 없음)', () => {
    const a = buildRecommendedItems(1, T); a[0].name = 'X'
    expect(buildRecommendedItems(1, T)[0].name).toBe('엔진오일')
  })
})

describe('AC-06-2 / 06-12 개월 계산', () => {
  it('12개월 2027-11-05 → 6개월 2027-05-05', () => { expect(ev({ intervalMonths: 12 }).nextDate).toBe('2027-11-05'); expect(ev({ intervalMonths: 6 }).nextDate).toBe('2027-05-05') })
  it('말일 보정 01-31+1=02-28, 윤년 2028-01-31+1=02-29, 03-31+1=04-30', () => {
    expect(ev({ intervalMonths: 1, lastDate: '2026-01-31' }).nextDate).toBe('2026-02-28')
    expect(ev({ intervalMonths: 1, lastDate: '2028-01-31' }).nextDate).toBe('2028-02-29')
    expect(ev({ intervalMonths: 1, lastDate: '2026-03-31' }).nextDate).toBe('2026-04-30')
  })
})

describe('AC-06-3/4/5 km 계산 (BR-12 평균과 연결)', () => {
  const rows = [{ id: 'a', date: '2026-10-06', odometerKm: 47000 }, { id: 'b', date: '2026-11-05', odometerKm: 48000 }]
  const avg = dailyAverageKm(rows, T)
  it('AC-06-3 평균 1,000÷30, R=2,000, 다음 교체일 2027-01-04', () => {
    expect(avg).toBeCloseTo(1000 / 30, 10)
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 48000, avg)).toEqual({ nextDate: '2027-01-04', remainingKm: 2000, status: 'ok' })
  })
  it('AC-06-4 개월 3(2026-10-01)을 더하면 이른 2027-01-01', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000, intervalMonths: 3, lastDate: '2026-10-01' }, 48000, avg).nextDate).toBe('2027-01-01')
  })
  it('AC-06-4 반대: km 날짜가 더 이르면 km 날짜', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000, intervalMonths: 12 }, 48000, avg).nextDate).toBe('2027-01-04')
  })
  it('AC-06-5 기록 1건뿐(평균 없음): 날짜 null, 남은 거리 8,000, 정상', () => {
    const a1 = dailyAverageKm([{ id: 'a', date: T, odometerKm: 42000 }], T)
    expect(a1).toBeNull()
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 42000, a1)).toEqual({ nextDate: null, remainingKm: 8000, status: 'ok' })
  })
  it('경계: R이 정확히 평균의 배수면 올림 오차로 하루가 늘지 않음 (R=2,000, 평균 1000/30 → 60일 정확)', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 48000, 1000 / 30).nextDate).toBe('2027-01-04')
  })
  it('경계: R=1이면 하루 뒤, R=0이면 오늘', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 49999, 100).nextDate).toBe('2026-11-06')
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 50000, 100).nextDate).toBe(T)
  })
  it('경계: R<0이면 오늘(BR-13 ②), 상태 지남', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 50500, 100)).toMatchObject({ nextDate: T, remainingKm: -500, status: 'overdue' })
  })
  it('경계: R÷평균이 소수면 올림 (R=250, 평균 100 → 3일)', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 49750, 100).nextDate).toBe('2026-11-08')
  })
})

describe('AC-06-6/7/8 상태', () => {
  // 다음 교체일을 직접 정하려면 개월 주기로 만든다: lastDate+1개월 = 다음 교체일
  const byDate = (lastDate: string) => ev({ intervalMonths: 1, lastDate })
  it('AC-06-6 12-05(+30일) 곧 교체, 12-06(+31일) 배지 없음', () => {
    expect(byDate('2026-11-05')).toMatchObject({ nextDate: '2026-12-05', status: 'soon' })
    expect(byDate('2026-11-06')).toMatchObject({ nextDate: '2026-12-06', status: 'ok' })
  })
  it('경계: 오늘 자체(11-05)는 곧 교체, 어제(11-04)는 지남', () => {
    expect(byDate('2026-10-05')).toMatchObject({ nextDate: '2026-11-05', status: 'soon' })
    expect(byDate('2026-10-04')).toMatchObject({ nextDate: '2026-11-04', status: 'overdue' })
  })
  it('AC-06-7 남은 거리 1,000 곧 교체, 1,001 배지 없음, 0도 곧 교체', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 49000)).toMatchObject({ remainingKm: 1000, status: 'soon' })
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 48999)).toMatchObject({ remainingKm: 1001, status: 'ok' })
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 50000)).toMatchObject({ remainingKm: 0, status: 'soon' })
  })
  it('AC-06-7 날짜 조건이 있으면 거리 1,001km여도 곧 교체(문구: 날짜 조건이 없는 한)', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000, intervalMonths: 1, lastDate: '2026-11-05' }, 48999)).toMatchObject({ remainingKm: 1001, status: 'soon' })
  })
  it('AC-06-8 11-04이거나 −1km는 지남이며 "곧 교체"가 아님(상태는 하나)', () => {
    expect(byDate('2026-10-04').status).toBe('overdue')
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 50001)).toMatchObject({ remainingKm: -1, status: 'overdue' })
    // 지남이 곧 교체 조건(R<=1000)도 만족하지만 지남이 우선
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000, intervalMonths: 1, lastDate: '2026-10-04' }, 50001).status).toBe('overdue')
  })
  it('BR-14 날짜도 R도 없으면 정상', () => { expect(ev({})).toEqual({ nextDate: null, remainingKm: null, status: 'ok' }) })
  it('BR-14 날짜를 못 구해도 R만으로 판정(평균 없음, R=−1 지남 / R=1000 곧)', () => {
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 50001, null).status).toBe('overdue')
    expect(ev({ intervalKm: 10000, lastOdometerKm: 40000 }, 49000, null).status).toBe('soon')
  })
})

describe('AC-06-13 / 06-15 주행거리 빈 차량', () => {
  const items = buildRecommendedItems(null, T)
  const by = (n: string) => items.find((x) => x.name === n)!
  it('AC-06-13 타이어·브레이크: 날짜 없음, 남은 거리 없음, 배지 없음 (평균이 있어도)', () => {
    for (const avg of [null, 50]) for (const n of ['타이어 위치 교환', '브레이크 패드 점검'])
      expect(evaluateItem(by(n), { today: T, currentKm: 0, avgKmPerDay: avg })).toEqual({ nextDate: null, remainingKm: null, status: 'ok' })
  })
  it('AC-06-13 엔진오일은 2027-11-05, 배지 없음 (평균이 있어도 km 쪽은 계산 제외)', () => {
    for (const avg of [null, 50]) expect(evaluateItem(by('엔진오일'), { today: T, currentKm: 0, avgKmPerDay: avg })).toEqual({ nextDate: '2027-11-05', remainingKm: null, status: 'ok' })
  })
  it('AC-06-13 7개 모두 배지 없음', () => {
    expect(items.map((x) => evaluateItem(x, { today: T, currentKm: 0, avgKmPerDay: null }).status)).toEqual(Array(7).fill('ok'))
  })
  it('AC-06-15 (평가 부분) 마지막 교체 주행거리 48,000이 채워지면 엔진오일 남은 거리 10,000, 지남 아님', () => {
    const filled = buildRecommendedItems(48000, T)
    const r = filled.map((x) => evaluateItem(x, { today: T, currentKm: 48000, avgKmPerDay: null }))
    expect(r[0]).toMatchObject({ remainingKm: 10000, status: 'ok', nextDate: '2027-11-05' })
    expect(r.some((x) => x.status === 'overdue')).toBe(false)
    expect(r.filter((x, i) => filled[i].intervalKm !== null).every((x) => x.remainingKm !== null && x.remainingKm >= 10000)).toBe(true)
  })
  it('AC-06-15 채움 전(null) 현재 48,000이어도 지남 아님', () => {
    expect(items.map((x) => evaluateItem(x, { today: T, currentKm: 48000, avgKmPerDay: 50 }).status).includes('overdue')).toBe(false)
  })
})

describe('AC-06-16 정렬', () => {
  const mk = (id: string, lastDate: string | null, months: number | null) => ({ id, ...evaluateItem({ intervalKm: null, intervalMonths: months, lastDate: lastDate ?? T, lastOdometerKm: null }, { today: T, currentKm: 0, avgKmPerDay: null }) })
  const list = [mk('정상', '2026-03-01', 12), mk('곧20', '2025-11-20', 12), mk('지남', '2025-10-01', 12), mk('곧10', '2025-11-10', 12), mk('없음', null, null)]
  it('입력 전제(상태·날짜)가 AC와 같음', () => {
    expect(list.map((x) => `${x.id}:${x.status}:${x.nextDate}`)).toEqual(['정상:ok:2027-03-01', '곧20:soon:2026-11-20', '지남:overdue:2026-10-01', '곧10:soon:2026-11-10', '없음:ok:null'])
  })
  it('순서: 지남(10-01), 곧(11-10), 곧(11-20), 정상(2027-03-01), 날짜 없음', () => {
    expect(sortItems(list).map((x) => x.id)).toEqual(['지남', '곧10', '곧20', '정상', '없음'])
  })
  it('입력 순서를 뒤집어도 같고, 원본 배열은 바뀌지 않음', () => {
    const copy = [...list].reverse(); const before = copy.map((x) => x.id)
    expect(sortItems(copy).map((x) => x.id)).toEqual(['지남', '곧10', '곧20', '정상', '없음']); expect(copy.map((x) => x.id)).toEqual(before)
  })
  it('경계: 같은 상태·같은 날짜·날짜 없음 둘은 입력 순서 유지(안정), 빈 배열, 1개', () => {
    const a = { id: 'a', status: 'ok' as const, nextDate: null }, b = { id: 'b', status: 'ok' as const, nextDate: null }
    expect(sortItems([a, b]).map((x) => x.id)).toEqual(['a', 'b']); expect(sortItems([b, a]).map((x) => x.id)).toEqual(['b', 'a'])
    expect(sortItems([])).toEqual([]); expect(sortItems([a])).toEqual([a])
  })
  it('경계: 날짜 없는 지남(R만으로 지남)은 정상보다 앞', () => {
    const o = { id: 'o', status: 'overdue' as const, nextDate: null }, k = { id: 'k', status: 'ok' as const, nextDate: '2026-12-01' }
    expect(sortItems([k, o]).map((x) => x.id)).toEqual(['o', 'k'])
  })
})

describe('AC-08-10 일정 제목에 번호판 없음', () => {
  it('제목 형식이 스펙과 같음 (BR-20, F-07)', () => {
    expect(itemEventTitle('내 차', '엔진오일')).toBe('[내 차] 엔진오일 교체 예정')
    expect(dueEventTitle('내 차', 'insurance')).toBe('[내 차] 보험 만기')
    expect(dueEventTitle('내 차', 'car_tax')).toBe('[내 차] 자동차세 납부')
    expect(dueEventTitle('내 차', 'inspection')).toBe('[내 차] 정기검사 만기')
  })
  it('함수가 번호판 인자를 받지 않음(인자 2개) → 번호판이 들어갈 경로가 없음', () => {
    expect(itemEventTitle.length).toBe(2); expect(dueEventTitle.length).toBe(2)
    const plate = '12가3456'
    for (const t of [itemEventTitle('내 차', '엔진오일'), ...(['insurance', 'car_tax', 'inspection'] as const).map((k) => dueEventTitle('내 차', k))]) expect(t).not.toContain(plate)
  })
  it('실패 쪽: 번호판을 세 번째 인자로 억지로 넘겨도 제목에 반영되지 않음', () => {
    const plate = '12가3456'
    // @ts-expect-error 의도적으로 잘못된 호출
    expect(itemEventTitle('내 차', '엔진오일', plate)).not.toContain(plate)
    // @ts-expect-error 의도적으로 잘못된 호출
    expect(dueEventTitle('내 차', 'insurance', plate)).not.toContain(plate)
  })
})

describe('AC-15-1/2 자동차세 빠른 선택', () => {
  it('AC-15-1 오늘 2026-11-05 → 12월 31일 = 2026-12-31', () => expect(nextCarTaxDate('dec31', T)).toBe('2026-12-31'))
  it('AC-15-2 오늘 2026-11-05 → 6월 30일 = 2027-06-30', () => expect(nextCarTaxDate('jun30', T)).toBe('2027-06-30'))
  it('경계: 당일은 올해(오늘 포함), 다음 날은 다음 해', () => {
    expect(nextCarTaxDate('jun30', '2026-06-30')).toBe('2026-06-30'); expect(nextCarTaxDate('jun30', '2026-07-01')).toBe('2027-06-30')
    expect(nextCarTaxDate('dec31', '2026-12-31')).toBe('2026-12-31'); expect(nextCarTaxDate('dec31', '2027-01-01')).toBe('2027-12-31')
    expect(nextCarTaxDate('jun30', '2026-01-01')).toBe('2026-06-30'); expect(nextCarTaxDate('dec31', '2026-01-01')).toBe('2026-12-31')
  })
  it('항상 오늘 이상이고 올해 또는 내년 (365일 전수)', () => {
    let d = new Date(Date.UTC(2026, 0, 1))
    for (let i = 0; i < 800; i++, d = new Date(d.getTime() + 86400000)) {
      const k = d.toISOString().slice(0, 10)
      for (const p of ['jun30', 'dec31'] as const) { const r = nextCarTaxDate(p, k); expect(r >= k).toBe(true); expect(Number(r.slice(0, 4)) - Number(k.slice(0, 4))).toBeLessThanOrEqual(1) }
    }
  })
})
