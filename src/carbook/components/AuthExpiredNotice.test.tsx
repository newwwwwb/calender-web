// AuthExpiredNotice 테스트: 대화상자 버튼 줄 위의 MSG-30·37 안내, 로그인 버튼, 저장·확정 잠금, 대화상자를 닫으면 해제(AC-27-4·6·7·9·10·11)
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ResetPlan, Vehicle } from '../domain/types'
import { ActionDock, AuthExpiredProvider } from './AuthExpiredNotice'
import ConfirmDialog from './ConfirmDialog'
import RecordForm from './RecordForm'
import SettingsDialog from './SettingsDialog'

afterEach(() => vi.restoreAllMocks())

// 만료는 대화상자가 열린 뒤 쓰기 응답으로 알려진다. 바깥 버튼 "만료 발생"이 그 순간을 흉내 낸다
function Harness({ onLogin = () => Promise.resolve(), children }: { onLogin?: () => Promise<void>; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(true)
  const [expired, setExpired] = useState(false)
  return (
    <AuthExpiredProvider expired={expired} onLogin={onLogin} onDismiss={() => setExpired(false)}>
      <button type="button" onClick={() => setExpired(true)}>
        만료 발생
      </button>
      {open && children(() => setOpen(false))}
    </AuthExpiredProvider>
  )
}
const expire = () => fireEvent.click(screen.getByRole('button', { name: '만료 발생' }))

describe('확인창(AC-27-6)', () => {
  const setup = (onLogin?: () => Promise<void>) => {
    const onConfirm = vi.fn(() => Promise.resolve(true))
    render(<Harness onLogin={onLogin}>{(close) => <ConfirmDialog target="차량 출퇴근" onConfirm={onConfirm} onClose={close} />}</Harness>)
    return { onConfirm, dialog: screen.getByRole('dialog', { name: '삭제 확인' }) }
  }

  it('만료 전에는 안내가 없고, 만료되면 그 대화상자 안 버튼 줄 위에 MSG-30·MSG-37과 "로그인"이 알림으로 보인다', () => {
    const { dialog } = setup()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expire()
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveTextContent('로그인이 만료됐습니다. 다시 로그인해 주세요')
    expect(alert).toHaveTextContent('다시 로그인하면 입력한 내용은 사라집니다')
    expect(within(alert).getByRole('button', { name: '로그인' })).toBeInTheDocument()
    const delButton = within(dialog).getByRole('button', { name: '삭제' })
    // 안내가 삭제·취소 버튼 줄보다 앞에 있다
    expect(alert.compareDocumentPosition(delButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('만료 중 "삭제"는 잠겨 요청이 없고(포커스는 유지), "취소"는 남는다', () => {
    const { onConfirm, dialog } = setup()
    const del = within(dialog).getByRole('button', { name: '삭제' })
    del.focus()
    expire()
    expect(del).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(del)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(del).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: '취소' })).not.toHaveAttribute('aria-disabled')
  })

  it('AC-27-7: "로그인"을 누르면 로그인을 한 번 시작하고 진행 중에는 또 시작하지 않으며 포커스를 유지한다', () => {
    const onLogin = vi.fn(() => new Promise<void>(() => {}))
    setup(onLogin)
    expire()
    const login = screen.getByRole('button', { name: '로그인' })
    login.focus()
    fireEvent.click(login)
    fireEvent.click(login)
    expect(onLogin).toHaveBeenCalledTimes(1)
    expect(login).toHaveAttribute('aria-busy', 'true')
    expect(login).toHaveFocus()
  })

  it('로그인을 시작하지 못하면 진행 표시를 풀고 다시 누를 수 있다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onLogin = vi.fn(() => Promise.reject(new Error('network')))
    setup(onLogin)
    expire()
    const login = screen.getByRole('button', { name: '로그인' })
    await act(async () => fireEvent.click(login))
    expect(login).not.toHaveAttribute('aria-busy')
    await act(async () => fireEvent.click(login))
    expect(onLogin).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalled()
  })

  it('AC-27-11: 취소로 대화상자를 닫으면 안내가 사라지고 만료 상태가 풀려 다음 대화상자에도 남지 않는다', async () => {
    setup()
    expire()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('다시 로그인하면 입력한 내용은 사라집니다')).not.toBeInTheDocument()
  })
})

