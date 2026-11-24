// 차계부 데이터 읽기·차량 선택·차량/기록/교체 항목/만기일 쓰기와 캘린더 연동을 조율하는 훅(화면이 쓰는 유일한 데이터 입구). 열 때 점검(카테고리 재묶기·없는 일정 재생성)도 한다
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCalendar } from '../../state/useCalendar'
import { useToast } from '../../state/useToast'
import * as api from '../data/carbookApi'
import { createCalendarLink, type ExistingEvent, type LinkedEventSpec } from '../data/calendarLink'
import { CarbookError } from '../data/request'
import { today } from '../domain/dateKey'
import { dailyAverageKm, currentOdometerKm } from '../domain/odometer'
import { economySegments } from '../domain/fuelEconomy'
import { buildRecommendedItems, evaluateItem, planRecommendedReset, sortItems } from '../domain/maintenance'
import { MSG_01_SAVE_FAILED, MSG_03_DELETE_FAILED, MSG_28_KM_BASIS_MEMO, MSG_31_EVENT_SAVED, MSG_32_SAVED } from '../domain/messages'
import { dueEventTitle, itemEventTitle } from '../domain/titles'
import type { CarRecord, DateKey, DueDate, DueDateView, DueKind, EconomySegment, ItemInput, ItemView, MaintenanceItem, RecordInput, ResetPlan, ResetResult, Vehicle, VehicleInput } from '../domain/types'

type LoadState = 'loading' | 'ready' | 'error'

export interface CarbookState {
  loadState: LoadState
  retryLoad(): void
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  selectVehicle(id: string): void
  recordsState: LoadState
  retryRecords(): void
  records: CarRecord[]
  currentOdometerKm: number
  items: ItemView[]
  dueDates: DueDateView[]
  economy: EconomySegment[]
  saveVehicle(input: VehicleInput, id?: string): Promise<boolean>
  deleteVehicle(id: string): Promise<boolean>
  saveRecord(input: RecordInput, id?: string): Promise<boolean>
  deleteRecord(id: string): Promise<boolean>
  saveItem(input: ItemInput, id?: string): Promise<boolean>
  completeItem(id: string, done: { date: DateKey; odometerKm: number | null }): Promise<boolean>
  deleteItem(id: string): Promise<boolean>
  saveDueDate(kind: DueKind, dueDate: DateKey): Promise<boolean>
  deleteDueDate(kind: DueKind): Promise<boolean>
  retryCalendar(target: { type: 'item' | 'due'; id: string }): Promise<void>
  defaultVehicleId: string | null // 계정에 저장된 기본 차량. 읽기 실패·미지정이면 null
  settingsFailed: boolean // 설정 읽기가 실패했다("지정 없음"과 구분, AC-19-13)
  setDefaultVehicle(id: string | null): Promise<boolean>
  resetPlan: ResetPlan // 선택 차량의 추천 되돌리기 미리 보기
  resetRecommended(): Promise<ResetResult | null> // 성공이면 결과, 바꿀 것이 없거나 실패·중복이면 null
  authExpired: boolean // 쓰기·삭제가 인증 만료(401)로 실패했다. 화면이 MSG-30 안내를 보인다
  dismissAuthExpired(): void
}

// BR-09: 날짜 내림차순, 같은 날은 먼저 만든 기록이 아래
const byRecordOrder = (a: CarRecord, b: CarRecord) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
// 일정 삭제의 401은 만료 안내가 아니라 삭제 실패(MSG-03)로 다룬다(행 쓰기만 authExpired, 6.3)
const asNonAuth = (e: unknown): never => { throw e instanceof CarbookError && e.kind === 'auth' ? new CarbookError('unknown', e.code) : e }
const mergeById = <T extends { id: string }>(list: T[], changed: T[]) => list.map((x) => changed.find((c) => c.id === x.id) ?? x)

