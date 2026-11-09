// MPR-34 QA 임시 화면: CarbookApp에 아직 연결되지 않은 교체 알림 탭을 실제 컴포넌트·전역 스타일로 띄워 375px·데스크톱 스크린샷과 레이아웃·겹친 창 동작을 브라우저에서 확인한다(앱 코드는 수정하지 않음).
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import '../../../../src/styles/global.css'
import MaintenanceTab from '../../../../src/carbook/components/MaintenanceTab'
import type { DateKey, ItemInput, ItemView } from '../../../../src/carbook/domain/types'

const q = new URLSearchParams(location.search)
const mk = (id: string, name: string, o: Partial<ItemView>): ItemView => ({ id, vehicleId: 'v', name, intervalKm: null, intervalMonths: 12, lastDate: '2026-01-05', lastOdometerKm: null, eventId: null, createdAt: id, nextDate: null, remainingKm: null, status: 'ok', calendarFailed: false, ...o })
const initial: ItemView[] = q.get('empty') ? [] : [
  mk('a', '엔진오일', { intervalKm: 10000, lastOdometerKm: 37999, lastDate: '2025-10-01', nextDate: '2026-10-01', remainingKm: -1, status: 'overdue', calendarFailed: true }),
  mk('b', '에어컨 필터', { intervalKm: 10000, intervalMonths: 6, lastOdometerKm: 39000, lastDate: '2026-06-01', nextDate: '2026-11-20', remainingKm: 1000, status: 'soon' }),
  mk('c', '타이어 위치 교환', { intervalKm: 10000, intervalMonths: null, lastOdometerKm: null, lastDate: '2026-11-05', nextDate: null, remainingKm: null, status: 'ok' }),
  mk('d', '와이퍼', { lastDate: '2026-03-01', nextDate: '2027-03-01', status: 'ok' }),
  mk('e', '배터리 점검(이름이 아주 길어서 한 줄에 다 들어가지 않을 수도 있는 항목)', { intervalMonths: 36, lastDate: '2026-02-01', nextDate: '2029-02-01', status: 'ok' }),
]
function App() {
  const [list, setList] = useState(initial)
  const save = async (i: ItemInput, id?: string) => { if (q.get('fail')) return false; setList((l) => (id ? l.map((r) => (r.id === id ? { ...r, ...i } : r)) : [...l, mk(`n${l.length}`, i.name, { ...i })])); return true }
  const del = async (id: string) => { setList((l) => l.filter((r) => r.id !== id)); return true }
  const done = async (id: string, d: { date: DateKey; odometerKm: number | null }) => { setList((l) => l.map((r) => (r.id === id ? { ...r, lastDate: d.date, lastOdometerKm: d.odometerKm, status: 'ok', nextDate: '2027-11-05', remainingKm: 10000 } : r))); return true }
  const retry = async (id: string) => { setList((l) => l.map((r) => (r.id === id ? { ...r, calendarFailed: false } : r))) }
  return (
    <main id="main-content" tabIndex={-1} style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <MaintenanceTab items={list} currentKm={48000} recordsState="ready" onRetry={() => {}} onSave={save} onDelete={del} onComplete={done} onRetryCalendar={retry} />
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
