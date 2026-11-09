// 차계부 테이블 4개(vehicles·car_records·car_maintenance_items·car_due_dates)의 CRUD와 행↔도메인 변환
import { supabase } from '../../lib/supabaseClient'
import type { CarRecord, DateKey, DueDate, DueKind, ItemInput, MaintenanceItem, RecordInput, Vehicle, VehicleInput } from '../domain/types'
import { CarbookError, request } from './request'

type Row = Record<string, unknown>
const PAGE = 1000
const VEHICLE_COLS = 'id,name,model,year,plate,odometer_km,created_at'
const RECORD_COLS = 'id,vehicle_id,kind,date,amount_won,odometer_km,liters,full_tank,memo,created_at'
const ITEM_COLS = 'id,vehicle_id,name,interval_km,interval_months,last_date,last_odometer_km,event_id,created_at'
const DUE_COLS = 'id,vehicle_id,kind,due_date,event_id,created_at'

export type ItemRowInput = ItemInput & { eventId: string | null } // 생성(createItems) 전용. 수정은 ItemInput만

const toVehicle = (r: Row): Vehicle => ({
  id: r.id as string, name: r.name as string, model: r.model as string | null, year: r.year as number | null,
  plate: r.plate as string | null, odometerKm: r.odometer_km as number | null, createdAt: r.created_at as string,
})
const toRecord = (r: Row): CarRecord => ({
  id: r.id as string, vehicleId: r.vehicle_id as string, kind: r.kind as CarRecord['kind'], date: r.date as DateKey,
  amountWon: r.amount_won as number, odometerKm: r.odometer_km as number | null, liters: r.liters as number | null,
  fullTank: r.full_tank as boolean, memo: r.memo as string | null, createdAt: r.created_at as string,
})
const toItem = (r: Row): MaintenanceItem => ({
  id: r.id as string, vehicleId: r.vehicle_id as string, name: r.name as string, intervalKm: r.interval_km as number | null,
  intervalMonths: r.interval_months as number | null, lastDate: r.last_date as DateKey, lastOdometerKm: r.last_odometer_km as number | null,
  eventId: r.event_id as string | null, createdAt: r.created_at as string,
})
const toDue = (r: Row): DueDate => ({
  id: r.id as string, vehicleId: r.vehicle_id as string, kind: r.kind as DueKind, dueDate: r.due_date as DateKey,
  eventId: r.event_id as string | null, createdAt: r.created_at as string,
})

const empty = (s: string | null) => (s === '' ? null : s) // 빈 문자열은 null로 보낸다
const vehicleCols = (v: VehicleInput) => ({ name: v.name, model: empty(v.model), year: v.year, plate: empty(v.plate), odometer_km: v.odometerKm })
const recordCols = (r: RecordInput) => {
  const fuel = r.kind === 'fuel' // 주유가 아니면 주유량·가득 여부는 항상 비운다(BR-10)
  return { kind: r.kind, date: r.date, amount_won: r.amountWon, odometer_km: r.odometerKm, liters: fuel ? r.liters : null, full_tank: fuel && r.fullTank, memo: empty(r.memo) }
}
const itemCols = (i: ItemInput) => ({
  name: i.name, interval_km: i.intervalKm, interval_months: i.intervalMonths, last_date: i.lastDate, last_odometer_km: i.lastOdometerKm,
})

function client() {
  if (!supabase) throw new CarbookError('unknown', 'no_client')
  return supabase
}

const notFound = () => new CarbookError('unknown', 'not_found')

type Result<D> = PromiseLike<{ data: D | null; error: { code?: string; message?: string } | null; status?: number }>
const from = (table: string) => client().from(table)

// 1,000행씩 .range()로 이어 읽고 id로 중복을 지운다(PostgREST 기본 상한 대응). 정렬 끝에 id를 붙인다
async function readAll<T extends { id: string }>(
  action: string, table: string, cols: string, order: [string, boolean][], map: (r: Row) => T, vehicleId?: string,
): Promise<T[]> {
  const byId = new Map<string, T>()
  for (let start = 0; ; start += PAGE) {
    const rows = await request<Row[]>(action, (signal) => {
      let q = from(table).select(cols)
      if (vehicleId) q = q.eq('vehicle_id', vehicleId)
      for (const [col, asc] of [...order, ['id', order[0][1]] as [string, boolean]]) q = q.order(col, { ascending: asc })
      return q.range(start, start + PAGE - 1).retry(false).abortSignal(signal) as Result<Row[]>
    })
    for (const r of rows ?? []) byId.set(r.id as string, map(r))
    if ((rows ?? []).length < PAGE) return [...byId.values()]
  }
}

export const listVehicles = () => readAll('listVehicles', 'vehicles', VEHICLE_COLS, [['created_at', true]], toVehicle)
export const listItems = () => readAll('listItems', 'car_maintenance_items', ITEM_COLS, [['created_at', true]], toItem)
export const listDueDates = () => readAll('listDueDates', 'car_due_dates', DUE_COLS, [['created_at', true]], toDue)
export const listRecords = (vehicleId: string) =>
  readAll('listRecords', 'car_records', RECORD_COLS, [['date', false], ['created_at', false]], toRecord, vehicleId)

