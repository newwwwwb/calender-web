// ConfirmDialog 테스트(F-11): 문구·경고, 취소 기본 포커스, 취소·Esc·창 밖 클릭은 삭제 요청 0건, 삭제는 1건·중복 방지·실패 시 유지
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

function setup(onConfirm = vi.fn(() => Promise.resolve(true)), warning?: string) {
  const onClose = vi.fn()
  render(<ConfirmDialog target="차량 출퇴근" warning={warning} onConfirm={onConfirm} onClose={onClose} />)
  return { onConfirm, onClose }
}

describe('ConfirmDialog 문구와 포커스', () => {
  it('제목과 MSG-13 문구에 대상 이름이 들어간다(AC-11-3)', () => {
    setup()
    expect(screen.getByRole('dialog', { name: '삭제 확인' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '삭제할까요?' })).toBeInTheDocument()
    expect(screen.getByText('차량 출퇴근을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다')).toBeInTheDocument()
  })

  it('경고(차량의 MSG-14)를 주면 문구 아래에 보인다', () => {
    setup(undefined, '이 차량의 기록, 교체 항목, 만기일, 캘린더 일정이 모두 삭제됩니다')
    expect(screen.getByText('이 차량의 기록, 교체 항목, 만기일, 캘린더 일정이 모두 삭제됩니다')).toBeInTheDocument()
  })

  it('열리면 포커스가 "취소"에 있다', () => {
    setup()
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()
  })
})

describe('취소(삭제 요청 0건)', () => {
  it('AC-11-1: "취소"를 누르면 닫히고 삭제 요청이 없다', () => {
    const { onConfirm, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('AC-11-4: Esc를 누르면 닫히고 삭제 요청이 없다', () => {
    const { onConfirm, onClose } = setup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('창 밖(스크림)을 누르면 취소다', () => {
    const { onConfirm, onClose } = setup()
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('삭제', () => {
  it('AC-11-2: "삭제"를 누르면 요청이 1건 나가고 성공하면 닫힌다. 연속 클릭에도 1건이다', async () => {
    const { onConfirm, onClose } = setup()
    const button = screen.getByRole('button', { name: '삭제' })
    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('요청이 실패(false)하면 창이 그대로 남고 다시 누를 수 있다', async () => {
    const onConfirm = vi.fn(() => Promise.resolve(false))
    const { onClose } = setup(onConfirm)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '삭제' })).toBeEnabled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    })
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })

  it('삭제 요청이 reject돼도 창이 잠기지 않고 다시 누를 수 있다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onConfirm = vi.fn(() => Promise.reject(new Error('boom')))
    const { onClose } = setup(onConfirm as unknown as ReturnType<typeof vi.fn<() => Promise<boolean>>>)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '삭제' })).toBeEnabled()
    error.mockRestore()
  })

  it('삭제 요청 중에도 닫을 수 있고(끌어 닫기 포함), 끝난 뒤 onClose를 또 부르지 않는다', async () => {
    let finish: (ok: boolean) => void = () => {}
    const { onClose } = setup(vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve))))
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    await act(async () => finish(true))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('삭제 중에는 삭제 버튼이 비활성이다', async () => {
    let finish: (ok: boolean) => void = () => {}
    const onConfirm = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)))
    setup(onConfirm)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled()
    await act(async () => finish(false))
    expect(screen.getByRole('button', { name: '삭제' })).toBeEnabled()
  })
})

describe('ConfirmDialog 다른 확인(DLG-04 등)에도 쓴다', () => {
  it('제목·문구·확인 버튼 이름을 바꿀 수 있고 취소가 기본 포커스다', async () => {
    const onConfirm = vi.fn(() => Promise.resolve(true))
    const onClose = vi.fn()
    render(<ConfirmDialog label="주행거리 확인" title="주행거리가 작습니다" message="그래도 저장할까요?" confirmLabel="저장" tone="primary" onConfirm={onConfirm} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: '주행거리 확인' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '주행거리가 작습니다' })).toBeInTheDocument()
    expect(screen.getByText('그래도 저장할까요?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }))
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
