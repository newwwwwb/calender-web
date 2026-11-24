// 차계부 도메인 타입(차량·기록·교체 항목·만기일과 화면용 뷰)을 정의하는 파일
export type RecordKind = 'fuel' | 'maintenance' | 'wash' | 'insurance' | 'tax' | 'parking' | 'other'
export type DueKind = 'insurance' | 'car_tax' | 'inspection'
export type DateKey = string // 'YYYY-MM-DD'

export const RECORD_KINDS: readonly RecordKind[] = ['fuel', 'maintenance', 'wash', 'insurance', 'tax', 'parking', 'other']
export const DUE_KINDS: readonly DueKind[] = ['insurance', 'car_tax', 'inspection']

export interface Vehicle { id: string; name: string; model: string | null; year: number | null; plate: string | null; odometerKm: number | null; createdAt: string }
export interface CarRecord { id: string; vehicleId: string; kind: RecordKind; date: DateKey; amountWon: number; odometerKm: number | null; liters: number | null; fullTank: boolean; memo: string | null; createdAt: string }
export interface MaintenanceItem { id: string; vehicleId: string; name: string; intervalKm: number | null; intervalMonths: number | null; lastDate: DateKey | null; lastOdometerKm: number | null; eventId: string | null; createdAt: string }
export interface DueDate { id: string; vehicleId: string; kind: DueKind; dueDate: DateKey; eventId: string | null; createdAt: string }

export type VehicleInput = Omit<Vehicle, 'id' | 'createdAt'>
export type RecordInput = Omit<CarRecord, 'id' | 'createdAt' | 'vehicleId'> // kind≠fuel이면 liters=null, fullTank=false (BR-10)
export type ItemInput = Pick<MaintenanceItem, 'name' | 'intervalKm' | 'intervalMonths' | 'lastOdometerKm'> & { lastDate: DateKey } // 양식은 날짜를 요구한다
export type RecommendedItem = Pick<MaintenanceItem, 'name' | 'intervalKm' | 'intervalMonths'> & { lastDate: null; lastOdometerKm: null } // BR-51 새 차량의 미입력 추천 항목

export type ItemStatus = 'ok' | 'soon' | 'overdue' | 'unset' // unset = 마지막 교체일 미입력(BR-52)
export interface ItemView extends MaintenanceItem { nextDate: DateKey | null; remainingKm: number | null; status: ItemStatus; basis: 'km' | 'months' | null; calendarFailed: boolean } // basis: 다음 교체일을 정한 기준(BR-55)
export interface DueDateView extends DueDate { calendarFailed: boolean }
export interface EconomySegment { endRecordId: string; endDate: DateKey; kmPerL: number } // 소수 첫째 자리 반올림 전 값

export interface CarSettings { defaultVehicleId: string | null } // 설정 행이 없으면 null
export interface ItemCycle { intervalKm: number | null; intervalMonths: number | null }
export interface ResetChange { itemId: string; name: string; from: ItemCycle; to: ItemCycle } // name은 저장된 이름 그대로(공백 포함, BR-45)
export interface ResetPlan { changes: ResetChange[] } // changes가 비면 MSG-24
export interface ResetResult { count: number; calendarFailed: boolean } // 되돌리기 성공 결과(주기가 바뀐 항목 수, 일정 실패 여부)
