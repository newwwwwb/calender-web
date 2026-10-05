// ShareSection: 로그인 여부에 따른 렌더링, 겹쳐보기 토글, 링크 생성/복사/삭제, 멤버 제거를 검증
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as useCalendarModule from '../state/useCalendar'
import * as useShareLinksModule from '../state/useShareLinks'
import { ToastProvider } from '../state/useToast'
import ShareSection from './ShareSection'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockShareLinks(overrides: Partial<ReturnType<typeof useShareLinksModule.useShareLinks>> = {}) {
  vi.spyOn(useShareLinksModule, 'useShareLinks').mockReturnValue({
    links: [],
    membersByShare: {},
    loading: false,
    createLink: vi.fn(),
    deleteLink: vi.fn(),
    removeMember: vi.fn(),
    ...overrides,
  })
}

describe('ShareSection', () => {
  it('로그인하지 않았으면 안내 문구만 보여준다', () => {
    vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
      currentUserId: undefined,
      sharedCalendars: [],
      hiddenOwnerIds: new Set(),
      toggleOwnerVisible: vi.fn(),
    } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    mockShareLinks()

    render(<ShareSection />)
    expect(screen.getByText('로그인하면 캘린더를 공유할 수 있어요.')).toBeInTheDocument()
  })

  it('로그인 상태면 내 캘린더/공유받은 캘린더 토글을 보여주고 클릭 시 toggleOwnerVisible을 호출한다', () => {
    const toggleOwnerVisible = vi.fn()
    vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
      currentUserId: 'me',
      sharedCalendars: [{ ownerId: 'owner-1', ownerEmail: 'owner@example.com' }],
      hiddenOwnerIds: new Set(),
      toggleOwnerVisible,
    } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    mockShareLinks()

    render(<ShareSection />)
    expect(screen.getByLabelText('내 캘린더')).toBeChecked()
    expect(screen.getByLabelText('owner@example.com')).toBeChecked()

    fireEvent.click(screen.getByLabelText('owner@example.com'))
    expect(toggleOwnerVisible).toHaveBeenCalledWith('owner-1')
  })

  it('링크 목록과 멤버를 보여주고, 삭제/제거 버튼이 동작한다', () => {
    vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
      currentUserId: 'me',
      sharedCalendars: [],
      hiddenOwnerIds: new Set(),
      toggleOwnerVisible: vi.fn(),
    } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    const deleteLink = vi.fn()
    const removeMember = vi.fn()
    mockShareLinks({
      links: [{ id: 's1', ownerId: 'me', ownerEmail: 'me@example.com', createdAt: '2026-09-15T00:00:00Z' }],
      membersByShare: { s1: [{ id: 'm1', shareId: 's1', viewerId: 'v1', viewerEmail: 'you@example.com', createdAt: '2026-09-15T00:00:00Z' }] },
      deleteLink,
      removeMember,
    })

    render(<ShareSection />)
    expect(screen.getByText('you@example.com')).toBeInTheDocument()

    // 상대의 열람 권한이 끊기는 동작이라 확인을 거친다 — 거절하면 아무것도 하지 않는다
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByLabelText('공유 링크 삭제'))
    fireEvent.click(screen.getByLabelText('you@example.com 공유 끊기'))
    expect(deleteLink).not.toHaveBeenCalled()
    expect(removeMember).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByLabelText('공유 링크 삭제'))
    expect(deleteLink).toHaveBeenCalledWith('s1')

    fireEvent.click(screen.getByLabelText('you@example.com 공유 끊기'))
    expect(confirmSpy).toHaveBeenLastCalledWith(expect.stringContaining('you@example.com님과 공유를 끊을까요?'))
    expect(removeMember).toHaveBeenCalledWith('m1')
  })

  it('"+ 공유 링크 만들기" 클릭 시 createLink를 호출한다', async () => {
    vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
      currentUserId: 'me',
      sharedCalendars: [],
      hiddenOwnerIds: new Set(),
      toggleOwnerVisible: vi.fn(),
    } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    const createLink = vi.fn().mockResolvedValue('new-link')
    mockShareLinks({ createLink })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(
      <ToastProvider>
        <ShareSection />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('+ 공유 링크 만들기'))

    expect(createLink).toHaveBeenCalled()
    // 만들자마자 복사해 준다(다시 "링크 복사"를 찾아 누르던 한 단계를 없앰) + 안내 토스트
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/share/new-link`))
    expect(await screen.findByText(/링크를 만들고 복사했어요/)).toBeInTheDocument()
  })

  it('클립보드 복사가 막혀도 조용히 넘기지 않고 오류를 알린다', async () => {
    vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
      currentUserId: 'me',
      sharedCalendars: [],
      hiddenOwnerIds: new Set(),
      toggleOwnerVisible: vi.fn(),
    } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    mockShareLinks({
      links: [{ id: 's1', ownerId: 'me', ownerEmail: 'me@example.com', createdAt: '2026-09-15T00:00:00Z' }],
    })
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })

    render(
      <ToastProvider>
        <ShareSection />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('링크 복사'))

    expect(await screen.findByRole('alert')).toHaveTextContent('링크를 복사하지 못했어요')
  })

  it('링크 복사 버튼을 누르면 클립보드에 초대 URL을 복사하고 "복사됨"으로 바뀐다', async () => {
    vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
      currentUserId: 'me',
      sharedCalendars: [],
      hiddenOwnerIds: new Set(),
      toggleOwnerVisible: vi.fn(),
    } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    mockShareLinks({
      links: [{ id: 's1', ownerId: 'me', ownerEmail: 'me@example.com', createdAt: '2026-09-15T00:00:00Z' }],
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ShareSection />)
    fireEvent.click(screen.getByText('링크 복사'))

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/share/s1`)
    expect(await screen.findByText('복사됨')).toBeInTheDocument()
  })
})
