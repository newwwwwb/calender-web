// 차계부 데이터 읽기·차량 선택·차량/기록 쓰기를 조율하는 훅(화면이 쓰는 유일한 데이터 입구). 교체 항목·만기일 쓰기와 캘린더 연동은 후속 티켓이 이어 붙인다
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../state/useToast'
import * as api from '../data/carbookApi'
import { CarbookError } from '../data/request'
import { today } from '../domain/dateKey'
import { dailyAverageKm, currentOdometerKm } from '../domain/odometer'
import { economySegments } from '../domain/fuelEconomy'
import { buildRecommendedItems, evaluateItem, sortItems } from '../domain/maintenance'
import { MSG_01_SAVE_FAILED, MSG_03_DELETE_FAILED } from '../domain/messages'
import type { CarRecord, DueDate, DueDateView, EconomySegment, ItemView, MaintenanceItem, RecordInput, Vehicle, VehicleInput } from '../domain/types'

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
}

// BR-09: 날짜 내림차순, 같은 날은 먼저 만든 기록이 아래
const byRecordOrder = (a: CarRecord, b: CarRecord) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
const mergeById = <T extends { id: string }>(list: T[], changed: T[]) => list.map((x) => changed.find((c) => c.id === x.id) ?? x)

export function useCarbook(userId: string): CarbookState {
  void userId // RLS가 본인 행만 돌려주므로 조회 조건으로는 쓰지 않는다
  const { showToast } = useToast()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [allItems, setAllItems] = useState<MaintenanceItem[]>([])
  const [allDues, setAllDues] = useState<DueDate[]>([])
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [recs, setRecs] = useState<{ vehicleId: string; list: CarRecord[]; state: LoadState }>({ vehicleId: '', list: [], state: 'loading' })
  const [loadTick, setLoadTick] = useState(0)
  const [recTick, setRecTick] = useState(0)
  const busy = useRef(new Set<string>())
  // 고른 차량이 없어졌거나 아직 고르지 않았으면 가장 먼저 만든 차량(차량이 없으면 null)
  const selectedId = vehicles.some((v) => v.id === pickedId) ? pickedId : (vehicles[0]?.id ?? null)

  // 처음 읽기: 차량·교체 항목·만기일을 병렬로. 선택은 유지하되 사라졌으면 가장 먼저 만든 차량
  useEffect(() => {
    let live = true
    Promise.all([api.listVehicles(), api.listItems(), api.listDueDates()])
      .then(([v, i, d]) => {
        if (!live) return
        setVehicles(v); setAllItems(i); setAllDues(d)
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
    return sortItems(allItems.filter((i) => i.vehicleId === selectedId).map((i) => ({ ...i, ...evaluateItem(i, { today: todayKey, currentKm, avgKmPerDay: avg }), calendarFailed: false })))
  }, [allItems, records, selectedId, currentKm])
  const dueDates = useMemo<DueDateView[]>(() => allDues.filter((d) => d.vehicleId === selectedId).map((d) => ({ ...d, calendarFailed: false })), [allDues, selectedId])
  // 선택 차량의 기록이 아직 도착하지 않았으면(차량을 막 바꿨으면) 불러오는 중이다. 차량이 없으면 읽을 것이 없다
  const recordsState: LoadState = loadState !== 'ready' ? 'loading' : !selectedId ? 'ready' : recs.vehicleId !== selectedId ? 'loading' : recs.state
  const economy = useMemo(() => economySegments(records), [records])

  // 쓰기 한 건: 같은 대상이 진행 중이면 요청 없이 false(토스트 없음). 실패는 토스트 후 false, 상태는 그대로
  const run = useCallback(async (key: string, failMessage: string, fn: () => Promise<void>): Promise<boolean> => {
    if (busy.current.has(key)) return false
    busy.current.add(key)
    try {
      await fn()
      return true
    } catch (e) {
      showToast({ message: failMessage, tone: 'error' })
      if (e instanceof CarbookError && e.kind === 'conflict' && e.code === '23503') setLoadTick((n) => n + 1) // 다른 탭에서 차량이 지워짐
      return false
    } finally {
      busy.current.delete(key)
    }
  }, [showToast])

  // BR-06a: 마지막 교체 주행거리가 빈 km 항목이 있으면 알려진 주행거리로 채운다(일정은 만들지 않는다). 데이터로 판단하고 여러 번 불러도 안전하다.
  // 저장은 이미 끝났으므로 실패해도 삼키고, 다음 저장 때 다시 시도한다
  const fillItems = useCallback(async (vehicleId: string, km: number | null) => {
    if (km === null || !allItems.some((i) => i.vehicleId === vehicleId && i.intervalKm !== null && i.lastOdometerKm === null)) return
    try {
      const changed = await api.fillMissingItemOdometer(vehicleId, km)
      if (changed.length > 0) setAllItems((cur) => mergeById(cur, changed))
    } catch { /* 다음 저장에서 다시 채운다 */ }
  }, [allItems])

  const saveVehicle = useCallback((input: VehicleInput, id?: string) =>
    run(id ? `vehicle:${id}` : 'create:vehicle', MSG_01_SAVE_FAILED, async () => {
      if (!id) {
        const newId = crypto.randomUUID()
        const created = await api.createVehicle(newId, input)
        let rows: MaintenanceItem[]
        try {
          rows = await api.createItems(newId, buildRecommendedItems(created.odometerKm).map((r) => ({ id: crypto.randomUUID(), ...r, eventId: null })))
        } catch (e) {
          await api.deleteVehicle(newId).catch(() => {}) // 보상 삭제가 실패해도 사용자에게는 MSG-01만 보인다
          throw e
        }
        setVehicles((cur) => [...cur, created]); setAllItems((cur) => [...cur, ...rows]); setPickedId(newId)
        return
      }
      const saved = await api.updateVehicle(id, input)
      setVehicles((cur) => cur.map((v) => (v.id === id ? saved : v)))
      await fillItems(id, saved.odometerKm)
    }), [run, fillItems])

  const deleteVehicle = useCallback((id: string) =>
    run(`vehicle:${id}`, MSG_03_DELETE_FAILED, async () => {
      await api.deleteVehicle(id)
      setVehicles((cur) => cur.filter((v) => v.id !== id)); setAllItems((cur) => cur.filter((i) => i.vehicleId !== id)); setAllDues((cur) => cur.filter((d) => d.vehicleId !== id))
    }), [run])

  const saveRecord = useCallback((input: RecordInput, id?: string) => {
    if (!selectedId) return Promise.resolve(false)
    const vehicleId = selectedId
    return run(id ? `record:${id}` : 'create:record', MSG_01_SAVE_FAILED, async () => {
      const saved = id ? await api.updateRecord(id, input) : await api.createRecord(crypto.randomUUID(), vehicleId, input)
      setRecs((cur) => (cur.vehicleId !== vehicleId ? cur : { ...cur, list: [...cur.list.filter((r) => r.id !== saved.id), saved].sort(byRecordOrder) }))
      await fillItems(vehicleId, saved.odometerKm ?? vehicle?.odometerKm ?? null)
    })
  }, [run, selectedId, vehicle, fillItems])

  const deleteRecord = useCallback((id: string) =>
    run(`record:${id}`, MSG_03_DELETE_FAILED, async () => {
      await api.deleteRecord(id)
      setRecs((cur) => ({ ...cur, list: cur.list.filter((r) => r.id !== id) }))
    }), [run])

  return {
    loadState, retryLoad: () => { setLoadState('loading'); setLoadTick((n) => n + 1) },
    vehicles, selectedVehicleId: selectedId, selectVehicle: setPickedId,
    recordsState, retryRecords: () => { setRecs((cur) => ({ ...cur, state: 'loading' })); setRecTick((n) => n + 1) },
    records, currentOdometerKm: currentKm, items, dueDates, economy,
    saveVehicle, deleteVehicle, saveRecord, deleteRecord,
  }
}
