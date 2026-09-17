// NotificationPanel: 알림 문구, 초대 수락/거절, 빈 상태를 검증
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AppNotification } from '../types'
import NotificationPanel from './NotificationPanel'

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    actorId: 'partner-1',
    actorEmail: 'partner@example.com',
    kind: 'invited',
    status: 'pending',
    eventId: 'e1',
    eventTitle: '저녁 약속',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('NotificationPanel', () => {
  it('알림이 없으면 빈 상태 문구를 보여준다', () => {
    render(<NotificationPanel notifications={[]} onClose={vi.fn()} onRespond={vi.fn()} />)
    expect(screen.getByText('새 알림이 없어요.')).toBeInTheDocument()
  })

  it('초대(pending)는 안내 문구와 수락/거절 버튼을 보여준다', () => {
    render(<NotificationPanel notifications={[notification()]} onClose={vi.fn()} onRespond={vi.fn()} />)
    expect(screen.getByText("partner@example.com님이 '저녁 약속'에 함께하자고 초대했어요")).toBeInTheDocument()
    expect(screen.getByText('수락')).toBeInTheDocument()
    expect(screen.getByText('거절')).toBeInTheDocument()
  })

  it('수락을 누르면 onRespond를 호출하고 버튼 대신 처리 완료 문구를 보여준다', () => {
    const onRespond = vi.fn()
    render(<NotificationPanel notifications={[notification()]} onClose={vi.fn()} onRespond={onRespond} />)

    fireEvent.click(screen.getByText('수락'))

    expect(onRespond).toHaveBeenCalledWith('e1', 'accepted')
    expect(screen.queryByText('수락')).not.toBeInTheDocument()
    expect(screen.getByText('처리했어요')).toBeInTheDocument()
  })

  it('바로 등록된 초대는 수락/거절 버튼이 없다', () => {
    render(
      <NotificationPanel
        notifications={[notification({ status: 'accepted' })]}
        onClose={vi.fn()}
        onRespond={vi.fn()}
      />,
    )
    expect(screen.getByText("partner@example.com님이 '저녁 약속'에 등록했어요")).toBeInTheDocument()
    expect(screen.queryByText('수락')).not.toBeInTheDocument()
  })

  it('수정/삭제/응답 알림은 각각의 문구를 보여준다', () => {
    render(
      <NotificationPanel
        notifications={[
          notification({ id: 'n2', kind: 'updated', status: undefined }),
          notification({ id: 'n3', kind: 'responded', status: 'declined' }),
          notification({ id: 'n4', kind: 'deleted', status: undefined, eventId: undefined }),
        ]}
        onClose={vi.fn()}
        onRespond={vi.fn()}
      />,
    )
    expect(screen.getByText("partner@example.com님이 '저녁 약속'을 수정했어요")).toBeInTheDocument()
    expect(screen.getByText("partner@example.com님이 '저녁 약속'을 거절했어요")).toBeInTheDocument()
    expect(screen.getByText("partner@example.com님이 '저녁 약속'을 삭제했어요")).toBeInTheDocument()
  })

  it('응답이 실패하면(네트워크 등) 사용자에게 알려준다', async () => {
    const onRespond = vi.fn().mockRejectedValue(new Error('boom'))
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<NotificationPanel notifications={[notification()]} onClose={vi.fn()} onRespond={onRespond} />)

    fireEvent.click(screen.getByText('수락'))

    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    alertSpy.mockRestore()
  })

  it('닫기 버튼을 누르면 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<NotificationPanel notifications={[]} onClose={onClose} onRespond={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })
})
