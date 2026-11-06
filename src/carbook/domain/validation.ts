// 차량·기록·교체 항목·만기일 양식의 입력 검사(03_spec 1.3과 입력 표)를 순수 함수로 구현한 파일
import { addDays, isValidDateKey, today } from './dateKey'
import {
  MSG_05_REQUIRED, MSG_06_INTEGER, MSG_07_LITERS, MSG_08_YEAR, MSG_09_INTERVAL, MSG_15_DATE,
  MSG_16_TOO_LONG, MSG_17_TOO_BIG, MSG_19_LAST_ODOMETER, MSG_20_LAST_DATE_FUTURE, MSG_21_INTERVAL_FORMAT,
} from './messages'
import { RECORD_KINDS, type DateKey, type ItemInput, type RecordInput, type RecordKind, type VehicleInput } from './types'

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string }
export type FormResult<V, K extends string> = { ok: true; value: V } | { ok: false; errors: Partial<Record<K, string>> }

const MIN_DATE: DateKey = '1990-01-01'
const fmt = (n: number) => n.toLocaleString('en-US')
const len = (s: string) => Array.from(s).length // 글자 수는 코드 포인트 기준
const ok = <T,>(value: T): FieldResult<T> => ({ ok: true, value })
const fail = (error: string): FieldResult<never> => ({ ok: false, error })

// 정수 칸. 빈 값은 required에 따라 MSG-05 또는 null. min 미만·비정수는 MSG-06, max 초과는 MSG-17
export function parseInteger(raw: string, label: string, opts: { required?: boolean; min?: number; max: number; format?: (label: string) => string }): FieldResult<number | null> {
  const s = raw.trim()
  if (s === '') return opts.required ? fail(MSG_05_REQUIRED(label)) : ok(null)
  const formatMsg = opts.format ?? MSG_06_INTEGER
  if (!/^\d+$/.test(s)) return fail(formatMsg(label))
  const n = Number(s)
  if (n < (opts.min ?? 0)) return fail(formatMsg(label))
  if (n > opts.max) return fail(MSG_17_TOO_BIG(label, fmt(opts.max)))
  return ok(n)
}

// 주유량 칸. 소수 둘째 자리까지, 0~9,999.99
export function parseLiters(raw: string): FieldResult<number | null> {
  const s = raw.trim()
  if (s === '') return ok(null)
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return fail(MSG_07_LITERS)
  const n = Number(s)
  return n > 9999.99 ? fail(MSG_17_TOO_BIG('주유량', '9,999.99')) : ok(n)
}

// 문자열 칸. 앞뒤 공백을 지운 뒤 글자 수를 센다. 선택 칸의 빈 값은 null
export function parseText(raw: string, label: string, opts: { required?: boolean; max: number }): FieldResult<string | null> {
  const s = raw.trim()
  if (s === '') return opts.required ? fail(MSG_05_REQUIRED(label)) : ok(null)
  return len(s) > opts.max ? fail(MSG_16_TOO_LONG(label, opts.max)) : ok(s)
}

// 날짜 칸. 형식·존재 오류와 범위 밖은 MSG-15, 빈 값은 MSG-05
export function parseDate(raw: string, label: string, max: DateKey): FieldResult<DateKey> {
  const s = raw.trim()
  if (s === '') return fail(MSG_05_REQUIRED(label))
  if (!isValidDateKey(s) || s < MIN_DATE || s > max) return fail(MSG_15_DATE(label))
  return ok(s)
}

// 폼 결과를 모으는 도우미. 오류가 하나라도 있으면 값을 버리고 칸별 오류만 돌려준다
function collect<V, K extends string>(checks: { [P in K]: FieldResult<unknown> }, build: () => V): FormResult<V, K> {
  const errors: Partial<Record<K, string>> = {}
  for (const k of Object.keys(checks) as K[]) {
    const r = checks[k]
    if (!r.ok) errors[k] = r.error
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: build() }
}

export interface VehicleRaw { name: string; model: string; year: string; plate: string; odometer: string }
export type VehicleField = 'name' | 'model' | 'year' | 'plate' | 'odometer'

