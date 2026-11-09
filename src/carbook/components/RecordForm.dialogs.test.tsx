// RecordForm 테스트 2/2(F-04·F-11): 주행거리 감소 확인 DLG-04(AC-04-6), 수정 양식과 삭제 확인
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CarRecord } from '../domain/types'
import RecordForm from './RecordForm'

type Props = Partial<React.ComponentProps<typeof RecordForm>>

function setup(props: Props = {}) {
  const onSave = vi.fn(props.onSave ?? (() => Promise.resolve(true)))
  const onClose = vi.fn()
  const onDelete = props.onDelete
  render(<RecordForm currentKm={0} {...props} onSave={onSave} onClose={onClose} onDelete={onDelete} />)
  return { onSave, onClose }
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const pickKind = (value: string) => type(/^종류/, value)
const save = () => fireEvent.click(screen.getByRole('button', { name: '저장' }))

const existing: CarRecord = { id: 'r1', vehicleId: 'v1', kind: 'fuel', date: '2026-11-03', amountWon: 52000, odometerKm: 12345, liters: 35.2, fullTank: true, memo: '출퇴근', createdAt: '2026-11-03T00:00:00Z' }

describe('주행거리 감소 확인 (AC-04-6, DLG-04)', () => {
  function fill() {
    pickKind('fuel')
    type(/^금액/, '50000')
    type(/^주행거리/, '49000')
    save()
  }

  it('현재 주행거리보다 작으면 MSG-10 확인창이 뜨고 취소 버튼에 포커스가 있다', () => {
    const { onSave } = setup({ currentKm: 50000 })
    fill()
    expect(screen.getByText('주행거리가 이전 최대 기록(50,000km)보다 작습니다. 그래도 저장할까요?')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '주행거리가 이전 기록보다 작습니다' })).toBeInTheDocument()
    const cancel = Array.from(screen.getByRole('dialog', { name: '주행거리 확인' }).querySelectorAll('button')).find((b) => b.textContent === '취소')
    expect(cancel).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('"저장"을 누르면 저장된다', async () => {
    const { onSave } = setup({ currentKm: 50000 })
    fill()
    const dialog = screen.getByRole('dialog', { name: '주행거리 확인' })
    await act(async () => {
      fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === '저장')!)
    })
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ odometerKm: 49000 }), undefined)
  })

  it('"저장"을 눌렀는데 저장이 실패하면 확인창만 닫히고 양식·입력값이 남으며 저장 버튼이 다시 켜진다 (AC-10-1)', async () => {
    const { onSave, onClose } = setup({ currentKm: 50000, onSave: () => Promise.resolve(false) })
    fill()
    const dialog = screen.getByRole('dialog', { name: '주행거리 확인' })
    await act(async () => {
      fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === '저장')!)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '주행거리 확인' })).not.toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^주행거리/)).toHaveValue('49000')
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })

  it('"취소"를 누르면 저장되지 않고 양식에 입력값이 남는다', async () => {
    const { onSave, onClose } = setup({ currentKm: 50000 })
    fill()
    const dialog = screen.getByRole('dialog', { name: '주행거리 확인' })
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === '취소')!)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '주행거리 확인' })).not.toBeInTheDocument())
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^주행거리/)).toHaveValue('49000')
  })

  it('확인창에서 Esc를 누르면 확인창만 닫히고 양식과 입력값은 남는다 (Auditor G1)', async () => {
    const { onSave, onClose } = setup({ currentKm: 50000 })
    fill()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '주행거리 확인' })).not.toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '기록 추가' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^주행거리/)).toHaveValue('49000')
  })

  it('주행거리가 같거나 비어 있으면 확인 없이 저장한다', async () => {
    const { onSave } = setup({ currentKm: 50000 })
    pickKind('other')
    type(/^금액/, '1000')
    type(/^주행거리/, '50000')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})

describe('수정과 삭제 (F-11)', () => {
  it('수정 양식에 기존 값이 채워지고 저장하면 그 id로 저장한다', async () => {
    const { onSave } = setup({ record: existing, currentKm: 12000 })
    expect(screen.getByRole('dialog', { name: '기록 수정' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^금액/)).toHaveValue('52000')
    expect(screen.getByLabelText(/^주유량/)).toHaveValue('35.2')
    expect(screen.getByRole('checkbox', { name: '가득 주유' })).toBeChecked()
    type(/^금액/, '53000')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ amountWon: 53000, liters: 35.2, fullTank: true }), 'r1')
  })

  it('추가 양식과 onDelete가 없으면 삭제 버튼이 없다', () => {
    setup()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('"삭제"는 확인창(기록(날짜·종류))을 거치고, 확인하면 삭제 요청이 1건 나가고 양식이 닫힌다', async () => {
    const onDelete = vi.fn(() => Promise.resolve(true))
    const { onClose } = setup({ record: existing, onDelete })
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.getByText('기록(2026-11-03·주유)을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: '삭제 확인' })
    await act(async () => {
      fireEvent.click(dialog.querySelector('button')!) // 첫 버튼 = 삭제
    })
    expect(onDelete).toHaveBeenCalledWith('r1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('삭제 확인에서 Esc를 누르면 확인창만 닫히고 삭제 요청도 양식 닫힘도 없다 (Auditor G1, AC-11-4)', async () => {
    const onDelete = vi.fn(() => Promise.resolve(true))
    const { onClose } = setup({ record: existing, onDelete })
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '삭제 확인' })).not.toBeInTheDocument())
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '기록 수정' })).toBeInTheDocument()
  })

  it('삭제 확인에서 취소하면 삭제 요청이 없고 양식이 남는다', async () => {
    const onDelete = vi.fn(() => Promise.resolve(true))
    const { onClose } = setup({ record: existing, onDelete })
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    fireEvent.click(screen.getByRole('dialog', { name: '삭제 확인' }).querySelectorAll('button')[1]) // 취소
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '삭제 확인' })).not.toBeInTheDocument())
  })
})
