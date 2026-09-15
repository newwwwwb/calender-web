// ShareSection: 로그인 여부에 따른 렌더링, 겹쳐보기 토글, 링크 생성/복사/삭제, 멤버 제거를 검증
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as useCalendarModule from '../state/useCalendar'
import * as useShareLinksModule from '../state/useShareLinks'
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
    expect(screen.getByText('로그인하면 캘린더를 공유할 수 있어요')).toBeInTheDocument()
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

    fireEvent.click(screen.getByLabelText('공유 링크 삭제'))
    expect(deleteLink).toHaveBeenCalledWith('s1')

    fireEvent.click(screen.getByLabelText('you@example.com 공유 취소'))
    expect(removeMember).toHaveBeenCalledWith('m1')
  })

  it('"+ 공유 링크 만들기" 클릭 시 createLink를 호출한다', () => {
    vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
      currentUserId: 'me',
      sharedCalendars: [],
      hiddenOwnerIds: new Set(),
      toggleOwnerVisible: vi.fn(),
    } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    const createLink = vi.fn()
    mockShareLinks({ createLink })

    render(<ShareSection />)
    fireEvent.click(screen.getByText('+ 공유 링크 만들기'))
    expect(createLink).toHaveBeenCalled()
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