export function validateVehicle(raw: VehicleRaw): FormResult<VehicleInput, VehicleField> {
  const maxYear = Number(today().slice(0, 4)) + 1
  const yearRaw = raw.year.trim()
  const yearNum = /^\d+$/.test(yearRaw) ? Number(yearRaw) : NaN
  const year: FieldResult<number | null> =
    yearRaw === '' ? ok(null) : yearNum >= 1950 && yearNum <= maxYear ? ok(yearNum) : fail(MSG_08_YEAR(maxYear))
  const c = {
    name: parseText(raw.name, '별칭', { required: true, max: 20 }),
    model: parseText(raw.model, '차종', { max: 30 }),
    year,
    plate: parseText(raw.plate, '번호판', { max: 15 }),
    odometer: parseInteger(raw.odometer, '현재 주행거리', { max: 9_999_999 }),
  }
  return collect<VehicleInput, VehicleField>(c, () => ({
    name: val(c.name) as string, model: val(c.model), year: val(c.year), plate: val(c.plate), odometerKm: val(c.odometer),
  }))
}

export interface RecordRaw { kind: string; date: string; amount: string; odometer: string; liters: string; fullTank: boolean; memo: string }
export type RecordField = 'kind' | 'date' | 'amount' | 'odometer' | 'liters' | 'memo'

export function validateRecord(raw: RecordRaw): FormResult<RecordInput, RecordField> {
  const isKind = (RECORD_KINDS as readonly string[]).includes(raw.kind)
  const isFuel = raw.kind === 'fuel'
  const c = {
    kind: isKind ? ok(raw.kind as RecordKind) : fail(MSG_05_REQUIRED('종류')),
    date: parseDate(raw.date, '날짜', addDays(today(), 365)),
    amount: parseInteger(raw.amount, '금액', { required: true, max: 999_999_999 }),
    odometer: parseInteger(raw.odometer, '주행거리', { max: 9_999_999 }),
    liters: isFuel ? parseLiters(raw.liters) : ok(null), // 주유가 아니면 주유량 칸은 검사도 저장도 하지 않는다(BR-10)
    memo: parseText(raw.memo, '메모', { max: 200 }),
  }
  return collect<RecordInput, RecordField>(c, () => ({
    kind: val(c.kind) as RecordKind, date: val(c.date) as DateKey, amountWon: val(c.amount) as number, odometerKm: val(c.odometer),
    liters: val(c.liters), fullTank: isFuel && raw.fullTank, memo: val(c.memo),
  }))
}

export interface ItemRaw { name: string; intervalKm: string; intervalMonths: string; lastDate: string; lastOdometer: string }
// interval: km·개월이 모두 빈 경우의 MSG-09(양식에서 두 주기 칸 묶음 아래에 보인다)
export type ItemField = 'name' | 'intervalKm' | 'intervalMonths' | 'interval' | 'lastDate' | 'lastOdometer'

export function validateItem(raw: ItemRaw): FormResult<ItemInput, ItemField> {
  const t = today()
  const kmEmpty = raw.intervalKm.trim() === ''
  const monthsEmpty = raw.intervalMonths.trim() === ''
  const lastDate = parseDate(raw.lastDate, '마지막 교체일', t)
  // 오늘보다 뒤인 날짜는 형식은 맞으므로 MSG-20으로 따로 알린다
  const futureDate = lastDate.ok === false && isValidDateKey(raw.lastDate.trim()) && raw.lastDate.trim() > t
  const lastOdoRaw = raw.lastOdometer.trim()
  const lastOdo = parseInteger(raw.lastOdometer, '마지막 교체 주행거리', { max: 9_999_999 })
  const intervalKm = parseInteger(raw.intervalKm, 'km 주기', { min: 1, max: 999_999, format: MSG_21_INTERVAL_FORMAT })
  const c = {
    name: parseText(raw.name, '이름', { required: true, max: 30 }),
    intervalKm,
    intervalMonths: parseInteger(raw.intervalMonths, '개월 주기', { min: 1, max: 600, format: MSG_21_INTERVAL_FORMAT }),
    interval: kmEmpty && monthsEmpty ? fail(MSG_09_INTERVAL) : ok(null),
    lastDate: futureDate ? fail(MSG_20_LAST_DATE_FUTURE) : lastDate,
    lastOdometer: intervalKm.ok && intervalKm.value !== null && lastOdoRaw === '' ? fail(MSG_19_LAST_ODOMETER) : lastOdo,
  }
  return collect<ItemInput, ItemField>(c, () => ({
    name: val(c.name) as string, intervalKm: val(c.intervalKm), intervalMonths: val(c.intervalMonths),
    lastDate: val(c.lastDate) as DateKey, lastOdometerKm: val(c.lastOdometer),
  }))
}

export function validateDueDate(raw: string): FieldResult<DateKey> {
  return parseDate(raw, '만기일', addDays(today(), 3650))
}

function val<T>(r: FieldResult<T>): T {
  if (!r.ok) throw new Error('unreachable: validated')
  return r.value
}
