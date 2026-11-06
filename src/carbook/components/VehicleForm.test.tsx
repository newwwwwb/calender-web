// VehicleForm 테스트(F-03, DLG-01): 추가·수정 값, 입력 오류(AC-03-3), 저장 실패 시 입력 유지(AC-03-4), 중복 제출, 닫기 규칙
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Vehicle } from '../domain/types'
import VehicleForm from './VehicleForm'

const maxYear = new Date().getFullYear() + 1

function setup(props: { vehicle?: Vehicle; onSave?: () => Promise<boolean> } = {}) {
  const onSave = vi.fn(props.onSave ?? (() => Promise.resolve(true)))
  const onClose = vi.fn()
  render(<VehicleForm vehicle={props.vehicle} onSave={onSave} onClose={onClose} />)
  return { onSave, onClose }
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: '저장' }))

describe('VehicleForm 추가', () => {
  it('제목이 "차량 추가"이고 별칭 칸에 포커스가 있으며 별칭만 (필수)다', () => {
    setup()
    expect(screen.getByRole('dialog', { name: '차량 추가' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^별칭/)).toHaveFocus()
    expect(screen.getByText('별칭 (필수)')).toBeInTheDocument()
    expect(screen.queryByText(/차종 \(필수\)/)).not.toBeInTheDocument()
  })

  it('입력한 값으로 저장하고 성공하면 닫는다', async () => {
    const { onSave, onClose } = setup()
    type(/^별칭/, '출퇴근')
    type('차종', '아반떼')
    type('연식', '2021')
    type('번호판', '12가3456')
    type(/^현재 주행거리/, '45000')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith({ name: '출퇴근', model: '아반떼', year: 2021, plate: '12가3456', odometerKm: 45000 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('별칭만 넣어도 저장된다(나머지는 null)', async () => {
    const { onSave } = setup()
    type(/^별칭/, '가족')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith({ name: '가족', model: null, year: null, plate: null, odometerKm: null })
  })
})

describe('VehicleForm 수정', () => {
  const vehicle: Vehicle = { id: 'v1', name: '출퇴근', model: '아반떼', year: 2021, plate: '12가3456', odometerKm: 45000, createdAt: '2026-11-01T00:00:00Z' }

  it('제목이 "차량 수정"이고 기존 값이 채워져 있다', () => {
    setup({ vehicle })
    expect(screen.getByRole('dialog', { name: '차량 수정' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^별칭/)).toHaveValue('출퇴근')
    expect(screen.getByLabelText('연식')).toHaveValue('2021')
    expect(screen.getByLabelText(/^현재 주행거리/)).toHaveValue('45000')
  })
})

describe('VehicleForm 입력 오류 (AC-03-3)', () => {
  it('별칭이 비면 MSG-05가 칸 아래에 보이고 저장 요청은 0건이다', () => {
    const { onSave } = setup()
    save()
    expect(screen.getByText('별칭을(를) 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByLabelText(/^별칭/)).toHaveAttribute('aria-invalid', 'true')
    expect(onSave).not.toHaveBeenCalled()
  })

  it.each([['1949'], [String(maxYear + 1)]])('연식 %s는 MSG-08이고 요청이 없다', (year) => {
    const { onSave } = setup()
    type(/^별칭/, '출퇴근')
    type('연식', year)
    save()
    expect(screen.getByText(`연식은 1950부터 ${maxYear} 사이로 입력해 주세요`)).toBeInTheDocument()
    expect(screen.getByLabelText('연식')).toHaveAttribute('aria-describedby')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('오류가 여러 칸이면 첫 오류 칸으로 포커스가 간다', () => {
    setup()
    type('연식', '1900')
    save()
    expect(screen.getByLabelText(/^별칭/)).toHaveFocus()
  })

  it('오류를 고치면 다시 저장된다', async () => {
    const { onSave } = setup()
    save()
    type(/^별칭/, '출퇴근')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('별칭을(를) 입력해 주세요')).not.toBeInTheDocument()
  })
})

describe('VehicleForm 저장 (AC-03-4)', () => {
  it('저장이 실패(false)하면 양식과 입력값이 그대로 남고 다시 저장할 수 있다', async () => {
    const { onSave, onClose } = setup({ onSave: () => Promise.resolve(false) })
    type(/^별칭/, '출퇴근')
    type('차종', '아반떼')
    await act(async () => save())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^별칭/)).toHaveValue('출퇴근')
    expect(screen.getByLabelText('차종')).toHaveValue('아반떼')
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
    await act(async () => save())
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('저장 중에는 저장 버튼이 비활성이고 연속 제출해도 요청은 1건이다', async () => {
    let finish: (ok: boolean) => void = () => {}
    const { onSave } = setup({ onSave: () => new Promise<boolean>((resolve) => (finish = resolve)) })
    type(/^별칭/, '출퇴근')
    const form = screen.getByRole('button', { name: '저장' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
    expect(onSave).toHaveBeenCalledTimes(1)
    await act(async () => finish(false))
  })
})

describe('VehicleForm 저장 중 닫기·오류', () => {
  it('저장 요청이 reject돼도 양식이 잠기지 않고 입력값이 남는다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { onClose } = setup({ onSave: () => Promise.reject(new Error('boom')) })
    type(/^별칭/, '출퇴근')
    await act(async () => save())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
    expect(screen.getByLabelText(/^별칭/)).toHaveValue('출퇴근')
    error.mockRestore()
  })

  it('저장 요청 중에는 취소·Esc로 닫히지 않고, 끝난 뒤 onClose는 한 번만 불린다', async () => {
    let finish: (ok: boolean) => void = () => {}
    const { onClose } = setup({ onSave: () => new Promise<boolean>((resolve) => (finish = resolve)) })
    type(/^별칭/, '출퇴근')
    save()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => finish(true))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('VehicleForm 닫기', () => {
  it('"취소"와 Esc는 닫는다', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('창 밖(스크림) 클릭으로는 닫히지 않는다(입력값을 잃지 않게)', () => {
    const { onClose } = setup()
    type(/^별칭/, '출퇴근')
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^별칭/)).toHaveValue('출퇴근')
  })
})
