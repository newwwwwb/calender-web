// MPR-32 QA 임시 화면: CarbookApp에 아직 연결되지 않은 차량 영역을 실제 컴포넌트·전역 스타일로 띄워 375px·데스크톱 스크린샷을 찍는다(앱 코드는 수정하지 않음).
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { MotionConfig } from 'motion/react'
import '../../../../src/styles/global.css'
import VehicleBar from '../../../../src/carbook/components/VehicleBar'
import type { Vehicle } from '../../../../src/carbook/domain/types'

const mk = (id: string, name: string, o: Partial<Vehicle>): Vehicle => ({ id, name, model: null, year: null, plate: null, odometerKm: null, createdAt: id, ...o })
const q = new URLSearchParams(location.search)
const initial = q.get('empty') ? [] : [mk('a', '출퇴근', { model: '아반떼', year: 2020, plate: '12가3456', odometerKm: 48000 }), mk('b', '가족', { model: '카니발', year: 2022 })]
function App() {
  const [list, setList] = useState(initial); const [sel, setSel] = useState<string | null>(initial[0]?.id ?? null)
  return (
    <main style={{ padding: 16 }}>
      <VehicleBar vehicles={list} selectedVehicleId={sel} currentOdometerKm={q.get('empty') ? 0 : 48000} onSelect={setSel}
        onSave={async () => !q.get('fail')} onDelete={async (id) => { if (q.get('fail')) return false; setList((l) => l.filter((v) => v.id !== id)); return true }} />
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<MotionConfig reducedMotion="always"><App /></MotionConfig>)