// 연결 일정의 계산값(BR-20·21). 연결 id가 없으면 null이고, 항목은 다음 교체일을 구할 수 없을 때도 null이다(BR-23).
// 기록을 아직 못 읽었는데(ready 아님) 날짜가 km에 달린 항목이면 undefined: 판단할 수 없으므로 일정을 쓰지도 지우지도 않는다
function itemSpec(i: MaintenanceItem, vehicleName: string, km: number, avg: number | null, recordsReady: boolean): LinkedEventSpec | null | undefined {
  if (!recordsReady && i.intervalKm !== null && i.lastOdometerKm !== null) return undefined
  const ev = i.eventId ? evaluateItem(i, { today: today(), currentKm: km, avgKmPerDay: avg }) : null
  // memo는 km 기준으로 정한 날짜일 때만 MSG-28(BR-55)
  return i.eventId && ev?.nextDate ? { eventId: i.eventId, title: itemEventTitle(vehicleName, i.name), date: ev.nextDate, memo: ev.basis === 'km' ? MSG_28_KM_BASIS_MEMO : null } : null
}
const dueSpec = (d: DueDate, vehicleName: string): LinkedEventSpec | null =>
  d.eventId ? { eventId: d.eventId, title: dueEventTitle(vehicleName, d.kind), date: d.dueDate, memo: null } : null

