// RecordForm 테스트 1/2(F-04): 7종 저장(AC-04-1), 필수·형식 오류(04·05), 저장 실패 시 입력 유지(07), 주유 전용 칸(08), 중복 제출(AC-10-2)
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { today } from '../domain/dateKey'
import { RECORD_KINDS } from '../domain/types'
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
const kindLabel: Record<string, string> = { fuel: '주유', maintenance: '정비', wash: '세차', insurance: '보험', tax: '세금', parking: '주차', other: '기타' }


describe('RecordForm 추가', () => {
  it('제목이 "기록 추가"이고 종류 7종 선택과 오늘 날짜 기본값이 있다', () => {
    setup()
    expect(screen.getByRole('dialog', { name: '기록 추가' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^날짜/)).toHaveValue(today())
    expect(screen.getByLabelText(/^종류/)).toHaveFocus()
    const options = Array.from((screen.getByLabelText(/^종류/) as HTMLSelectElement).options).map((o) => o.text)
    expect(options).toEqual(['선택', '주유', '정비', '세차', '보험', '세금', '주차', '기타'])
  })

  it.each(RECORD_KINDS)('AC-04-1: 종류 %s를 날짜·금액만 넣어 저장한다', async (kind) => {
    const { onSave, onClose } = setup()
    pickKind(kind)
    type(/^날짜/, '2026-11-03')
    type(/^금액/, '10000')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith({ kind, date: '2026-11-03', amountWon: 10000, odometerKm: null, liters: null, fullTank: false, memo: null }, undefined)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(kindLabel[kind]).toBeTruthy()
  })

  it('주유량·가득 주유 칸은 종류가 주유일 때만 보인다', () => {
    setup()
    expect(screen.queryByLabelText(/^주유량/)).not.toBeInTheDocument()
    pickKind('fuel')
    expect(screen.getByLabelText(/^주유량/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '가득 주유' })).not.toBeChecked() // 기본 해제
    pickKind('wash')
    expect(screen.queryByLabelText(/^주유량/)).not.toBeInTheDocument()
  })

  it('AC-04-8: 주유로 입력한 주유량·가득을 세차로 바꿔 저장하면 그 값은 저장되지 않는다', async () => {
    const { onSave } = setup()
    pickKind('fuel')
    type(/^금액/, '50000')
    type(/^주유량/, '30')
    fireEvent.click(screen.getByRole('checkbox', { name: '가득 주유' }))
    pickKind('wash')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kind: 'wash', liters: null, fullTank: false }), undefined)
  })
})

describe('입력 오류 (AC-04-4·05)', () => {
  it('금액·종류·날짜가 비면 MSG-05가 칸 아래에 보이고 저장 요청은 0건이다', () => {
    const { onSave } = setup()
    type(/^날짜/, '')
    save()
    expect(screen.getByText('종류을(를) 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByText('날짜을(를) 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByText('금액을(를) 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByLabelText(/^종류/)).toHaveFocus() // 첫 오류 칸
    expect(onSave).not.toHaveBeenCalled()
  })

  it.each([['-100'], ['12.5']])('금액 %s는 MSG-06이다', (amount) => {
    const { onSave } = setup()
    pickKind('other')
    type(/^금액/, amount)
    save()
    expect(screen.getByText('금액은(는) 0 이상의 정수로 입력해 주세요')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('주유량 abc는 MSG-07, 10000은 MSG-17이다', () => {
    const { onSave } = setup()
    pickKind('fuel')
    type(/^금액/, '1000')
    type(/^주유량/, 'abc')
    save()
    expect(screen.getByText('주유량은 0 이상의 숫자(소수 둘째 자리까지)로 입력해 주세요')).toBeInTheDocument()
    type(/^주유량/, '10000')
    save()
    expect(screen.getByText('주유량은(는) 9,999.99 이하로 입력해 주세요')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('저장 (AC-04-7, AC-10-2)', () => {
  it('저장이 실패(false)하면 양식과 입력값이 그대로 남는다', async () => {
    const { onClose } = setup({ onSave: () => Promise.resolve(false) })
    pickKind('other')
    type(/^금액/, '1000')
    type(/^메모/, '메모 내용')
    await act(async () => save())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^금액/)).toHaveValue('1000')
    expect(screen.getByLabelText(/^메모/)).toHaveValue('메모 내용')
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })

  it('저장 중에는 저장 버튼이 비활성이고 연속 제출해도 요청은 1건이다', async () => {
    let finish: (ok: boolean) => void = () => {}
    const { onSave } = setup({ onSave: () => new Promise<boolean>((resolve) => (finish = resolve)) })
    pickKind('other')
    type(/^금액/, '1000')
    const form = screen.getByRole('button', { name: '저장' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
    await act(async () => finish(false))
  })

  it('창 밖(스크림) 클릭으로는 닫히지 않는다', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('dialog', { name: '기록 추가' }).parentElement!)
    expect(onClose).not.toHaveBeenCalled()
  })
})
