// DueDateForm 테스트(F-07, AC-07-1·2·4·5): 입력·수정 양식, 날짜 검사, 중복 제출·저장 실패
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DueDateForm from './DueDateForm'

type Props = Partial<React.ComponentProps<typeof DueDateForm>>

function setup(props: Props = {}) {
  const onSave = vi.fn(props.onSave ?? (() => Promise.resolve(true)))
  const onClose = vi.fn()
  render(<DueDateForm kind="insurance" {...props} onSave={onSave} onClose={onClose} />)
  return { onSave, onClose }
}

const type = (value: string) => fireEvent.change(screen.getByLabelText('만기일 (필수)'), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: '저장' }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T09:00:00+09:00'))
})
afterEach(() => vi.useRealTimers())

describe('입력 양식 (AC-07-1·3)', () => {
  it('종류는 읽기 전용 글자로 보이고 날짜는 비어 있으며(추정하지 않는다) 날짜 칸에 포커스가 있다', () => {
    setup({ kind: 'car_tax' })
    expect(screen.getByRole('dialog', { name: '자동차세 납부 만기일 입력' })).toBeInTheDocument()
    expect(screen.getByText('자동차세 납부')).toBeInTheDocument()
    expect(screen.getByLabelText('만기일 (필수)')).toHaveValue('')
    expect(screen.getByLabelText('만기일 (필수)')).toHaveFocus()
  })

  it('날짜를 넣고 저장하면 종류와 날짜가 onSave로 가고 창이 닫힌다', async () => {
    const { onSave, onClose } = setup()
    type('2027-03-10')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith('insurance', '2027-03-10')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('지난 날짜도 저장된다(기록으로 둘 수 있다)', async () => {
    const { onSave } = setup()
    type('2026-01-01')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith('insurance', '2026-01-01')
  })
})

describe('수정 양식 (AC-07-2)', () => {
  it('기존 날짜가 채워지고 제목이 "만기일 수정"이며 저장하면 새 날짜로 간다', async () => {
    const { onSave } = setup({ current: '2027-03-10' })
    expect(screen.getByRole('dialog', { name: '보험 만기 만기일 수정' })).toBeInTheDocument()
    expect(screen.getByLabelText('만기일 (필수)')).toHaveValue('2027-03-10')
    type('2027-04-01')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith('insurance', '2027-04-01')
  })
})

describe('검사와 저장 실패 (AC-07-4·5)', () => {
  // 존재하지 않는 날짜(2027-02-30)의 MSG-15는 validateDueDate 단위 테스트가 맡는다 — 날짜 입력칸은 브라우저가 그 값을 비워 버린다
  it.each([['', '만기일을(를) 입력해 주세요']])('날짜 "%s"는 오류를 칸 아래에 보이고 저장 요청이 0건이며 포커스가 칸으로 간다', (value, message) => {
    const { onSave } = setup()
    type(value)
    save()
    expect(screen.getByText(message)).toBeInTheDocument()
    const input = screen.getByLabelText('만기일 (필수)')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('저장 중 두 번 눌러도 요청은 1건이고, 실패하면 입력값이 남고 저장 버튼이 다시 켜진다', async () => {
    let finish: (v: boolean) => void = () => {}
    const { onSave, onClose } = setup({ onSave: () => new Promise<boolean>((r) => (finish = r)) })
    type('2027-03-10')
    const button = screen.getByRole('button', { name: '저장' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    await act(async () => finish(false))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('만기일 (필수)')).toHaveValue('2027-03-10')
    expect(button).toBeEnabled()
  })

  it('취소는 저장 없이 닫는다', () => {
    const { onSave, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})