export function useCarbook(userId: string): CarbookState {
  const { showToast } = useToast()
  const { reload } = useCalendar()
  const link = useMemo(() => createCalendarLink(userId), [userId])
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set()) // MSG-11 상태인 행(메모리에만 둔다)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [allItems, setAllItems] = useState<MaintenanceItem[]>([])
  const [allDues, setAllDues] = useState<DueDate[]>([])
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [defaultVehicleId, setDefaultId] = useState<string | null>(null)
  const [settingsFailed, setSettingsFailed] = useState(false)
  const [authExpired, setAuthExpired] = useState(false)
  const [recs, setRecs] = useState<{ vehicleId: string; list: CarRecord[]; state: LoadState }>({ vehicleId: '', list: [], state: 'loading' })
  const [loadTick, setLoadTick] = useState(0)
  const [recTick, setRecTick] = useState(0)
  const busy = useRef(new Set<string>())
  const checked = useRef(new Set<string>()) // 열 때 점검을 마친 행(같은 화면 수명에 행마다 한 번)
  const latestReconcile = useRef<() => Promise<void>>(async () => {})
  // BR-41: 고른 차량 ?? 기본 차량(목록에 있을 때) ?? 가장 먼저 만든 차량(차량이 없으면 null)
  const selectedId = vehicles.some((v) => v.id === pickedId) ? pickedId : vehicles.some((v) => v.id === defaultVehicleId) ? defaultVehicleId : (vehicles[0]?.id ?? null)

  // 처음 읽기: 차량·교체 항목·만기일·설정을 병렬로. 설정만 실패하면 지정 없음으로 진행하고 알린다(BR-43)
  useEffect(() => {
    let live = true
    Promise.all([api.listVehicles(), api.listItems(), api.listDueDates(), api.getSettings().catch(() => null)])
      .then(([v, i, d, s]) => {
        if (!live) return
        setVehicles(v); setAllItems(i); setAllDues(d)
        setDefaultId(s?.defaultVehicleId ?? null); setSettingsFailed(s === null)
        setLoadState('ready')
      })
      .catch(() => { if (live) setLoadState('error') })
    return () => { live = false }
  }, [loadTick])

  // 선택 차량의 기록 읽기
  useEffect(() => {
    if (loadState !== 'ready' || !selectedId) return
    let live = true
    api.listRecords(selectedId)
      .then((list) => { if (live) setRecs({ vehicleId: selectedId, list, state: 'ready' }) })
      .catch(() => { if (live) setRecs({ vehicleId: selectedId, list: [], state: 'error' }) })
    return () => { live = false }
  }, [loadState, selectedId, recTick])

  const vehicle = vehicles.find((v) => v.id === selectedId) ?? null
  const records = useMemo(() => (recs.vehicleId === selectedId ? recs.list : []), [recs, selectedId])
  const currentKm = currentOdometerKm(vehicle?.odometerKm ?? null, records)
  const items = useMemo<ItemView[]>(() => {
    const todayKey = today()
    const avg = dailyAverageKm(records, todayKey)
    return sortItems(allItems.filter((i) => i.vehicleId === selectedId).map((i) => ({ ...i, ...evaluateItem(i, { today: todayKey, currentKm, avgKmPerDay: avg }), calendarFailed: failedIds.has(i.id) })))
  }, [allItems, records, selectedId, currentKm, failedIds])
  const dueDates = useMemo<DueDateView[]>(() => allDues.filter((d) => d.vehicleId === selectedId).map((d) => ({ ...d, calendarFailed: failedIds.has(d.id) })), [allDues, selectedId, failedIds])
  // 선택 차량의 기록이 아직 도착하지 않았으면(차량을 막 바꿨으면) 불러오는 중이다. 차량이 없으면 읽을 것이 없다
  const recordsState: LoadState = loadState !== 'ready' ? 'loading' : !selectedId ? 'ready' : recs.vehicleId !== selectedId ? 'loading' : recs.state
  const economy = useMemo(() => economySegments(records), [records])

  // 저장 성공 안내(BR-59): 일정을 새로 쓴 때만 날짜를 알리고, 그 밖(변경 없음·삭제·계산 불가·일정 실패)은 짧은 안내다
  const showSaved = useCallback((spec: LinkedEventSpec | null) => showToast({ message: spec ? MSG_31_EVENT_SAVED(spec.date) : MSG_32_SAVED }), [showToast])

  // 쓰기 한 건: 같은 대상이 진행 중이면 요청 없이 false(토스트 없음). 실패는 토스트 후 false, 상태는 그대로
  const run = useCallback(async (key: string, failMessage: string, fn: () => Promise<void>): Promise<boolean> => {
    if (busy.current.has(key)) return false
    busy.current.add(key)
    try {
      await fn()
      return true
    } catch (e) {
      if (e instanceof CarbookError && e.kind === 'auth') { setAuthExpired(true); return false } // 만료는 토스트 대신 안내(ADR-008)
      showToast({ message: failMessage, tone: 'error' })
      if (e instanceof CarbookError && e.kind === 'conflict' && e.code === '23503') setLoadTick((n) => n + 1) // 다른 탭에서 차량이 지워짐
      return false
    } finally {
      busy.current.delete(key)
    }
  }, [showToast])

  // BR-06a: 마지막 교체 주행거리가 빈 km 항목이 있으면 알려진 주행거리로 채운다(일정은 만들지 않는다). 데이터로 판단하고 여러 번 불러도 안전하다.
  // 저장은 이미 끝났으므로 실패해도 삼키고, 다음 저장 때 다시 시도한다. 바뀐 행을 돌려준다
  const fillItems = useCallback(async (vehicleId: string, km: number | null): Promise<MaintenanceItem[]> => {
    if (km === null || !allItems.some((i) => i.vehicleId === vehicleId && i.intervalKm !== null && i.lastDate !== null && i.lastOdometerKm === null)) return [] // 미입력 항목은 채우지 않는다(BR-53)
    try {
      const changed = await api.fillMissingItemOdometer(vehicleId, km)
      if (changed.length > 0) setAllItems((cur) => mergeById(cur, changed))
      return changed
    } catch { return [] }
  }, [allItems])

  // 일정 한 건을 계산값에 맞춘다(BR-21). 실패는 토스트 없이 그 행의 calendarFailed로만 남기고, 일정을 실제로 쓰거나 지웠으면 true.
  // spec이 null이면(계산 불가, BR-23) 일정만 지우고 연결 id는 남긴다. known이 null이면 일정이 원래 없다는 뜻이다
  const applyEvent = useCallback(async (rowId: string, eventId: string | null, spec: LinkedEventSpec | null | undefined, known?: ExistingEvent | null, onFail?: () => void): Promise<boolean> => {
    if (!eventId || spec === undefined) return false
    const mark = (bad: boolean) => setFailedIds((cur) => { const next = new Set(cur); if (bad) next.add(rowId); else next.delete(rowId); return next })
    try {
      const wrote = spec ? (await link.syncEvent(spec, known)) === 'written' : known === null ? false : await link.deleteEvent(eventId)
      mark(false)
      return wrote
    } catch {
      mark(true)
      onFail?.()
      return false
    }
  }, [link])
  // 일정 쓰기가 1건 이상 있었으면 캘린더 화면을 한 번 다시 불러온다. 실패는 60초 폴링이 보정하므로 무시한다
  const refreshCalendar = useCallback(async (wrote: boolean) => { if (wrote) await reload().catch(() => {}) }, [reload])

  // BR-21 ③④: 기록·차량이 바뀐 뒤 그 차량의 연결 일정을 맞춘다. 일정을 한 번에 조회해 같으면 쓰지 않는다
  const syncLinked = useCallback(async (v: Vehicle, recList: CarRecord[], itemList: MaintenanceItem[], dueList: DueDate[], recordsReady: boolean) => {
    const rows = [...itemList, ...dueList].filter((r) => r.vehicleId === v.id && r.eventId)
    if (rows.length === 0) return
    let known: Map<string, ExistingEvent>
    try {
      known = await link.fetchEvents(rows.map((r) => r.eventId as string))
    } catch {
      setFailedIds((cur) => new Set([...cur, ...rows.map((r) => r.id)]))
      return
    }
    const km = currentOdometerKm(v.odometerKm, recList)
    const avg = dailyAverageKm(recList, today())
    const wrote = await Promise.all(rows.map((r) =>
      applyEvent(r.id, r.eventId, 'dueDate' in r ? dueSpec(r, v.name) : itemSpec(r, v.name, km, avg, recordsReady), known.get(r.eventId as string) ?? null)))
    await refreshCalendar(wrote.some(Boolean))
  }, [link, applyEvent, refreshCalendar])

  const saveVehicle = useCallback((input: VehicleInput, id?: string) =>
    run(id ? `vehicle:${id}` : 'create:vehicle', MSG_01_SAVE_FAILED, async () => {
      if (!id) {
        const newId = crypto.randomUUID()
        const created = await api.createVehicle(newId, input)
        let rows: MaintenanceItem[]
        try {
          rows = await api.createItems(newId, buildRecommendedItems().map((r) => ({ id: crypto.randomUUID(), ...r, eventId: null }))) // 추천 항목은 모두 미입력(BR-51)
        } catch (e) {
          await api.deleteVehicle(newId).catch(() => {}) // 보상 삭제가 실패해도 사용자에게는 MSG-01만 보인다
          throw e
        }
        setVehicles((cur) => [...cur, created]); setAllItems((cur) => [...cur, ...rows]); setPickedId(newId)
        return
      }
      const saved = await api.updateVehicle(id, input)
      setVehicles((cur) => cur.map((v) => (v.id === id ? saved : v)))
      const filled = await fillItems(id, saved.odometerKm)
      await syncLinked(saved, records, mergeById(allItems, filled), allDues, id === selectedId && recordsState === 'ready') // 별칭·주행거리 변경 → 제목·날짜
    }), [run, fillItems, syncLinked, selectedId, recordsState, records, allItems, allDues])

  const deleteVehicle = useCallback((id: string) =>
    run(`vehicle:${id}`, MSG_03_DELETE_FAILED, async () => {
      // BR-22: 연결 일정을 하나씩 지우고 그때마다 그 행의 event_id를 비운다. 하나라도 실패하면 멈추고 차량은 그대로 둔다
      const linked = [...allItems.map((r) => ({ type: 'item' as const, r })), ...allDues.map((r) => ({ type: 'due' as const, r }))]
        .filter(({ r }) => r.vehicleId === id && r.eventId)
      const cleared = new Set<string>()
      let wrote = false
      try {
        for (const { type, r } of linked) {
          wrote = (await link.deleteEvent(r.eventId as string).catch(asNonAuth)) || wrote
          await api.clearEventId(type, r.id)
          cleared.add(r.id)
        }
        await api.deleteVehicle(id)
      } catch (e) {
        setAllItems((cur) => cur.map((i) => (cleared.has(i.id) ? { ...i, eventId: null } : i)))
        setAllDues((cur) => cur.map((d) => (cleared.has(d.id) ? { ...d, eventId: null } : d)))
        throw e
      } finally {
        await refreshCalendar(wrote)
      }
      setPickedId((cur) => (cur === id ? null : cur)); setDefaultId((cur) => (cur === id ? null : cur)) // DB가 기본 차량을 set null로 바꾼다(AC-19-5)
      setVehicles((cur) => cur.filter((v) => v.id !== id)); setAllItems((cur) => cur.filter((i) => i.vehicleId !== id)); setAllDues((cur) => cur.filter((d) => d.vehicleId !== id))
    }), [run, allItems, allDues, link, refreshCalendar])

  const saveRecord = useCallback((input: RecordInput, id?: string) => {
    if (!selectedId) return Promise.resolve(false)
    const vehicleId = selectedId
    return run(id ? `record:${id}` : 'create:record', MSG_01_SAVE_FAILED, async () => {
      const saved = id ? await api.updateRecord(id, input) : await api.createRecord(crypto.randomUUID(), vehicleId, input)
      setRecs((cur) => (cur.vehicleId !== vehicleId ? cur : { ...cur, list: [...cur.list.filter((r) => r.id !== saved.id), saved].sort(byRecordOrder) }))
      const filled = await fillItems(vehicleId, saved.odometerKm ?? vehicle?.odometerKm ?? null)
      if (vehicle) await syncLinked(vehicle, [...records.filter((r) => r.id !== saved.id), saved], mergeById(allItems, filled), allDues, recordsState === 'ready')
    })
  }, [run, selectedId, vehicle, recordsState, records, allItems, allDues, fillItems, syncLinked])

  const deleteRecord = useCallback((id: string) =>
    run(`record:${id}`, MSG_03_DELETE_FAILED, async () => {
      await api.deleteRecord(id)
      setRecs((cur) => ({ ...cur, list: cur.list.filter((r) => r.id !== id) }))
      if (vehicle) await syncLinked(vehicle, records.filter((r) => r.id !== id), allItems, allDues, recordsState === 'ready')
    }), [run, vehicle, recordsState, records, allItems, allDues, syncLinked])

  // 교체 항목 저장·교체 완료(BR-24): 새 항목은 연결 id를 행과 함께 저장하고, 연결 id가 없는 기존 항목은 새 id를 선점한다.
  // 일정은 돌려받은 행의 event_id로 쓴다(선점에서 졌으면 이긴 탭의 id). 돌려받은 event_id가 null이면 캘린더는 건드리지 않는다
  const saveItem = useCallback((input: ItemInput, id?: string) => {
    if (!vehicle) return Promise.resolve(false)
    return run(id ? `item:${id}` : 'create:item', MSG_01_SAVE_FAILED, async () => {
      let saved: MaintenanceItem
      if (id) {
        saved = await api.updateItem(id, input, allItems.find((i) => i.id === id)?.eventId ? undefined : crypto.randomUUID())
        setAllItems((cur) => cur.map((i) => (i.id === id ? saved : i)))
      } else {
        saved = (await api.createItems(vehicle.id, [{ id: crypto.randomUUID(), ...input, eventId: crypto.randomUUID() }]))[0]
        setAllItems((cur) => [...cur, saved])
      }
      const spec = itemSpec(saved, vehicle.name, currentKm, dailyAverageKm(records, today()), recordsState === 'ready')
      const wrote = await applyEvent(saved.id, saved.eventId, spec, id ? undefined : null) // 새 항목은 일정이 있을 수 없다
      await refreshCalendar(wrote)
      showSaved(wrote && spec ? spec : null)
    })
  }, [run, vehicle, allItems, recordsState, records, currentKm, applyEvent, refreshCalendar, showSaved])

  const completeItem = useCallback((id: string, done: { date: DateKey; odometerKm: number | null }) => {
    const i = allItems.find((x) => x.id === id)
    return i ? saveItem({ name: i.name, intervalKm: i.intervalKm, intervalMonths: i.intervalMonths, lastDate: done.date, lastOdometerKm: done.odometerKm }, id) : Promise.resolve(false)
  }, [allItems, saveItem])

  // BR-22: 연결 일정을 먼저 지우고(실패하면 행을 두고 MSG-03) 성공하면 행을 지운다
  const deleteLinked = useCallback((key: string, row: { eventId: string | null }, removeRow: () => Promise<void>, drop: () => void) =>
    run(key, MSG_03_DELETE_FAILED, async () => {
      const wrote = row.eventId ? await link.deleteEvent(row.eventId).catch(asNonAuth) : false
      await removeRow()
      drop()
      await refreshCalendar(wrote)
    }), [run, link, refreshCalendar])
  const deleteItem = useCallback((id: string) => {
    const row = allItems.find((i) => i.id === id)
    return row ? deleteLinked(`item:${id}`, row, () => api.deleteItem(id), () => setAllItems((cur) => cur.filter((i) => i.id !== id))) : Promise.resolve(false)
  }, [allItems, deleteLinked])

  // 만기일은 종류당 1개(BR-16): 있으면 수정, 없으면 추가. 두 탭 동시 첫 저장의 23505는 목록을 다시 읽고 MSG-01
  const saveDueDate = useCallback((kind: DueKind, dueDate: DateKey) => {
    if (!vehicle) return Promise.resolve(false)
    const existing = allDues.find((d) => d.vehicleId === vehicle.id && d.kind === kind)
    return run(`due:${vehicle.id}:${kind}`, MSG_01_SAVE_FAILED, async () => {
      let saved: DueDate
      if (existing) {
        saved = await api.updateDueDate(existing.id, dueDate, existing.eventId ? undefined : crypto.randomUUID())
        setAllDues((cur) => cur.map((d) => (d.id === saved.id ? saved : d)))
      } else {
        try {
          saved = await api.createDueDate({ id: crypto.randomUUID(), vehicleId: vehicle.id, kind, dueDate, eventId: crypto.randomUUID() })
        } catch (e) {
          if (e instanceof CarbookError && e.code === '23505') await api.listDueDates().then(setAllDues).catch(() => {})
          throw e
        }
        setAllDues((cur) => [...cur, saved])
      }
      const spec = dueSpec(saved, vehicle.name)
      const wrote = await applyEvent(saved.id, saved.eventId, spec)
      await refreshCalendar(wrote)
      showSaved(wrote && spec ? spec : null)
    })
  }, [run, vehicle, allDues, applyEvent, refreshCalendar, showSaved])
  const deleteDueDate = useCallback((kind: DueKind) => {
    const row = allDues.find((d) => d.vehicleId === selectedId && d.kind === kind)
    return row ? deleteLinked(`due:${row.vehicleId}:${kind}`, row, () => api.deleteDueDate(row.id), () => setAllDues((cur) => cur.filter((d) => d.id !== row.id))) : Promise.resolve(false)
  }, [allDues, selectedId, deleteLinked])

  // 기본 차량 지정(BR-42): 성공하면 값만 바꾸고 지금 보는 차량은 그대로다. 실패하면 상태 불변
  const setDefaultVehicle = useCallback((id: string | null) =>
    run('settings', MSG_01_SAVE_FAILED, async () => {
      const saved = await api.setDefaultVehicle(id)
      setDefaultId(saved.defaultVehicleId); setSettingsFailed(false)
      setPickedId((cur) => cur ?? selectedId) // 지금 보는 차량은 그대로 둔다(BR-42)
    }), [run, selectedId])

  // 선택 차량에서 추천 주기와 다른 항목의 미리 보기
  const resetPlan = useMemo<ResetPlan>(() => (selectedId ? planRecommendedReset(allItems, selectedId) : { changes: [] }), [allItems, selectedId])

  // 추천 주기 되돌리기(BR-45~47): 한 요청으로 주기만 바꾸고, 이미 일정이 있고 마지막 교체일이 있는 항목만 일정을 맞춘다(새 연결 0)
  const resetRecommended = useCallback(async (): Promise<ResetResult | null> => {
    if (!vehicle || resetPlan.changes.length === 0) return null
    const plan = resetPlan
    let result: ResetResult | null = null
    await run(`reset:${vehicle.id}`, MSG_01_SAVE_FAILED, async () => {
      const rows = await api.resetItemCycles(plan.changes.map((c) => ({ id: c.itemId, userId, vehicleId: vehicle.id, name: c.name, intervalKm: c.to.intervalKm, intervalMonths: c.to.intervalMonths })))
      setAllItems((cur) => [...cur.map((i) => rows.find((r) => r.id === i.id) ?? i), ...rows.filter((r) => !cur.some((i) => i.id === r.id))])
      let failed = false
      const avg = dailyAverageKm(records, today())
      const wrote = await Promise.all(rows.filter((r) => r.eventId && r.lastDate).map((r) =>
        applyEvent(r.id, r.eventId, itemSpec(r, vehicle.name, currentKm, avg, recordsState === 'ready'), undefined, () => { failed = true })))
      await refreshCalendar(wrote.some(Boolean))
      result = { count: plan.changes.length, calendarFailed: failed }
    })
    return result
  }, [run, vehicle, resetPlan, userId, records, currentKm, recordsState, applyEvent, refreshCalendar])

  // MSG-11 버튼: 같은 연결 id로 그 행의 일정만 다시 쓴다(여러 번 눌러도 일정은 1건)
  const retryCalendar = useCallback(async ({ type, id }: { type: 'item' | 'due'; id: string }) => {
    const row = type === 'item' ? allItems.find((i) => i.id === id) : allDues.find((d) => d.id === id)
    const v = vehicles.find((x) => x.id === row?.vehicleId)
    if (!row || !v) return
    const spec = 'dueDate' in row ? dueSpec(row, v.name) : itemSpec(row, v.name, currentKm, dailyAverageKm(records, today()), recordsState === 'ready')
    await refreshCalendar(await applyEvent(id, row.eventId, spec))
  }, [allItems, allDues, vehicles, recordsState, records, currentKm, applyEvent, refreshCalendar])

  // 열 때 점검(8.4): 연결 일정을 한 번에 조회해 ① 카테고리가 다른 것은 다시 묶고 ② 없는 것은 계산할 수 있을 때만 같은 id로 다시 만든다.
  // 화면을 막지 않고 뒤에서 돌며, 실패한 행은 calendarFailed로 남기고, 쓴 것이 있으면 캘린더를 한 번만 다시 불러온다.
  // 기록을 못 읽은 차량의 km 항목은 판단을 미루고(점검 완료로 치지 않음) 기록이 읽힌 뒤 다시 본다
  const reconcile = async () => {
    const entries = [...allItems, ...allDues].filter((r) => r.eventId && !checked.current.has(r.id)).map((r) => {
      const v = vehicles.find((x) => x.id === r.vehicleId)
      const spec = !v ? undefined : 'dueDate' in r ? dueSpec(r, v.name) : itemSpec(r, v.name, currentKm, dailyAverageKm(records, today()), r.vehicleId === selectedId && recordsState === 'ready')
      return { r, id: r.eventId as string, spec }
    })
    if (entries.length === 0) return
    for (const e of entries) if (e.spec !== undefined) checked.current.add(e.r.id)
    const markFailed = (ids: string[]) => setFailedIds((cur) => new Set([...cur, ...ids]))
    let known: Map<string, ExistingEvent>
    try {
      known = await link.fetchEvents(entries.map((e) => e.id))
    } catch {
      markFailed(entries.map((e) => e.r.id))
      return
    }
    let wrote = false
    const found = entries.filter((e) => known.has(e.id))
    if (found.length > 0) {
      try {
        const categoryId = await link.ensureCategoryId()
        const stray = found.filter((e) => known.get(e.id)?.category_id !== categoryId)
        if (stray.length > 0) { await link.rebindCategory(stray.map((e) => e.id)); wrote = true }
      } catch {
        markFailed(found.map((e) => e.r.id))
      }
    }
    const created = await Promise.all(entries.filter((e) => !known.has(e.id)).map((e) => applyEvent(e.r.id, e.id, e.spec, null)))
    await refreshCalendar(wrote || created.some(Boolean))
  }
  useEffect(() => { latestReconcile.current = reconcile })
  useEffect(() => {
    if (loadState === 'ready' && recordsState !== 'loading') void latestReconcile.current()
  }, [loadState, recordsState, selectedId])

  return {
    loadState, retryLoad: () => { setLoadState('loading'); setLoadTick((n) => n + 1) },
    vehicles, selectedVehicleId: selectedId, selectVehicle: setPickedId,
    recordsState, retryRecords: () => { setRecs((cur) => ({ ...cur, state: 'loading' })); setRecTick((n) => n + 1) },
    records, currentOdometerKm: currentKm, items, dueDates, economy,
    saveVehicle, deleteVehicle, saveRecord, deleteRecord, saveItem, completeItem, deleteItem, saveDueDate, deleteDueDate, retryCalendar,
    defaultVehicleId, settingsFailed, setDefaultVehicle, resetPlan, resetRecommended,
    authExpired, dismissAuthExpired: () => setAuthExpired(false),
  }
}
