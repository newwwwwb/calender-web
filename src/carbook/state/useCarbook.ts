// 차계부 데이터 훅의 임시 뼈대: MPR-26이 02_architecture 6장 인터페이스대로 통째로 교체한다(그때까지 불러오는 중 상태만 돌려줌)
import type { Vehicle } from '../domain/types'

export interface CarbookShellState {
  loadState: 'loading' | 'ready' | 'error'
  retryLoad(): void
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  selectVehicle(id: string): void
}

export function useCarbook(userId: string): CarbookShellState {
  void userId
  return { loadState: 'loading', retryLoad: () => {}, vehicles: [], selectedVehicleId: null, selectVehicle: () => {} }
}
