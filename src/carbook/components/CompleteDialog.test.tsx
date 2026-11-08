// CompleteDialog 테스트(F-06 BR-15, AC-06-10): 기본값, 확인 시 반영 값, 입력 검사, 중복 제출·실패
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CompleteDialog from './CompleteDialog'

type Props = Partial<React.ComponentProps<typeof CompleteDialog>>

function setup(props: Props = {}) {
  const onComplete = vi.fn(props.onComplete ?? (() => Promise.resolve(true)))
  const onClose = vi.fn()
  render(<CompleteDialog item={{ id: 'i1', name: '엔진오일', intervalKm: 10000 }} currentKm={48000} {...props} onComplete={onComplete} onClose={onClose} />)
  return { onComplete, onClose }
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const confirm = () => fireEvent.click(screen.getByRole('button', { name: '확인' }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T09:00:00+09:00'))
})
afterEach(() => vi.useRealTimers())

describe('교체 완료 (AC-06-10)', () => {
  it('제목 아래에 항목 이름이 있고 날짜는 오늘, 주행거리는 현재 주행거리가 기본값이며 날짜 칸에 포커스가 있다', () => {
    setup()
    expect(screen.getByRole('dialog', { name: '교체 완료' })).toBeInTheDocument()
    expect(screen.getByText('엔진오일')).toBeInTheDocument()
    expect(screen.getByLabelText(/^마지막 교체일/)).toHaveValue('2026-11-05')
    expect(screen.getByLabelText(/^마지막 교체 주행거리/)).toHaveValue('48000')
    expect(screen.getByLabelText(/^마지막 교체일/)).toHaveFocus()
  })

  it('확인하면 입력한 날짜·주행거리로 완료하고 창을 닫는다', async () => {
    const { onComplete, onClose } = setup()
    type(/^마지막 교체 주행거리/, '48500')
    await act(async () => confirm())
    expect(onComplete).toHaveBeenCalledWith('i1', { date: '2026-11-05', odometerKm: 48500 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('현재 주행거리가 0(정보 없음)이면 칸이 비어 있고, km 주기 항목은 그대로 확인하면 MSG-19로 안내한다 (BR-06 취지)', () => {
    const { onComplete } = setup({ currentKm: 0 })
    expect(screen.getByLabelText(/^마지막 교체 주행거리/)).toHaveValue('')
    confirm()
    expect(screen.getByText('마지막 교체 주행거리를 입력해 주세요')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('km 주기가 없는 항목은 주행거리를 비워도 완료된다', async () => {
    const { onComplete } = setup({ item: { id: 'i2', name: '에어컨 필터', intervalKm: null }, currentKm: 0 })
    type(/^마지막 교체 주행거리/, '')
    await act(async () => confirm())
    expect(onComplete).toHaveBeenCalledWith('i2', { date: '2026-11-05', odometerKm: null })
  })

  it('km 주기가 있는데 주행거리가 비면 MSG-19이고 요청이 없다', () => {
    const { onComplete } = setup()
    type(/^마지막 교체 주행거리/, '')
    confirm()
    expect(screen.getByText('마지막 교체 주행거리를 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByLabelText(/^마지막 교체 주행거리/)).toHaveFocus()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('미래 날짜는 MSG-20, 비운 날짜는 필수 오류이고 요청이 없다', () => {
    const { onComplete } = setup()
    type(/^마지막 교체일/, '2026-11-06')
    confirm()
    expect(screen.getByText('마지막 교체일은 오늘 또는 그 이전 날짜로 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByLabelText(/^마지막 교체일/)).toHaveAttribute('aria-invalid', 'true')
    type(/^마지막 교체일/, '')
    confirm()
    expect(screen.getByText('마지막 교체일을(를) 입력해 주세요')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('요청 중 두 번 눌러도 1건이고, 실패하면 창과 입력값이 남고 확인 버튼이 다시 켜진다 (AC-10-1·2)', async () => {
    let finish: (v: boolean) => void = () => {}
    const { onComplete, onClose } = setup({ onComplete: () => new Promise<boolean>((r) => (finish = r)) })
    type(/^마지막 교체 주행거리/, '48200')
    const button = screen.getByRole('button', { name: '확인' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    await act(async () => finish(false))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^마지막 교체 주행거리/)).toHaveValue('48200')
    expect(button).toBeEnabled()
  })

  it('취소는 반영 없이 닫는다', () => {
    const { onComplete, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })
})
