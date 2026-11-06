// MPR-20 QA 임시 스크립트: 입력 검사 AC를 정상·경계·실패로 확인한다. npm test에는 포함되지 않는다(실행 명령은 docs/qa/report.md).
import { describe, expect, it } from 'vitest'
import { validateVehicle, validateRecord, validateItem, validateDueDate, parseInteger, parseLiters } from '../../../src/carbook/domain/validation'
import { addDays, today } from '../../../src/carbook/domain/dateKey'
import * as M from '../../../src/carbook/domain/messages'

const Y = Number(today().slice(0, 4))
const v = (o: Partial<Parameters<typeof validateVehicle>[0]> = {}) => validateVehicle({ name: '내 차', model: '', year: '', plate: '', odometer: '', ...o })
const r = (o: Partial<Parameters<typeof validateRecord>[0]> = {}) => validateRecord({ kind: 'fuel', date: today(), amount: '50000', odometer: '', liters: '', fullTank: false, memo: '', ...o })
const it_ = (o: Partial<Parameters<typeof validateItem>[0]> = {}) => validateItem({ name: '엔진오일', intervalKm: '10000', intervalMonths: '12', lastDate: today(), lastOdometer: '10000', ...o })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errs = (x: any) => (x.ok ? {} : x.errors)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const derr = (x: any) => (x.ok ? null : x.error)

describe('AC-03-3 / AC-10-4 차량', () => {
  it('별칭 비움 → MSG-05(별칭), 저장값 없음', () => { const x = v({ name: '' }); expect(x.ok).toBe(false); expect(errs(x).name).toBe(M.MSG_05_REQUIRED('별칭')) })
  it('공백만 있는 별칭 → MSG-05', () => expect(errs(v({ name: '   ' })).name).toBe(M.MSG_05_REQUIRED('별칭')))
  it('연식 1949 → MSG-08', () => expect(errs(v({ year: '1949' })).year).toBe(M.MSG_08_YEAR(Y + 1)))
  it('연식 올해+2 → MSG-08', () => expect(errs(v({ year: String(Y + 2) })).year).toBe(M.MSG_08_YEAR(Y + 1)))
  it('연식 1950·올해+1 통과', () => { expect(v({ year: '1950' }).ok).toBe(true); expect(v({ year: String(Y + 1) }).ok).toBe(true) })
  it('연식 문자·소수 → MSG-08', () => { expect(errs(v({ year: 'abc' })).year).toBeTruthy(); expect(errs(v({ year: '2020.5' })).year).toBeTruthy() })
  it('별칭 20자 통과, 21자 MSG-16', () => { expect(v({ name: 'a'.repeat(20) }).ok).toBe(true); expect(errs(v({ name: 'a'.repeat(21) })).name).toBe(M.MSG_16_TOO_LONG('별칭', 20)) })
  it('빈 선택 칸은 null, 정상 값은 그대로', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const x: any = v({ year: '2022', odometer: '10500', plate: '12가3456' })
    expect(x.value).toMatchObject({ name: '내 차', model: null, year: 2022, plate: '12가3456', odometerKm: 10500 })
  })
  it('주행거리 -1·문자 → MSG-06, 10,000,000 → MSG-17, 9,999,999 통과', () => {
    expect(errs(v({ odometer: '-1' })).odometer).toBe(M.MSG_06_INTEGER('현재 주행거리'))
    expect(errs(v({ odometer: 'abc' })).odometer).toBe(M.MSG_06_INTEGER('현재 주행거리'))
    expect(errs(v({ odometer: '10000000' })).odometer).toBe(M.MSG_17_TOO_BIG('현재 주행거리', '9,999,999'))
    expect(v({ odometer: '9999999' }).ok).toBe(true)
  })
})

