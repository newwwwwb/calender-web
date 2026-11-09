// 삭제 뒤 포커스 복구 테스트(MPR-46, NFR-18, WCAG 2.4.3): 대화상자 퇴장이 350ms보다 길어도 퇴장이 끝난 뒤(onExitComplete) 포커스가 복구 대상으로 간다.
// motion의 AnimatePresence를 "finishExit()을 불러야 퇴장이 끝나는" 가짜로 바꿔 퇴장 시간을 마음대로 늘린다(예전 350ms 타이머 방식은 이 테스트에서 실패한다)
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CarRecord, DueDateView, ItemView, Vehicle } from '../domain/types'
import DueDatesTab from './DueDatesTab'
import MaintenanceTab from './MaintenanceTab'
import RecordsTab from './RecordsTab'
import VehicleBar from './VehicleBar'

let finishExit: () => void = () => {}

vi.mock('motion/react', async (importOriginal) => {
  const original = await importOriginal<typeof import('motion/react')>()
  const { Children, useReducer, useRef, useEffect } = await import('react')
  function SlowExit({ children, onExitComplete }: { children?: React.ReactNode; onExitComplete?: () => void }) {
    const kept = useRef(new Map<string, React.ReactElement>())
    const [, force] = useReducer((n: number) => n + 1, 0)
    const current = Children.toArray(children) as React.ReactElement[]
    const keys = new Set(current.map((c) => String(c.key)))
    current.forEach((c) => kept.current.set(String(c.key), c))
    const exiting = [...kept.current.entries()].filter(([k]) => !keys.has(k))
    const done = useRef(onExitComplete)
    done.current = onExitComplete
    const hasExiting = exiting.length > 0
    useEffect(() => {
      finishExit = () => {
        if (!hasExiting) return
        done.current?.() // 실제 AnimatePresence처럼 노드를 빼기 직전에 부른다
        for (const [k] of exiting) kept.current.delete(k)
        force()
      }
    })
    return <>{[...kept.current.values()]}</>
  }
  return { ...original, AnimatePresence: SlowExit }
})

const slowExit = async () => {
  await new Promise((r) => setTimeout(r, 600)) // 예전 타이머(350ms)가 이미 지난 뒤
  await act(async () => finishExit())
}
const deleteConfirmed = async () => {
  fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  await act(async () => fireEvent.click(within(screen.getByRole('dialog', { name: '삭제 확인' })).getByRole('button', { name: '삭제' })))
}

const noop = () => Promise.resolve(true)

describe('퇴장이 긴 대화상자 뒤 포커스 복구 (MPR-46)', () => {
  it('기록 탭: 마지막 기록을 삭제하면 퇴장이 끝난 뒤 "기록 추가"로 간다', async () => {
    const r: CarRecord = { id: 'r1', vehicleId: 'v1', kind: 'other', date: '2026-11-03', amountWon: 1000, odometerKm: null, liters: null, fullTank: false, memo: null, createdAt: 'x' }
    const props = { economy: [], vehicleOdometerKm: 0, recordsState: 'ready' as const, onRetry: vi.fn(), onSave: noop, onDelete: noop }
    const { rerender } = render(<RecordsTab {...props} records={[r]} />)
    fireEvent.click(screen.getAllByRole('listitem')[0].querySelector('button')!)
    await deleteConfirmed()
    rerender(<RecordsTab {...props} records={[]} />)
    await slowExit()
    await waitFor(() => expect(screen.getByRole('button', { name: '기록 추가' })).toHaveFocus())
  })

  it('교체 알림 탭: 마지막 항목을 삭제하면 퇴장이 끝난 뒤 "항목 추가"로 간다', async () => {
    const item: ItemView = { id: 'i1', vehicleId: 'v1', name: '엔진오일', intervalKm: null, intervalMonths: 12, lastDate: '2026-05-12', lastOdometerKm: null, eventId: null, createdAt: 'x', nextDate: '2027-05-12', remainingKm: null, status: 'ok', calendarFailed: false }
    const props = { currentKm: 0, recordsState: 'ready' as const, onRetry: vi.fn(), onSave: noop, onDelete: noop, onComplete: noop, onRetryCalendar: () => Promise.resolve() }
    const { rerender } = render(<MaintenanceTab {...props} items={[item]} />)
    fireEvent.click(screen.getByRole('button', { name: '엔진오일, 수정' }))
    await deleteConfirmed()
    rerender(<MaintenanceTab {...props} items={[]} />)
    await slowExit()
    await waitFor(() => expect(screen.getByRole('button', { name: '항목 추가' })).toHaveFocus())
  })

  it('만기일 탭: 정기검사를 삭제하면 퇴장이 끝난 뒤 그 행의 "입력"으로 간다', async () => {
    const due: DueDateView = { id: 'd3', vehicleId: 'v1', kind: 'inspection', dueDate: '2027-03-10', eventId: null, createdAt: 'x', calendarFailed: false }
    const props = { state: 'ready' as const, onRetry: vi.fn(), onSave: noop, onDelete: noop, onRetryCalendar: () => Promise.resolve() }
    const { rerender } = render(<DueDatesTab {...props} dueDates={[due]} />)
    fireEvent.click(screen.getByRole('button', { name: '정기검사 삭제' }))
    await act(async () => fireEvent.click(within(screen.getByRole('dialog', { name: '삭제 확인' })).getByRole('button', { name: '삭제' })))
    rerender(<DueDatesTab {...props} dueDates={[]} />)
    await slowExit()
    await waitFor(() => expect(screen.getByRole('button', { name: '정기검사 입력' })).toHaveFocus())
  })

  it('차량 막대: 마지막 차량을 삭제하면 퇴장이 끝난 뒤 "차량 추가"로 간다', async () => {
    const v: Vehicle = { id: 'v1', name: '출퇴근', model: null, year: null, plate: null, odometerKm: null, createdAt: 'x' }
    const props = { currentOdometerKm: 0, onSelect: vi.fn(), onSave: noop, onDelete: noop }
    const { rerender } = render(<VehicleBar {...props} vehicles={[v]} selectedVehicleId="v1" />)
    await deleteConfirmed()
    rerender(<VehicleBar {...props} vehicles={[]} selectedVehicleId={null} />)
    await slowExit()
    await waitFor(() => expect(screen.getByRole('button', { name: '차량 추가' })).toHaveFocus())
  })

  it('퇴장이 끝나기 전에는 옮기지 않는다', async () => {
    const v: Vehicle = { id: 'v1', name: '출퇴근', model: null, year: null, plate: null, odometerKm: null, createdAt: 'x' }
    const props = { currentOdometerKm: 0, onSelect: vi.fn(), onSave: noop, onDelete: noop }
    const { rerender } = render(<VehicleBar {...props} vehicles={[v]} selectedVehicleId="v1" />)
    await deleteConfirmed()
    rerender(<VehicleBar {...props} vehicles={[]} selectedVehicleId={null} />)
    await new Promise((r) => setTimeout(r, 600))
    expect(screen.getByRole('button', { name: '차량 추가' })).not.toHaveFocus()
    await act(async () => finishExit())
    await waitFor(() => expect(screen.getByRole('button', { name: '차량 추가' })).toHaveFocus())
  })
})
