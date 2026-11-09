// DueDateForm 테스트(F-07, AC-07-1·2·4·5): 입력·수정 양식, 날짜 검사, 중복 제출·저장 실패
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

describe('자동차세 빠른 선택 (F-15, AC-15-1~4, 오늘 2026-11-05)', () => {
  const chip = (name: string) => screen.getByRole('button', { name })

  it('"12월 31일"은 날짜 칸을 2026-12-31로, "6월 30일"은 다음 해 2027-06-30으로 채운다 (AC-15-1·2)', () => {
    setup({ kind: 'car_tax' })
    fireEvent.click(chip('12월 31일'))
    expect(screen.getByLabelText('만기일 (필수)')).toHaveValue('2026-12-31')
    fireEvent.click(chip('6월 30일'))
    expect(screen.getByLabelText('만기일 (필수)')).toHaveValue('2027-06-30')
  })

  it('버튼을 눌러도 저장되지 않고 닫으면 아무것도 만들어지지 않는다 (AC-15-3, BR-18)', () => {
    const { onSave, onClose } = setup({ kind: 'car_tax' })
    fireEvent.click(chip('12월 31일'))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('누른 뒤 직접 고친 값이 저장된다', async () => {
    const { onSave } = setup({ kind: 'car_tax' })
    fireEvent.click(chip('12월 31일'))
    type('2026-12-15')
    await act(async () => save())
    expect(onSave).toHaveBeenCalledWith('car_tax', '2026-12-15')
  })

  it('보험·정기검사 양식에는 빠른 선택 버튼이 없다 (AC-15-4)', () => {
    setup({ kind: 'insurance' })
    expect(screen.queryByRole('button', { name: /6월 30일|12월 31일/ })).not.toBeInTheDocument()
  })

  it('채워지면 화면낭독기에 알리고, 앞서 있던 날짜 오류는 지운다', async () => {
    setup({ kind: 'car_tax' })
    type('')
    save()
    expect(screen.getByText('만기일을(를) 입력해 주세요')).toBeInTheDocument()
    fireEvent.click(chip('6월 30일'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('만기일 칸 값: 2027-06-30'))
    expect(screen.queryByText('만기일을(를) 입력해 주세요')).not.toBeInTheDocument()
  })

  it('같은 버튼을 다시 눌러도, 직접 고친 뒤 같은 버튼을 눌러도 알림이 비었다가 다시 채워져 변화가 생긴다 (Auditor, 4.1.3)', async () => {
    setup({ kind: 'car_tax' })
    const status = screen.getByRole('status')
    const texts: string[] = []
    const observer = new MutationObserver(() => texts.push(status.textContent ?? ''))
    observer.observe(status, { childList: true, characterData: true, subtree: true })
    fireEvent.click(chip('12월 31일'))
    await waitFor(() => expect(status).toHaveTextContent('만기일 칸 값: 2026-12-31'))
    fireEvent.click(chip('12월 31일')) // 같은 버튼 연속
    await waitFor(() => expect(texts.filter((t) => t === '만기일 칸 값: 2026-12-31')).toHaveLength(2))
    type('2026-12-15')
    fireEvent.click(chip('12월 31일')) // 직접 고친 뒤 재선택
    await waitFor(() => expect(texts.filter((t) => t === '만기일 칸 값: 2026-12-31')).toHaveLength(3))
    observer.disconnect()
    expect(texts).toContain('')
  })

  it('오늘이 6월 30일이면 "6월 30일"은 오늘, 1월 1일이면 다음 해 날짜다', () => {
    vi.setSystemTime(new Date('2026-06-30T09:00:00+09:00'))
    const first = render(<DueDateForm kind="car_tax" onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(chip('6월 30일'))
    expect(screen.getByLabelText('만기일 (필수)')).toHaveValue('2026-06-30')
    first.unmount()
    vi.setSystemTime(new Date('2027-01-01T09:00:00+09:00'))
    render(<DueDateForm kind="car_tax" onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(chip('12월 31일'))
    expect(screen.getByLabelText('만기일 (필수)')).toHaveValue('2027-12-31')
  })
})