describe('AC-04-4 / AC-04-5 / AC-10-3 기록', () => {
  it('금액 비움 → "금액을(를) 입력해 주세요"', () => expect(errs(r({ amount: '' })).amount).toBe('금액을(를) 입력해 주세요'))
  it('날짜 비움 → MSG-05(날짜), 종류 없음 → MSG-05(종류)', () => {
    expect(errs(r({ date: '' })).date).toBe(M.MSG_05_REQUIRED('날짜'))
    expect(errs(r({ kind: '' })).kind).toBe(M.MSG_05_REQUIRED('종류'))
  })
  it('금액 -100 · 12.5 → MSG-06', () => {
    expect(errs(r({ amount: '-100' })).amount).toBe(M.MSG_06_INTEGER('금액'))
    expect(errs(r({ amount: '12.5' })).amount).toBe(M.MSG_06_INTEGER('금액'))
  })
  it('주유량 abc → MSG-07, 10000 → MSG-17 정확한 문구', () => {
    expect(errs(r({ liters: 'abc' })).liters).toBe(M.MSG_07_LITERS)
    expect(errs(r({ liters: '10000' })).liters).toBe('주유량은(는) 9,999.99 이하로 입력해 주세요')
  })
  it('주유량 경계: 9999.99 통과, 38.456 MSG-07, -1 MSG-07, 0 통과', () => {
    expect(r({ liters: '9999.99' }).ok).toBe(true)
    expect(errs(r({ liters: '38.456' })).liters).toBe(M.MSG_07_LITERS)
    expect(errs(r({ liters: '-1' })).liters).toBe(M.MSG_07_LITERS)
    expect(r({ liters: '0' }).ok).toBe(true)
  })
  it('금액 경계: 0 통과, 999,999,999 통과, 1,000,000,000 MSG-17', () => {
    expect(r({ amount: '0' }).ok).toBe(true)
    expect(r({ amount: '999999999' }).ok).toBe(true)
    expect(errs(r({ amount: '1000000000' })).amount).toBe(M.MSG_17_TOO_BIG('금액', '999,999,999'))
  })
  it('주유가 아니면 주유량 무시·저장 안 함(BR-10)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const x: any = r({ kind: 'wash', liters: 'abc', fullTank: true })
    expect(x.ok).toBe(true)
    expect(x.value.liters).toBeNull()
    expect(x.value.fullTank).toBe(false)
  })
  it('주유 정상 값', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const x: any = r({ liters: '38.45', fullTank: true, odometer: '10500', memo: '메모' })
    expect(x.value).toMatchObject({ kind: 'fuel', amountWon: 50000, liters: 38.45, fullTank: true, odometerKm: 10500, memo: '메모' })
  })
  it('메모 200자 통과·201자 MSG-16', () => {
    expect(r({ memo: 'a'.repeat(200) }).ok).toBe(true)
    expect(errs(r({ memo: 'a'.repeat(201) })).memo).toBe(M.MSG_16_TOO_LONG('메모', 200))
  })
  it('여러 칸 오류를 한 번에 돌려준다', () => expect(Object.keys(errs(r({ amount: '', date: '' }))).sort()).toEqual(['amount', 'date']))
  it('날짜: 오늘+365 통과, +366 MSG-15, 1989-12-31 MSG-15, 1990-01-01 통과', () => {
    expect(r({ date: addDays(today(), 365) }).ok).toBe(true)
    expect(errs(r({ date: addDays(today(), 366) })).date).toBe(M.MSG_15_DATE('날짜'))
    expect(errs(r({ date: '1989-12-31' })).date).toBe(M.MSG_15_DATE('날짜'))
    expect(r({ date: '1990-01-01' }).ok).toBe(true)
  })
})

describe('AC-06-9 / AC-06-14 / AC-10-5 교체 항목', () => {
  it('km·개월 모두 비움 → MSG-09', () => expect(errs(it_({ intervalKm: '', intervalMonths: '' })).interval).toBe(M.MSG_09_INTERVAL))
  it('km 주기 있고 마지막 교체 주행거리 비면 MSG-19', () => expect(errs(it_({ lastOdometer: '' })).lastOdometer).toBe(M.MSG_19_LAST_ODOMETER))
  it('개월 주기만 있으면 마지막 교체 주행거리 비어도 통과', () => expect(it_({ intervalKm: '', lastOdometer: '' }).ok).toBe(true))
  it('마지막 교체일 내일 → MSG-20, 오늘 통과', () => {
    expect(errs(it_({ lastDate: addDays(today(), 1) })).lastDate).toBe(M.MSG_20_LAST_DATE_FUTURE)
    expect(it_({ lastDate: today() }).ok).toBe(true)
  })
  it('마지막 교체일 비움 MSG-05, 형식 오류 MSG-15', () => {
    expect(errs(it_({ lastDate: '' })).lastDate).toBe(M.MSG_05_REQUIRED('마지막 교체일'))
    expect(errs(it_({ lastDate: '2026-13-01' })).lastDate).toBe(M.MSG_15_DATE('마지막 교체일'))
  })
  it('주기 형식: 0·소수·문자·음수 → MSG-21, 상한 초과 MSG-17, 상한 통과', () => {
    for (const bad of ['0', '1.5', 'abc', '-3']) expect(errs(it_({ intervalKm: bad })).intervalKm).toBe(M.MSG_21_INTERVAL_FORMAT('km 주기'))
    expect(errs(it_({ intervalMonths: '601' })).intervalMonths).toBe(M.MSG_17_TOO_BIG('개월 주기', '600'))
    expect(it_({ intervalMonths: '600', intervalKm: '999999' }).ok).toBe(true)
  })
  it('이름 비움 MSG-05, 31자 MSG-16', () => {
    expect(errs(it_({ name: '' })).name).toBe(M.MSG_05_REQUIRED('이름'))
    expect(errs(it_({ name: 'a'.repeat(31) })).name).toBe(M.MSG_16_TOO_LONG('이름', 30))
  })
})

describe('AC-07-4 만기일', () => {
  it('비움 → MSG-05', () => expect(derr(validateDueDate(''))).toBe(M.MSG_05_REQUIRED('만기일')))
  it('2027-02-30 → MSG-15', () => expect(derr(validateDueDate('2027-02-30'))).toBe(M.MSG_15_DATE('만기일')))
  it('정상·경계: 2027-03-10 통과, 오늘+3650 통과, +3651 MSG-15, 형식 오류 MSG-15', () => {
    expect(validateDueDate('2027-03-10').ok).toBe(true)
    expect(validateDueDate(addDays(today(), 3650)).ok).toBe(true)
    expect(derr(validateDueDate(addDays(today(), 3651)))).toBe(M.MSG_15_DATE('만기일'))
    expect(derr(validateDueDate('2027/03/10'))).toBe(M.MSG_15_DATE('만기일'))
  })
})

describe('AC-10-3 헬퍼', () => {
  it('parseInteger 빈칸: 필수 MSG-05, 선택 null', () => {
    expect(parseInteger('', '금액', { required: true, max: 9 })).toEqual({ ok: false, error: M.MSG_05_REQUIRED('금액') })
    expect(parseInteger(' ', '금액', { max: 9 })).toEqual({ ok: true, value: null })
  })
  it('parseLiters 빈칸 null', () => expect(parseLiters('')).toEqual({ ok: true, value: null }))
})
