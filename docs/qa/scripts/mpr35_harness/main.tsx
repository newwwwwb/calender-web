// MPR-35·36 QA 임시 화면: CarbookApp에 아직 연결되지 않은 만기일 탭을 실제 컴포넌트·전역 스타일로 띄워 375px·데스크톱 스크린샷과 레이아웃·포커스 동작을 브라우저에서 확인한다(앱 코드는 수정하지 않음).
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import '../../../../src/styles/global.css'
import DueDatesTab from '../../../../src/carbook/components/DueDatesTab'
import type { DateKey, DueDateView, DueKind } from '../../../../src/carbook/domain/types'

const q = new URLSearchParams(location.search)
const mk = (kind: DueKind, dueDate: string, o: Partial<DueDateView> = {}): DueDateView => ({ id: `d-${kind}`, vehicleId: 'v', kind, dueDate, eventId: 'e', createdAt: kind, calendarFailed: false, ...o })
const initial: DueDateView[] = q.get('empty') ? [] : [mk('insurance', '2027-03-10', { calendarFailed: true }), mk('inspection', '2027-05-01')]
function App() {
  const [list, setList] = useState(initial)
  const save = async (kind: DueKind, d: DateKey) => { if (q.get('fail')) return false; setList((l) => (l.some((x) => x.kind === kind) ? l.map((x) => (x.kind === kind ? { ...x, dueDate: d } : x)) : [...l, mk(kind, d)])); return true }
  const del = async (kind: DueKind) => { setList((l) => l.filter((x) => x.kind !== kind)); return true }
  const retry = async (id: string) => { setList((l) => l.map((x) => (x.id === id ? { ...x, calendarFailed: false } : x))) }
  return (
    <main id="main-content" tabIndex={-1} style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <DueDatesTab dueDates={list} state="ready" onRetry={() => {}} onSave={save} onDelete={del} onRetryCalendar={retry} />
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
