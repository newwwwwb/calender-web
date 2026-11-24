// SettingsDialog 테스트(F-19·F-20, AC-19-10·11·13, AC-20-4·5·10~13): 기본 차량 라디오, 읽기 실패·0대, 되돌리기 미리보기·결과 한 줄
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ResetPlan, ResetResult, Vehicle } from '../domain/types'
import SettingsDialog from './SettingsDialog'

const car = (id: string, name: string, model: string | null = null): Vehicle => ({ id, name, model, year: null, plate: null, odometerKm: null, createdAt: id })
const plan = (n: number): ResetPlan => ({
  changes: Array.from({ length: n }, (_, i) => ({ itemId: `i${i}`, name: i === 0 ? '엔진오일' : `항목${i}`, from: { intervalKm: 15000, intervalMonths: 6 }, to: { intervalKm: 10000, intervalMonths: 12 } })),
})

function setup(props: Partial<React.ComponentProps<typeof SettingsDialog>> = {}) {
  const fns = {
    onSetDefault: vi.fn((id: string | null) => Promise.resolve(id !== undefined)),
    onReset: vi.fn((): Promise<ResetResult | null> => Promise.resolve({ count: 2, calendarFailed: false })),
    onClose: vi.fn(),
  }
  const vehicles = [car('a', '출퇴근', '아반떼'), car('b', '주말')]
  render(<SettingsDialog vehicles={vehicles} targetVehicle={vehicles[0]} defaultVehicleId="a" settingsFailed={false} resetPlan={plan(2)} {...fns} {...props} />)
  return fns
}

const dialog = () => screen.getByRole('dialog', { name: '설정' })
const previewName = '추천 교체 주기 되돌리기'
const preview = () => screen.getByRole('dialog', { name: previewName })
const resetButton = () => within(dialog()).getByRole('button', { name: '되돌리기' })