describe('양식(AC-27-4)', () => {
  it('저장 버튼 클릭(Enter 제출도 이 버튼의 클릭으로 간다)이 막히고 입력값은 그대로다', () => {
    const onSave = vi.fn(() => Promise.resolve(true))
    render(<Harness>{(close) => <RecordForm currentKm={0} onSave={onSave} onClose={close} />}</Harness>)
    fireEvent.change(screen.getByLabelText(/^금액/), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText(/^종류/), { target: { value: 'other' } })
    expire()
    const dialog = screen.getByRole('dialog', { name: '기록 추가' })
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    const save = within(dialog).getByRole('button', { name: '저장' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^금액/)).toHaveValue('10000')
  })
})

describe('설정 창(AC-27-10 나·다)', () => {
  const car = (id: string, name: string): Vehicle => ({ id, name, model: null, year: null, plate: null, odometerKm: null, createdAt: id })
  const plan: ResetPlan = { changes: [{ itemId: 'i0', name: '엔진오일', from: { intervalKm: 15000, intervalMonths: 6 }, to: { intervalKm: 10000, intervalMonths: 12 } }] } as unknown as ResetPlan

  it('설정 창에는 닫기 줄 위에, 되돌리기 미리보기에는 확정 줄 위에 안내가 뜨고 "되돌리기"는 잠기며 "취소"는 남는다', async () => {
    const onReset = vi.fn(() => Promise.resolve(null))
    const vehicles = [car('a', '출퇴근'), car('b', '주말')]
    render(
      <Harness>
        {(close) => <SettingsDialog vehicles={vehicles} targetVehicle={vehicles[0]} defaultVehicleId="a" settingsFailed={false} resetPlan={plan} onSetDefault={() => Promise.resolve(true)} onReset={onReset} onClose={close} />}
      </Harness>,
    )
    fireEvent.click(within(screen.getByRole('dialog', { name: '설정' })).getByRole('button', { name: '되돌리기' }))
    const preview = await screen.findByRole('dialog', { name: '추천 교체 주기 되돌리기' })
    expire()
    expect(within(preview).getByRole('alert')).toHaveTextContent('로그인이 만료됐습니다')
    expect(within(screen.getByRole('dialog', { name: '설정' })).getByRole('alert')).toBeInTheDocument()
    const confirm = within(preview).getByRole('button', { name: '되돌리기' })
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(confirm)
    expect(onReset).not.toHaveBeenCalled()
    expect(within(preview).getByRole('button', { name: '취소' })).not.toHaveAttribute('aria-disabled')
  })
})

describe('열린 대화상자가 없을 때', () => {
  it('만료가 알려져도 보일 곳이 없으니 바로 해제된다(요청 중에 닫은 경우)', async () => {
    render(
      <Harness>{(close) => <ConfirmDialog target="차량 출퇴근" onConfirm={() => Promise.resolve(true)} onClose={close} />}</Harness>,
    )
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expire()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

function ConfirmDialogBody() {
  return (
    <ActionDock>
      <button type="button">취소</button>
    </ActionDock>
  )
}

describe('스크롤 여백(WCAG 2.4.11)', () => {
  it('만료 중에는 붙은 영역이 가린 만큼 대화상자 본문에 아래 스크롤 여백을 두고, 해제되면 지운다', () => {
    function Scrolling() {
      const [expired, setExpired] = useState(false)
      return (
        <AuthExpiredProvider expired={expired} onLogin={() => Promise.resolve()} onDismiss={() => setExpired(false)}>
          <button type="button" onClick={() => setExpired(true)}>
            만료 발생
          </button>
          <div role="dialog" aria-label="본문" data-testid="scroller" style={{ overflowY: 'auto' }}>
            <ConfirmDialogBody />
          </div>
        </AuthExpiredProvider>
      )
    }
    render(<Scrolling />)
    const scroller = screen.getByTestId('scroller')
    expect(scroller.style.scrollPaddingBottom).toBe('')
    expire()
    expect(scroller.style.scrollPaddingBottom).toBe('0px') // jsdom은 높이를 0으로 잰다
  })
})
