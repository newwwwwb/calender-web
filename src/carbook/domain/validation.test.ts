// 입력 검사(차량·기록·교체 항목·만기일)의 AC-03-3, 04-4, 04-5, 06-9, 06-14, 07-4, 10-3~5 테스트
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateDueDate, validateItem, validateRecord, validateVehicle, type ItemRaw, type RecordRaw, type VehicleRaw } from './validation'

const vehicle = (o: Partial<VehicleRaw> = {}): VehicleRaw => ({ name: '출퇴근', model: '', year: '', plate: '', odometer: '', ...o })
const record = (o: Partial<RecordRaw> = {}): RecordRaw => ({ kind: 'other', date: '2026-11-05', amount: '1000', odometer: '', liters: '', fullTank: false, memo: '', ...o })
const item = (o: Partial<ItemRaw> = {}): ItemRaw => ({ name: '엔진오일', intervalKm: '', intervalMonths: '12', lastDate: '2026-11-05', lastOdometer: '', ...o })
const errs = (r: { ok: boolean; errors?: object }) => (r.ok ? {} : r.errors)

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 5, 12)) })
afterEach(() => { vi.useRealTimers() })

describe('validateVehicle', () => {
  it('별칭만 있으면 통과하고 빈 선택 칸은 null이다', () => {
    expect(validateVehicle(vehicle())).toEqual({ ok: true, value: { name: '출퇴근', model: null, year: null, plate: null, odometerKm: null } })
  })

  it('앞뒤 공백을 지운다', () => {
    const r = validateVehicle(vehicle({ name: '  가족  ', odometer: ' 12345 ' }))
    expect(r).toMatchObject({ ok: true, value: { name: '가족', odometerKm: 12345 } })
  })

  it('별칭이 비거나 공백뿐이면 MSG-05(AC-03-3)', () => {
    expect(errs(validateVehicle(vehicle({ name: '   ' })))).toEqual({ name: '별칭을(를) 입력해 주세요' })
  })

  it('연식 1949·올해+2는 MSG-08, 1950·올해+1은 통과(AC-10-4)', () => {
    const msg = '연식은 1950부터 2027 사이로 입력해 주세요'
    expect(errs(validateVehicle(vehicle({ year: '1949' })))).toEqual({ year: msg })
    expect(errs(validateVehicle(vehicle({ year: '2028' })))).toEqual({ year: msg })
    expect(errs(validateVehicle(vehicle({ year: 'abc' })))).toEqual({ year: msg })
    expect(validateVehicle(vehicle({ year: '1950' })).ok).toBe(true)
    expect(validateVehicle(vehicle({ year: '2027' })).ok).toBe(true)
  })

  it('글자 수 초과는 MSG-16, 20자 별칭은 통과', () => {
    expect(errs(validateVehicle(vehicle({ name: 'a'.repeat(21), model: 'b'.repeat(31), plate: 'c'.repeat(16) })))).toEqual({
      name: '별칭은(는) 20자 이하로 입력해 주세요', model: '차종은(는) 30자 이하로 입력해 주세요', plate: '번호판은(는) 15자 이하로 입력해 주세요',
    })
    expect(validateVehicle(vehicle({ name: '가'.repeat(20) })).ok).toBe(true)
  })

  it('주행거리 음수는 MSG-06, 상한 초과는 MSG-17', () => {
    expect(errs(validateVehicle(vehicle({ odometer: '-1' })))).toEqual({ odometer: '현재 주행거리은(는) 0 이상의 정수로 입력해 주세요' })
    expect(errs(validateVehicle(vehicle({ odometer: '10000000' })))).toEqual({ odometer: '현재 주행거리은(는) 9,999,999 이하로 입력해 주세요' })
  })
})

describe('validateRecord', () => {
  it('종류·날짜·금액만으로 통과한다', () => {
    expect(validateRecord(record())).toEqual({
      ok: true, value: { kind: 'other', date: '2026-11-05', amountWon: 1000, odometerKm: null, liters: null, fullTank: false, memo: null },
    })
  })

  it('금액을 비우면 MSG-05(AC-04-4)', () => {
    expect(errs(validateRecord(record({ amount: '' })))).toEqual({ amount: '금액을(를) 입력해 주세요' })
  })

  it('날짜·종류가 비어도 MSG-05(AC-04-4)', () => {
    expect(errs(validateRecord(record({ kind: '', date: '' })))).toEqual({ kind: '종류을(를) 입력해 주세요', date: '날짜을(를) 입력해 주세요' })
  })

  it('금액 -100·12.5는 MSG-06, 주유량 abc는 MSG-07(AC-04-5)', () => {
    expect(errs(validateRecord(record({ amount: '-100' })))).toHaveProperty('amount', '금액은(는) 0 이상의 정수로 입력해 주세요')
    expect(errs(validateRecord(record({ amount: '12.5' })))).toHaveProperty('amount', '금액은(는) 0 이상의 정수로 입력해 주세요')
    expect(errs(validateRecord(record({ kind: 'fuel', liters: 'abc' })))).toEqual({ liters: '주유량은 0 이상의 숫자(소수 둘째 자리까지)로 입력해 주세요' })
  })

  it('주유량 소수 셋째 자리·상한 초과는 실패, 둘째 자리는 통과', () => {
    expect(validateRecord(record({ kind: 'fuel', liters: '12.345' })).ok).toBe(false)
    expect(errs(validateRecord(record({ kind: 'fuel', liters: '10000' })))).toEqual({ liters: '주유량은(는) 9,999.99 이하로 입력해 주세요' })
    expect(validateRecord(record({ kind: 'fuel', liters: '35.25', fullTank: true }))).toMatchObject({ ok: true, value: { liters: 35.25, fullTank: true } })
  })

  it('주유가 아니면 주유량·가득 여부를 저장하지 않고 검사하지도 않는다(BR-10)', () => {
    expect(validateRecord(record({ kind: 'wash', liters: 'abc', fullTank: true }))).toMatchObject({ ok: true, value: { liters: null, fullTank: false } })
  })

  it('날짜는 오늘+365일까지, 없는 날짜·1990 이전은 MSG-15', () => {
    expect(validateRecord(record({ date: '2027-11-05' })).ok).toBe(true)
    expect(errs(validateRecord(record({ date: '2027-11-06' })))).toEqual({ date: '날짜을(를) 올바른 날짜로 입력해 주세요' })
    expect(validateRecord(record({ date: '1989-12-31' })).ok).toBe(false)
    expect(validateRecord(record({ date: '2026-02-30' })).ok).toBe(false)
  })

  it('금액 상한 초과는 MSG-17, 메모 201자는 MSG-16', () => {
    expect(errs(validateRecord(record({ amount: '1000000000', memo: 'm'.repeat(201) })))).toEqual({
      amount: '금액은(는) 999,999,999 이하로 입력해 주세요', memo: '메모은(는) 200자 이하로 입력해 주세요',
    })
  })
})

