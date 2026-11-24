// AccountMenu 테스트(F-17·F-18, AC-17-1~10, AC-18-1~10): 사진·이니셜·이름 표시, 접근성 이름, 메뉴 키보드, 로그아웃 확인·실패·성공
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountMenu from './AccountMenu'

const m = vi.hoisted(() => ({ signOutAll: vi.fn(), showToast: vi.fn() }))
vi.mock('../data/auth', () => ({ signOutAll: m.signOutAll }))
vi.mock('../../state/useToast', () => ({ useToast: () => ({ showToast: m.showToast }) }))

const user = { email: 'carbook@example.com', user_metadata: { full_name: '김차계', avatar_url: 'https://example.com/a.png' } }

function setup(props: Partial<React.ComponentProps<typeof AccountMenu>> = {}) {
  const onOpenSettings = vi.fn()
  render(
    <main id="main-content" tabIndex={-1}>
      <AccountMenu user={user} onOpenSettings={onOpenSettings} {...props} />
    </main>,
  )
  return { onOpenSettings, button: screen.getByRole('button', { name: /^계정 메뉴/ }) }
}

beforeEach(() => {
  m.signOutAll.mockReset().mockResolvedValue(undefined)
  m.showToast.mockReset()
})

describe('계정 버튼 표시 (AC-17-1~4·10)', () => {
  it('이름과 이메일이 글자로 보이고 접근성 이름은 "계정 메뉴, 이름"이다', () => {
    const { button } = setup()
    expect(button).toHaveAccessibleName('계정 메뉴, 김차계')
    expect(button).toHaveTextContent('김차계')
    expect(button).toHaveTextContent('carbook@example.com')
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('사진은 장식(alt 빈 값)이고 referrer를 보내지 않으며 실패하면 지우고 이니셜만 남긴다', () => {
    const { button } = setup()
    const img = button.querySelector('img')!
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
    fireEvent.error(img)
    expect(button.querySelector('img')).toBeNull()
    expect(button).toHaveTextContent('김')
  })

  it('이름이 없으면 이메일만 보이고 이니셜은 이메일 첫 글자이며 이름은 이메일이다', () => {
    const { button } = setup({ user: { email: 'carbook@example.com', user_metadata: {} } })
    expect(button).toHaveAccessibleName('계정 메뉴, carbook@example.com')
    expect(button).toHaveTextContent('C')
    expect(button.querySelector('img')).toBeNull()
  })

  it('https가 아닌 사진 주소는 쓰지 않는다', () => {
    const { button } = setup({ user: { email: 'a@b.c', user_metadata: { full_name: '김', avatar_url: 'http://x/a.png' } } })
    expect(button.querySelector('img')).toBeNull()
  })
})

describe('메뉴 열고 닫기 (AC-18-1)', () => {
  it('누르면 "설정"·"로그아웃" 순서로 열리고 첫 항목에 포커스가 간다', () => {
    const { button } = setup()
    fireEvent.click(button)
    const items = screen.getAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual(['설정', '로그아웃'])
    expect(items[0]).toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('아래 화살표로도 열린다. 위·아래는 끝에서 순환하지 않고 Home·End가 처음·끝으로 간다', () => {
    const { button } = setup()
    fireEvent.keyDown(button, { key: 'ArrowDown' })
    const [settings, logout] = screen.getAllByRole('menuitem')
    expect(settings).toHaveFocus()
    fireEvent.keyDown(settings, { key: 'ArrowDown' })
    expect(logout).toHaveFocus()
    fireEvent.keyDown(logout, { key: 'ArrowDown' })
    expect(logout).toHaveFocus()
    fireEvent.keyDown(logout, { key: 'Home' })
    expect(settings).toHaveFocus()
    fireEvent.keyDown(settings, { key: 'End' })
    expect(logout).toHaveFocus()
  })

  it('Esc로 닫으면 포커스가 계정 버튼으로 돌아온다', () => {
    const { button } = setup()
    fireEvent.click(button)
    fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('메뉴 밖을 누르면 닫히고 포커스가 계정 버튼으로 돌아온다', () => {
    const { button } = setup()
    fireEvent.click(button)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('"설정"을 고르면 메뉴가 닫히고 onOpenSettings가 한 번 불린다', () => {
    const { button, onOpenSettings } = setup()
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('menuitem', { name: '설정' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('로그아웃 확인 (AC-18-2~10)', () => {
  const openConfirm = () => {
    const ctx = setup()
    fireEvent.click(ctx.button)
    fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }))
    return { ...ctx, dialog: screen.getByRole('dialog', { name: '로그아웃 확인' }) }
  }

  it('"로그아웃"을 고르면 확인창(MSG-22)이 뜨고 포커스는 "취소"이며 요청은 0건이다', () => {
    const { dialog } = openConfirm()
    expect(dialog).toHaveTextContent('로그아웃할까요? 모든 기기에서 로그아웃됩니다')
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus()
    expect(m.signOutAll).not.toHaveBeenCalled()
  })

  it('취소하면 요청 없이 닫히고 포커스가 계정 버튼으로 돌아온다 (AC-18-5)', async () => {
    const { dialog, button } = openConfirm()
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(button).toHaveFocus(), { timeout: 5000 })
    expect(m.signOutAll).not.toHaveBeenCalled()
  })

  it('확인하면 signOutAll이 한 번 불리고 성공하면 포커스가 main으로 간다', async () => {
    const { dialog } = openConfirm()
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '로그아웃' })))
    expect(m.signOutAll).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.getElementById('main-content')).toHaveFocus(), { timeout: 5000 })
    expect(m.showToast).not.toHaveBeenCalled()
  })

  it('실패하면 MSG-23 토스트를 띄우고 확인창이 닫히며 포커스가 계정 버튼으로 돌아온다 (AC-18-6)', async () => {
    m.signOutAll.mockRejectedValue(new Error('network'))
    const { dialog, button } = openConfirm()
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '로그아웃' })))
    expect(m.showToast).toHaveBeenCalledWith({ message: '로그아웃하지 못했습니다. 다시 시도해 주세요', tone: 'error' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 5000 })
    await waitFor(() => expect(button).toHaveFocus(), { timeout: 5000 })
  })
})