describe('기본 차량 (F-19)', () => {
  it('"지정 안 함"과 차량 별칭(차종)이 라디오로 있고 현재 지정이 선택되며 포커스가 그 라디오에 있다', () => {
    setup()
    const radios = within(dialog()).getAllByRole('radio')
    expect(radios.map((r) => r.closest('label')!.textContent)).toEqual(['지정 안 함', '출퇴근아반떼', '주말'])
    expect(within(dialog()).getByRole('radio', { name: /출퇴근/ })).toBeChecked()
    expect(within(dialog()).getByRole('radio', { name: /출퇴근/ })).toHaveFocus()
    expect(within(dialog()).getByText('지금 보는 차량은 그대로이고 다음에 차계부를 열 때부터 적용됩니다')).toBeInTheDocument()
  })

  it('고르면 즉시 onSetDefault가 불리고, "지정 안 함"은 null이다', async () => {
    const { onSetDefault } = setup()
    await act(async () => fireEvent.click(within(dialog()).getByRole('radio', { name: '주말' })))
    expect(onSetDefault).toHaveBeenCalledWith('b')
    await act(async () => fireEvent.click(within(dialog()).getByRole('radio', { name: '지정 안 함' })))
    expect(onSetDefault).toHaveBeenLastCalledWith(null)
    expect(onSetDefault).toHaveBeenCalledTimes(2)
  })

  it('저장 중에는 선택이 따라가고 "저장 중"이 읽히며 중복 요청이 없고, 실패하면 이전 값으로 돌아간다 (AC-19-7)', async () => {
    let finish: (ok: boolean) => void = () => {}
    const onSetDefault = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)))
    setup({ onSetDefault })
    const weekend = within(dialog()).getByRole('radio', { name: '주말' })
    fireEvent.click(weekend)
    expect(weekend).toBeChecked()
    expect(within(dialog()).getByText('저장 중')).toBeInTheDocument()
    fireEvent.click(within(dialog()).getByRole('radio', { name: '지정 안 함' }))
    expect(onSetDefault).toHaveBeenCalledTimes(1)
    await act(async () => finish(false)) // 실패: 훅의 defaultVehicleId는 그대로 'a'
    expect(within(dialog()).getByRole('radio', { name: /출퇴근/ })).toBeChecked()
    expect(within(dialog()).queryByText('저장 중')).not.toBeInTheDocument()
  })

  it('설정 읽기 실패면 선택 표시 없이 MSG-33이 보이고 그래도 고를 수 있다 (AC-19-13)', async () => {
    const { onSetDefault } = setup({ settingsFailed: true, defaultVehicleId: null })
    expect(within(dialog()).getByText('현재 지정을 불러오지 못했습니다')).toBeInTheDocument()
    within(dialog()).getAllByRole('radio').forEach((r) => expect(r).not.toBeChecked())
    await act(async () => fireEvent.click(within(dialog()).getByRole('radio', { name: '지정 안 함' })))
    expect(onSetDefault).toHaveBeenCalledWith(null)
  })

  it('차량 0대면 라디오 없이 "차량을 추가해 주세요"만 보이고 되돌리기는 aria-disabled이며 포커스는 "닫기"다 (AC-19-10, AC-20-10)', () => {
    const { onReset } = setup({ vehicles: [], targetVehicle: null, defaultVehicleId: null, resetPlan: plan(0) })
    expect(within(dialog()).queryByRole('radio')).not.toBeInTheDocument()
    expect(within(dialog()).getAllByText('차량을 추가해 주세요')).toHaveLength(2)
    expect(resetButton()).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(resetButton())
    expect(onReset).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: previewName })).not.toBeInTheDocument()
    expect(within(dialog()).getByRole('button', { name: '닫기' })).toHaveFocus()
  })

  it('닫기 버튼과 Esc로 닫는다 (AC-19-11)', () => {
    const { onClose } = setup()
    fireEvent.click(within(dialog()).getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('추천 주기 되돌리기 (F-20)', () => {
  it('대상 차량이 보이고 바꿀 항목이 없으면 확인창 없이 MSG-24만 보이며 쓰기가 없다 (AC-20-4)', async () => {
    const { onReset } = setup({ resetPlan: plan(0) })
    expect(within(dialog()).getByText('대상 차량:', { exact: false }).closest('p')).toHaveTextContent('대상 차량: 출퇴근')
    fireEvent.click(resetButton())
    expect(await within(dialog()).findByText('추천 주기와 다른 항목이 없습니다')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: previewName })).not.toBeInTheDocument()
    expect(onReset).not.toHaveBeenCalled()
  })

  it('바꿀 항목이 있으면 미리보기(MSG-25, 지금 → 추천 목록)가 겹쳐 열리고 포커스는 "취소"이며 요청은 0건이다', () => {
    const { onReset } = setup()
    fireEvent.click(resetButton())
    expect(preview()).toHaveTextContent('추천 교체 주기로 되돌릴까요? 주기가 바뀌는 항목 2개')
    const first = within(preview()).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('엔진오일')
    expect(first).toHaveTextContent('지금 15,000km / 6개월 → 추천 10,000km / 12개월')
    expect(within(preview()).getByRole('button', { name: '취소' })).toHaveFocus()
    expect(onReset).not.toHaveBeenCalled()
  })

  it('취소하면 요청 없이 닫히고 포커스가 설정 창의 "되돌리기"로 돌아온다 (AC-20-5)', async () => {
    const { onReset } = setup()
    resetButton().focus()
    fireEvent.click(resetButton())
    fireEvent.click(within(preview()).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: previewName })).not.toBeInTheDocument(), { timeout: 5000 })
    await waitFor(() => expect(resetButton()).toHaveFocus(), { timeout: 5000 })
    expect(onReset).not.toHaveBeenCalled()
  })

  it('확인하면 onReset이 한 번 불리고 창이 닫히며 설정 창에 MSG-34가 보인다 (AC-20-11)', async () => {
    const { onReset } = setup()
    fireEvent.click(resetButton())
    const confirm = within(preview()).getByRole('button', { name: '되돌리기' })
    await act(async () => {
      fireEvent.click(confirm)
      fireEvent.click(confirm) // 연속 누름은 1회
    })
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(await within(dialog()).findByText('2개 항목의 주기를 되돌렸습니다')).toBeInTheDocument()
    expect(within(dialog()).queryByText(/일부 항목은 캘린더/)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: previewName })).not.toBeInTheDocument(), { timeout: 5000 })
  })

  it('일정 쓰기 실패가 있으면 MSG-35가 이어진다 (AC-20-12)', async () => {
    setup({ onReset: vi.fn(() => Promise.resolve({ count: 1, calendarFailed: true })) })
    fireEvent.click(resetButton())
    await act(async () => fireEvent.click(within(preview()).getByRole('button', { name: '되돌리기' })))
    expect(await within(dialog()).findByText('1개 항목의 주기를 되돌렸습니다')).toBeInTheDocument()
    expect(within(dialog()).getByText('일부 항목은 캘린더에 반영하지 못했습니다. 교체 알림 탭에서 다시 시도하세요')).toBeInTheDocument()
  })

  it('실패하면 창이 열린 채 버튼이 다시 활성이고 결과 줄이 없다 (AC-20-13)', async () => {
    setup({ onReset: vi.fn(() => Promise.resolve(null)) })
    fireEvent.click(resetButton())
    const confirm = within(preview()).getByRole('button', { name: '되돌리기' })
    await act(async () => fireEvent.click(confirm))
    expect(preview()).toBeInTheDocument()
    expect(confirm).not.toHaveAttribute('aria-disabled')
    expect(within(dialog()).queryByText(/주기를 되돌렸습니다/)).not.toBeInTheDocument()
  })

  it('미리보기에서 Esc는 미리보기만 닫고 설정 창은 남는다', async () => {
    const { onClose } = setup()
    fireEvent.click(resetButton())
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: previewName })).not.toBeInTheDocument(), { timeout: 5000 })
    expect(onClose).not.toHaveBeenCalled()
  })
})
