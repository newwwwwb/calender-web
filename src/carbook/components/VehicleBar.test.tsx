// VehicleBar 테스트(F-03·F-11): 빈 상태, 선택 상자·카드(AC-03-1), 추가·수정 저장 호출(AC-03-5), 삭제 확인(AC-03-6·11-3), 삭제 뒤 선택(AC-03-7)
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Vehicle } from '../domain/types'
import VehicleBar from './VehicleBar'

const commute: Vehicle = { id: 'v1', name: '출퇴근', model: '아반떼', year: 2021, plate: '12가3456', odometerKm: 45000, createdAt: '2026-11-01T00:00:00Z' }
const family: Vehicle = { id: 'v2', name: '가족', model: null, year: null, plate: null, odometerKm: null, createdAt: '2026-11-02T00:00:00Z' }

function setup(overrides: Partial<React.ComponentProps<typeof VehicleBar>> = {}) {
  const props = {
    vehicles: [commute, family],
    selectedVehicleId: 'v1',
    currentOdometerKm: 45000,
    onSelect: vi.fn(),
    onSave: vi.fn(() => Promise.resolve(true)),
    onDelete: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  }
  const view = render(<VehicleBar {...props} />)
  return { ...props, rerender: (next: Partial<typeof props>) => view.rerender(<VehicleBar {...props} {...next} />) }
}

describe('차량 0대 빈 상태 (SCR-03)', () => {
  it('"차량을 추가해 주세요"와 차량 추가 버튼만 보이고, 누르면 추가 양식이 열린다', () => {
    setup({ vehicles: [], selectedVehicleId: null, currentOdometerKm: 0 })
    expect(screen.getByText('차량을 추가해 주세요')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('수정')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '차량 추가' }))
    expect(screen.getByRole('dialog', { name: '차량 추가' })).toBeInTheDocument()
  })
})

describe('선택 상자와 차량 정보 카드 (AC-03-1)', () => {
  it('차량이 1대여도 선택 상자가 보이고 선택한 차량의 카드가 보인다', () => {
    setup({ vehicles: [commute] })
    expect(screen.getByLabelText('차량')).toHaveValue('v1')
    expect(screen.getByText('아반떼 · 2021')).toBeInTheDocument()
    expect(screen.getByText('12가3456')).toBeInTheDocument()
    expect(screen.getByText('45,000 km')).toBeInTheDocument()
  })

  it('빈 값은 칸을 숨기지 않고 "-"로 둔다', () => {
    setup({ selectedVehicleId: 'v2', currentOdometerKm: 0 })
    expect(screen.getByText('가족', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getAllByText('-')).toHaveLength(3) // 차종·연식, 번호판, 주행거리
  })

  it('선택 상자에서 다른 차량을 고르면 onSelect가 그 id로 불린다', () => {
    const { onSelect } = setup()
    fireEvent.change(screen.getByLabelText('차량'), { target: { value: 'v2' } })
    expect(onSelect).toHaveBeenCalledWith('v2')
  })
})

describe('추가·수정 (AC-03-5의 화면 쪽)', () => {
  it('차량 추가: 양식을 저장하면 id 없이 onSave가 불리고 창이 닫힌다', async () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: '차량 추가' }))
    fireEvent.change(screen.getByLabelText(/^별칭/), { target: { value: '세컨드' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: '세컨드', model: null, year: null, plate: null, odometerKm: null }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('수정: 선택 차량의 값이 채워진 양식이 열리고 저장하면 그 id로 onSave가 불린다', async () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    expect(screen.getByRole('dialog', { name: '차량 수정' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^별칭/), { target: { value: '출근차' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: '출근차', model: '아반떼', year: 2021 }), 'v1'))
  })
})

describe('삭제 (AC-03-6, AC-11-3, AC-03-7)', () => {
  it('삭제 확인창에 차량 별칭이 들어간 MSG-13과 MSG-14가 보이고, 취소하면 삭제 요청이 없다', async () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.getByText('차량 출퇴근을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다')).toBeInTheDocument()
    expect(screen.getByText('이 차량의 기록, 교체 항목, 만기일, 캘린더 일정이 모두 삭제됩니다')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onDelete).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('확인창에서 "삭제"를 누르면 선택 차량 id로 삭제 요청이 1건 나간다', async () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    const dialog = screen.getByRole('dialog', { name: '삭제 확인' })
    fireEvent.click(dialog.querySelector('button')!) // 첫 버튼 = 삭제
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
    expect(onDelete).toHaveBeenCalledWith('v1')
  })

  it('삭제 뒤 남은 차량이 선택돼 있으면 그 차량 카드가, 모두 지워지면 빈 상태가 보인다', () => {
    const { rerender } = setup()
    rerender({ vehicles: [family], selectedVehicleId: 'v2', currentOdometerKm: 0 })
    expect(screen.getByLabelText('차량')).toHaveValue('v2')
    rerender({ vehicles: [], selectedVehicleId: null })
    expect(screen.getByText('차량을 추가해 주세요')).toBeInTheDocument()
  })
})
