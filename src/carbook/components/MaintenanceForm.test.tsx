// MaintenanceForm 테스트(F-06·F-12): 입력 검사(AC-06-9, AC-06-17), 안내 문구(AC-12-2), 저장·중복 제출·실패(AC-10-1·2), 수정·삭제
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaintenanceItem } from '../domain/types'
import MaintenanceForm from './MaintenanceForm'

type Props = Partial<React.ComponentProps<typeof MaintenanceForm>>

function setup(props: Props = {}) {
  const onSave = vi.fn(props.onSave ?? (() => Promise.resolve(true)))
  const onClose = vi.fn()
  render(<MaintenanceForm {...props} onSave={onSave} onClose={onClose} />)
  return { onSave, onClose }
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: '저장' }))

const existing: MaintenanceItem = { id: 'i1', vehicleId: 'v1', name: '엔진오일', intervalKm: 10000, intervalMonths: 12, lastDate: '2026-05-12', lastOdometerKm: 31200, eventId: null, createdAt: '2026-05-12T00:00:00Z' }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T09:00:00+09:00'))
})
afterEach(() => vi.useRealTimers())

describe('입력과 안내 문구', () => {
  it('추가 양식은 제목, 마지막 교체일 기본값 오늘, 이름 칸 포커스, 주기 칸 위 MSG-12 안내를 보인다 (AC-12-2)', () => {
    setup()
    expect(screen.getByRole('dialog', { name: '교체 항목 추가' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^마지막 교체일/)).toHaveValue('2026-11-05')
    expect(screen.getByLabelText(/^이름/)).toHaveFocus()
    expect(screen.getByText('참고용 값입니다. 차량 매뉴얼을 우선하세요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('이름·주기·마지막 교체 정보를 넣고 저장하면 검사를 통과한 값이 onSave로 간다 (AC-06-11)', async () => {
    const { onSave, onClose } = setup()
    type(/^이름/, '타이어')
    type(/^개월 주기/, '48')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith({ name: '타이어', intervalKm: null, intervalMonths: 48, lastDate: '2026-11-05', lastOdometerKm: null }, undefined)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('km·개월을 모두 비우면 MSG-09가 두 칸 아래 한 곳에 보이고 저장 요청이 0건이며 첫 주기 칸으로 포커스가 간다 (AC-06-9)', () => {
    const { onSave } = setup()
    type(/^이름/, '타이어')
    save()
    expect(screen.getAllByText('교체 주기는 km 또는 개월 중 하나 이상 입력해 주세요')).toHaveLength(1)
    const km = screen.getByLabelText(/^km 주기/)
    expect(km).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/^개월 주기/)).toHaveAttribute('aria-invalid', 'true')
    expect(km).toHaveFocus()
    expect(km.getAttribute('aria-describedby')).toBe(screen.getByLabelText(/^개월 주기/).getAttribute('aria-describedby'))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('km 주기가 있는데 마지막 교체 주행거리가 비면 MSG-19 (AC-06-9)', () => {
    const { onSave } = setup()
    type(/^이름/, '엔진오일')
    type(/^km 주기/, '10000')
    save()
    expect(screen.getByText('마지막 교체 주행거리를 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByLabelText(/^마지막 교체 주행거리/)).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it.each([
    ['0', 'km 주기은(는) 1 이상의 정수로 입력해 주세요'],
    ['-1', 'km 주기은(는) 1 이상의 정수로 입력해 주세요'],
    ['1000000', 'km 주기은(는) 999,999 이하로 입력해 주세요'],
  ])('km 주기 %s는 오류를 보이고 저장 요청이 0건이다 (AC-06-17)', (value, message) => {
    const { onSave } = setup()
    type(/^이름/, '엔진오일')
    type(/^km 주기/, value)
    type(/^마지막 교체 주행거리/, '1000')
    save()
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('미래 마지막 교체일은 MSG-20이고 저장 요청이 없다', () => {
    const { onSave } = setup()
    type(/^이름/, '타이어')
    type(/^개월 주기/, '12')
    type(/^마지막 교체일/, '2026-11-06')
    save()
    expect(screen.getByText('마지막 교체일은 오늘 또는 그 이전 날짜로 입력해 주세요')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('저장 흐름 (AC-10-1·2)', () => {
  function fill() {
    type(/^이름/, '타이어')
    type(/^개월 주기/, '48')
  }

  it('저장하는 동안 저장 버튼이 잠기고 두 번 눌러도 요청은 1건이다', async () => {
    let finish: (v: boolean) => void = () => {}
    const { onSave } = setup({ onSave: () => new Promise<boolean>((r) => (finish = r)) })
    fill()
    const button = screen.getByRole('button', { name: '저장' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    await act(async () => finish(true))
  })

  it('저장이 실패하면 양식과 입력값이 남고 저장 버튼이 다시 켜진다', async () => {
    const { onSave, onClose } = setup({ onSave: () => Promise.resolve(false) })
    fill()
    await act(async () => save())
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^이름/)).toHaveValue('타이어')
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })

  it('취소는 저장 없이 닫는다', () => {
    const { onSave, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('수정과 삭제 (F-06, F-11)', () => {
  it('수정 양식에 기존 값이 채워지고 저장하면 그 id로 저장한다', async () => {
    const { onSave } = setup({ item: existing })
    expect(screen.getByRole('dialog', { name: '교체 항목 수정' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^이름/)).toHaveValue('엔진오일')
    expect(screen.getByLabelText(/^개월 주기/)).toHaveValue('12')
    type(/^개월 주기/, '6')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith({ name: '엔진오일', intervalKm: 10000, intervalMonths: 6, lastDate: '2026-05-12', lastOdometerKm: 31200 }, 'i1')
  })

  it('"삭제"는 확인창(교체 항목 이름)을 거치고 확인하면 삭제 요청이 1건 나가고 양식이 닫힌다', async () => {
    const onDelete = vi.fn(() => Promise.resolve(true))
    const { onClose } = setup({ item: existing, onDelete })
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    const dialog = screen.getByRole('dialog', { name: '삭제 확인' })
    expect(dialog).toHaveTextContent('교체 항목 엔진오일을(를) 삭제할까요?')
    expect(onDelete).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === '삭제')!)
    })
    expect(onDelete).toHaveBeenCalledWith('i1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('삭제 확인에서 취소하면 삭제 요청이 없고 양식이 남는다 (AC-11-4)', async () => {
    const onDelete = vi.fn(() => Promise.resolve(true))
    const { onClose } = setup({ item: existing, onDelete })
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    const dialog = screen.getByRole('dialog', { name: '삭제 확인' })
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === '취소')!)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '삭제 확인' })).not.toBeInTheDocument())
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