describe('validateItem', () => {
  it('개월 주기만 있어도 통과한다', () => {
    expect(validateItem(item())).toEqual({
      ok: true, value: { name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: '2026-11-05', lastOdometerKm: null },
    })
  })

  it('km·개월을 모두 비우면 MSG-09(AC-06-9, AC-10-5)', () => {
    expect(errs(validateItem(item({ intervalMonths: '' })))).toEqual({ interval: '교체 주기는 km 또는 개월 중 하나 이상 입력해 주세요' })
  })

  it('km 주기가 있는데 마지막 교체 주행거리가 비면 MSG-19(AC-06-9)', () => {
    expect(errs(validateItem(item({ intervalKm: '10000' })))).toEqual({ lastOdometer: '마지막 교체 주행거리를 입력해 주세요' })
    expect(validateItem(item({ intervalKm: '10000', lastOdometer: '40000' }))).toMatchObject({ ok: true, value: { intervalKm: 10000, lastOdometerKm: 40000 } })
  })

  it('km 주기가 형식 오류면 MSG-19는 겹치지 않는다', () => {
    expect(errs(validateItem(item({ intervalKm: 'abc' })))).toEqual({ intervalKm: 'km 주기은(는) 0 이상의 정수로 입력해 주세요' })
  })

  it('마지막 교체일이 내일이면 MSG-20, 오늘은 통과(AC-06-14)', () => {
    expect(errs(validateItem(item({ lastDate: '2026-11-06' })))).toEqual({ lastDate: '마지막 교체일은 오늘 또는 그 이전 날짜로 입력해 주세요' })
    expect(validateItem(item({ lastDate: '2026-11-05' })).ok).toBe(true)
  })

  it('마지막 교체일 형식 오류는 MSG-15, 빈 값은 MSG-05', () => {
    expect(errs(validateItem(item({ lastDate: '2026-02-30' })))).toEqual({ lastDate: '마지막 교체일을(를) 올바른 날짜로 입력해 주세요' })
    expect(errs(validateItem(item({ lastDate: '' })))).toEqual({ lastDate: '마지막 교체일을(를) 입력해 주세요' })
  })

  it('주기 범위: km 0·개월 601은 실패, 경계값은 통과', () => {
    expect(validateItem(item({ intervalKm: '0', lastOdometer: '1' })).ok).toBe(false)
    expect(errs(validateItem(item({ intervalMonths: '601' })))).toEqual({ intervalMonths: '개월 주기은(는) 600 이하로 입력해 주세요' })
    expect(validateItem(item({ intervalMonths: '600' })).ok).toBe(true)
    expect(validateItem(item({ intervalKm: '999999', lastOdometer: '0' })).ok).toBe(true)
  })

  it('이름이 비거나 31자면 실패', () => {
    expect(errs(validateItem(item({ name: ' ' })))).toEqual({ name: '이름을(를) 입력해 주세요' })
    expect(errs(validateItem(item({ name: 'x'.repeat(31) })))).toEqual({ name: '이름은(는) 30자 이하로 입력해 주세요' })
  })
})

describe('validateDueDate', () => {
  it('유효한 날짜는 통과하고 오늘 이전도 허용한다', () => {
    expect(validateDueDate('2027-03-10')).toEqual({ ok: true, value: '2027-03-10' })
    expect(validateDueDate('2020-01-01').ok).toBe(true)
  })

  it('비우면 MSG-05, 2027-02-30은 MSG-15(AC-07-4)', () => {
    expect(validateDueDate('')).toEqual({ ok: false, error: '만기일을(를) 입력해 주세요' })
    expect(validateDueDate('2027-02-30')).toEqual({ ok: false, error: '만기일을(를) 올바른 날짜로 입력해 주세요' })
  })

  it('상한은 오늘+3650일', () => {
    expect(validateDueDate('2036-11-02').ok).toBe(true) // 2026-11-05 + 3650일
    expect(validateDueDate('2036-11-03').ok).toBe(false)
  })
})