// 쓰기 결과 한 행을 도메인으로. 0행이면 not_found
async function one<T>(action: string, map: (r: Row) => T, build: (signal: AbortSignal) => Result<Row>): Promise<T> {
  const row = await request<Row | null>(action, build)
  if (!row) throw notFound()
  return map(row)
}

async function del(action: string, table: string, id: string): Promise<void> {
  await request(action, (signal) => from(table).delete().eq('id', id).abortSignal(signal) as Result<null>)
}

export const createVehicle = (id: string, input: VehicleInput) =>
  one('createVehicle', toVehicle, (s) => from('vehicles').upsert({ id, ...vehicleCols(input) }, { onConflict: 'id' }).select(VEHICLE_COLS).abortSignal(s).single())
export const updateVehicle = (id: string, input: VehicleInput) =>
  one('updateVehicle', toVehicle, (s) => from('vehicles').update(vehicleCols(input)).eq('id', id).select(VEHICLE_COLS).abortSignal(s).maybeSingle())
export const deleteVehicle = (id: string) => del('deleteVehicle', 'vehicles', id)

export const createRecord = (id: string, vehicleId: string, input: RecordInput) =>
  one('createRecord', toRecord, (s) => from('car_records').upsert({ id, vehicle_id: vehicleId, ...recordCols(input) }, { onConflict: 'id' }).select(RECORD_COLS).abortSignal(s).single())
export const updateRecord = (id: string, input: RecordInput) =>
  one('updateRecord', toRecord, (s) => from('car_records').update(recordCols(input)).eq('id', id).select(RECORD_COLS).abortSignal(s).maybeSingle())
export const deleteRecord = (id: string) => del('deleteRecord', 'car_records', id)

// 추천 7행처럼 여러 행을 한 번에 넣는다. created_at을 1ms씩 늘려 보내 보낸 순서가 목록 순서가 되게 한다
export async function createItems(vehicleId: string, rows: Array<{ id: string } & ItemRowInput>): Promise<MaintenanceItem[]> {
  const base = Date.now()
  const payload = rows.map((r, i) => ({
    id: r.id, vehicle_id: vehicleId, ...itemCols(r), event_id: r.eventId, created_at: new Date(base + i).toISOString(),
  }))
  const out = await request<Row[]>('createItems', (s) => from('car_maintenance_items').upsert(payload, { onConflict: 'id' }).select(ITEM_COLS).abortSignal(s) as Result<Row[]>)
  return (out ?? []).map(toItem)
}

// event_id 선점: 비어 있을 때만 claimEventId를 채우고(결과 행 수는 보지 않음), 나머지 열을 갱신한다. 돌려받은 행의 eventId가 정본
async function claimThenUpdate<T>(
  action: string, table: string, id: string, claimEventId: string | undefined, map: (r: Row) => T, update: (signal: AbortSignal) => Result<Row>,
): Promise<T> {
  if (claimEventId) {
    await request(`${action}.claim`, (s) => from(table).update({ event_id: claimEventId }).eq('id', id).is('event_id', null).abortSignal(s) as Result<null>)
  }
  return one(action, map, update)
}

export const updateItem = (id: string, input: ItemInput, claimEventId?: string) =>
  claimThenUpdate('updateItem', 'car_maintenance_items', id, claimEventId, toItem, (s) =>
    from('car_maintenance_items').update(itemCols(input)).eq('id', id).select(ITEM_COLS).abortSignal(s).maybeSingle())

// BR-06a: 마지막 교체 주행거리가 빈 항목만 채운다. 바뀐 행만 돌려준다
export async function fillMissingItemOdometer(vehicleId: string, odometerKm: number): Promise<MaintenanceItem[]> {
  const out = await request<Row[]>('fillMissingItemOdometer', (s) =>
    from('car_maintenance_items').update({ last_odometer_km: odometerKm }).eq('vehicle_id', vehicleId).is('last_odometer_km', null).select(ITEM_COLS).abortSignal(s) as Result<Row[]>)
  return (out ?? []).map(toItem)
}
export const deleteItem = (id: string) => del('deleteItem', 'car_maintenance_items', id)

// 만기일 생성은 upsert가 아니라 insert: 같은 차량·종류 두 번째 저장을 23505(conflict)로 드러낸다
export const createDueDate = (row: { id: string; vehicleId: string; kind: DueKind; dueDate: DateKey; eventId: string }) =>
  one('createDueDate', toDue, (s) =>
    from('car_due_dates').insert({ id: row.id, vehicle_id: row.vehicleId, kind: row.kind, due_date: row.dueDate, event_id: row.eventId }).select(DUE_COLS).abortSignal(s).single())
export const updateDueDate = (id: string, dueDate: DateKey, claimEventId?: string) =>
  claimThenUpdate('updateDueDate', 'car_due_dates', id, claimEventId, toDue, (s) =>
    from('car_due_dates').update({ due_date: dueDate }).eq('id', id).select(DUE_COLS).abortSignal(s).maybeSingle())
export const deleteDueDate = (id: string) => del('deleteDueDate', 'car_due_dates', id)

// 차량 삭제 중 연결 일정을 지울 때마다 호출한다(BR-22)
export const clearEventId = (table: 'item' | 'due', id: string) =>
  request('clearEventId', (s) => from(table === 'item' ? 'car_maintenance_items' : 'car_due_dates').update({ event_id: null }).eq('id', id).abortSignal(s) as Result<null>).then(() => undefined)
