// MPR-33 QA 임시 화면: CarbookApp에 아직 연결되지 않은 기록 탭을 실제 컴포넌트·전역 스타일로 띄워 375px·데스크톱 스크린샷과 겹친 창의 Esc·Tab 동작을 브라우저에서 확인한다(앱 코드는 수정하지 않음).
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import '../../../../src/styles/global.css'
import RecordsTab from '../../../../src/carbook/components/RecordsTab'
import { economySegments } from '../../../../src/carbook/domain/fuelEconomy'
import type { CarRecord, RecordInput } from '../../../../src/carbook/domain/types'

const q = new URLSearchParams(location.search)
const mk = (id: string, date: string, kind: CarRecord['kind'], amountWon: number, o: Partial<CarRecord> = {}): CarRecord => ({ id, vehicleId: 'v', kind, date, amountWon, odometerKm: null, liters: null, fullTank: false, memo: null, createdAt: id, ...o })
const initial: CarRecord[] = q.get('empty') ? [] : [
  mk('r5', '2026-11-05', 'maintenance', 123000, { odometerKm: 48000, memo: '엔진오일·필터 교환, 앞 타이어 위치 교환까지 같이 진행' }),
  mk('r4', '2026-11-03', 'fuel', 62000, { odometerKm: 47800, liters: 38.5, fullTank: true }),
  mk('r3', '2026-10-20', 'wash', 8000),
  mk('r2', '2026-10-10', 'fuel', 30000, { odometerKm: 47300, liters: 20 }),
  mk('r1', '2026-10-01', 'fuel', 60000, { odometerKm: 46800, liters: 35, fullTank: true }),
]
function App() {
  const [list, setList] = useState(initial)
  const sorted = [...list].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1))
  const save = async (i: RecordInput, id?: string) => { if (q.get('fail')) return false; setList((l) => (id ? l.map((r) => (r.id === id ? { ...r, ...i } : r)) : [...l, { ...i, id: `n${l.length}`, vehicleId: 'v', createdAt: `n${l.length}` } as CarRecord])); return true }
  const del = async (id: string) => { setList((l) => l.filter((r) => r.id !== id)); return true }
  return (
    <main id="main-content" tabIndex={-1} style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <RecordsTab records={sorted} economy={economySegments(sorted)} vehicleOdometerKm={48000} recordsState="ready" onRetry={() => {}} onSave={save} onDelete={del} />
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
