// 차계부 도메인 타입(차량·기록·교체 항목·만기일과 화면용 뷰)을 정의하는 파일
export type RecordKind = 'fuel' | 'maintenance' | 'wash' | 'insurance' | 'tax' | 'parking' | 'other'
export type DueKind = 'insurance' | 'car_tax' | 'inspection'
export type DateKey = string // 'YYYY-MM-DD'

export const RECORD_KINDS: readonly RecordKind[] = ['fuel', 'maintenance', 'wash', 'insurance', 'tax', 'parking', 'other']
export const DUE_KINDS: readonly DueKind[] = ['insurance', 'car_tax', 'inspection']

export interface Vehicle { id: string; name: string; model: string | null; year: number | null; plate: string | null; odometerKm: number | null; createdAt: string }
export interface CarRecord { id: string; vehicleId: string; kind: RecordKind; date: DateKey; amountWon: number; odometerKm: number | null; liters: number | null; fullTank: boolean; memo: string | null; createdAt: string }
export interface MaintenanceItem { id: string; vehicleId: string; name: string; intervalKm: number | null; intervalMonths: number | null; lastDate: DateKey; lastOdometerKm: number | null; eventId: string | null; createdAt: string }
export interface DueDate { id: string; vehicleId: string; kind: DueKind; dueDate: DateKey; eventId: string | null; createdAt: string }

export type VehicleInput = Omit<Vehicle, 'id' | 'createdAt'>
export type RecordInput = Omit<CarRecord, 'id' | 'createdAt' | 'vehicleId'> // kind≠fuel이면 liters=null, fullTank=false (BR-10)
export type ItemInput = Pick<MaintenanceItem, 'name' | 'intervalKm' | 'intervalMonths' | 'lastDate' | 'lastOdometerKm'>

export type ItemStatus = 'ok' | 'soon' | 'overdue'
export interface ItemView extends MaintenanceItem { nextDate: DateKey | null; remainingKm: number | null; status: ItemStatus; calendarFailed: boolean }
export interface DueDateView extends DueDate { calendarFailed: boolean }
export interface EconomySegment { endRecordId: string; endDate: DateKey; kmPerL: number } // 소수 첫째 자리 반올림 전 값
