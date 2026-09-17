// EventEditor: 생성/수정/삭제, 필수값 검증을 확인
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as useCalendarModule from '../state/useCalendar'
import { CalendarProvider } from '../state/useCalendar'
import { FakeRepository } from '../test/fakeRepository'
import type { CalendarEvent, EventInstance } from '../types'
import EventEditor from './EventEditor'
import styles from './EventEditor.module.css'

beforeEach(() => {
  // 삭제 버튼이 window.confirm을 거친다 — 대부분의 테스트는 삭제가 진행된다고 가정하므로
  // 기본값을 true로 두고, 취소 테스트에서만 개별적으로 false로 덮어쓴다.
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function toInstance(event: CalendarEvent): EventInstance {
  return { event, start: event.start, end: event.end, instanceDate: event.start.slice(0, 10) }
}

function renderEditor(repo: FakeRepository, props: Partial<ComponentProps<typeof EventEditor>> = {}) {
  const onClose = vi.fn()
  render(
    <CalendarProvider repository={repo}>
      <EventEditor instance={null} defaultDate="2026-09-15" onClose={onClose} {...props} />
    </CalendarProvider>,
  )
  return { onClose }
}

describe('EventEditor', () => {
  it('제목 없이 저장하면 에러를 보여주고 저장하지 않는다', async () => {
    const repo = new FakeRepository()
    const { onClose } = renderEditor(repo)

    fireEvent.click(screen.getByText('저장'))

    expect(await screen.findByText('제목을 입력해 주세요.')).toBeInTheDocument()
    expect(repo.events).toHaveLength(0)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('새 일정을 생성한다', async () => {
    const repo = new FakeRepository()
    const { onClose } = renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '팀 회의' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events).toHaveLength(1))
    expect(repo.events[0]).toMatchObject({ title: '팀 회의', start: '2026-09-15', end: '2026-09-15', allDay: true })
    expect(onClose).toHaveBeenCalled()
  })

  it('기존 일정을 수정한다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '기존 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    const { onClose } = renderEditor(repo, { instance: toInstance(repo.events[0]) })

    expect(screen.getByLabelText('제목')).toHaveValue('기존 일정')
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '수정된 제목' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events[0].title).toBe('수정된 제목'))
    expect(onClose).toHaveBeenCalled()
  })

  it('반복 일정이 아니면 클릭한 회차의 실제 날짜를 폼에 채운다', () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '기존 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    // 이 회차의 실제 날짜(예: 반복 전개 결과)가 템플릿과 다르다고 가정
    renderEditor(repo, {
      instance: { event: repo.events[0], start: '2026-09-17', end: '2026-09-17', instanceDate: '2026-09-17' },
    })

    expect(screen.getByLabelText('시작')).toHaveValue('2026-09-17')
    expect(screen.getByLabelText('종료')).toHaveValue('2026-09-17')
  })

  it('일정을 삭제한다', async () => {
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '삭제될 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    const { onClose } = renderEditor(repo, { instance: toInstance(repo.events[0]) })

    fireEvent.click(screen.getByText('삭제'))

    await waitFor(() => expect(repo.events).toHaveLength(0))
    expect(onClose).toHaveBeenCalled()
  })

  it('삭제 확인을 취소하면 지워지지 않는다', async () => {
    // 회귀 테스트: 카테고리/할 일 삭제와 다르게 일정 삭제만 confirm 없이 바로 지워지던 버그
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const repo = new FakeRepository()
    repo.events.push({ id: 'e1', title: '삭제될 일정', allDay: true, start: '2026-09-10', end: '2026-09-10' })
    const { onClose } = renderEditor(repo, { instance: toInstance(repo.events[0]) })

    fireEvent.click(screen.getByText('삭제'))

    expect(repo.events).toHaveLength(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('공유받은(남의) 일정은 보기 전용으로 렌더링되고 저장/삭제 버튼이 없다', () => {
    // 회귀 테스트: RLS가 남의 일정 수정/삭제를 조용히 막아서 저장해도 반영 안 되던 버그
    const repo = new FakeRepository()
    repo.events.push({
      id: 'e1',
      title: '남의 일정',
      allDay: true,
      start: '2026-09-10',
      end: '2026-09-10',
      ownerId: 'other-user', // 테스트 환경의 currentUserId는 항상 undefined라 남의 소유로 취급됨
    })
    renderEditor(repo, { instance: toInstance(repo.events[0]) })

    expect(screen.getByText('공유받은 일정은 보기만 가능해요.')).toBeInTheDocument()
    expect(screen.getByText('남의 일정')).toBeInTheDocument()
    expect(screen.queryByText('저장')).not.toBeInTheDocument()
    expect(screen.queryByText('삭제')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('제목')).not.toBeInTheDocument()
  })

  it('매주 반복 + 요일 선택 + 횟수 종료로 일정을 만든다', async () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '스탠드업' } })
    fireEvent.change(screen.getByLabelText('반복'), { target: { value: 'weekly' } })
    fireEvent.click(screen.getByLabelText('월'))
    fireEvent.click(screen.getByLabelText('수'))
    fireEvent.change(screen.getByLabelText('반복 종료'), { target: { value: 'count' } })
    fireEvent.change(screen.getByLabelText('반복 횟수'), { target: { value: '8' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events).toHaveLength(1))
    expect(repo.events[0].recurrence).toEqual({ freq: 'weekly', interval: 1, byWeekday: [1, 3], count: 8 })
  })

  it('종일 + 여러 날짜에 걸침 + 반복 설정 시 겹침 경고를 보여준다(실사용 사고 재발 방지)', () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('종료'), { target: { value: '2026-12-16' } }) // 시작(기본 09-15)보다 3개월 뒤
    expect(screen.queryByText(/지속돼요/)).not.toBeInTheDocument() // 반복을 아직 안 골랐으면 경고 없음

    fireEvent.change(screen.getByLabelText('반복'), { target: { value: 'weekly' } })
    expect(screen.getByText(/이 일정은 93일간 지속돼요/)).toBeInTheDocument()
  })

  it('종일 + 하루짜리는 반복을 설정해도 겹침 경고가 안 보인다', () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('반복'), { target: { value: 'weekly' } })
    expect(screen.queryByText(/지속돼요/)).not.toBeInTheDocument()
  })

  it('색상은 항상 기본값이 미리 선택돼 있고, 그대로 저장된다', async () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    expect(screen.getByLabelText('색상')).not.toHaveValue('')

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '색상 테스트' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events).toHaveLength(1))
    expect(repo.events[0].color).toBeTruthy()
  })

  it('카테고리를 고르면 그 색으로 맞춰지고, 직접 다시 바꿀 수 있다', async () => {
    const repo = new FakeRepository()
    repo.categories.push({ id: 'c1', name: '업무', color: '#00aa00' })
    renderEditor(repo)

    await screen.findByText('업무') // 카테고리 목록이 비동기로 로드되길 기다린다
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'c1' } })
    expect(screen.getByLabelText('색상')).toHaveValue('#00aa00')

    fireEvent.change(screen.getByLabelText('색상'), { target: { value: '#123456' } })
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '커스텀 색' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events).toHaveLength(1))
    expect(repo.events[0]).toMatchObject({ categoryId: 'c1', color: '#123456' })
  })

  it('반복 안 함을 유지하면 recurrence 없이 저장된다', async () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '단발성 일정' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(repo.events).toHaveLength(1))
    expect(repo.events[0].recurrence).toBeUndefined()
  })

  it('기존 반복 일정을 열면 반복 규칙이 폼에 채워진다', () => {
    const repo = new FakeRepository()
    repo.events.push({
      id: 'e1',
      title: '반복 일정',
      allDay: true,
      start: '2026-09-01',
      end: '2026-09-01',
      recurrence: { freq: 'monthly', interval: 2, until: '2027-01-01' },
    })
    renderEditor(repo, { instance: toInstance(repo.events[0]) })

    expect(screen.getByLabelText('반복')).toHaveValue('monthly')
    expect(screen.getByLabelText('간격')).toHaveValue(2)
    expect(screen.getByLabelText('반복 종료')).toHaveValue('until')
    expect(screen.getByLabelText('반복 종료일')).toHaveValue('2027-01-01')
  })

  describe('반복 일정 수정·삭제 범위 선택', () => {
    function recurringEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
      return {
        id: 'series',
        title: '반복 일정',
        allDay: true,
        start: '2026-09-01',
        end: '2026-09-01',
        recurrence: { freq: 'daily', interval: 1, count: 5 },
        ...overrides,
      }
    }
    function middleInstance(event: CalendarEvent): EventInstance {
      // 5회 반복 중 3번째 회차(2026-09-03)를 클릭했다고 가정
      return { event, start: '2026-09-03', end: '2026-09-03', instanceDate: '2026-09-03' }
    }
    function firstInstance(event: CalendarEvent): EventInstance {
      return { event, start: event.start, end: event.end, instanceDate: event.start }
    }

    it('반복 일정을 저장/삭제하면 범위 선택 화면이 뜬다', async () => {
      const repo = new FakeRepository()
      const event = recurringEvent()
      repo.events.push(event)
      renderEditor(repo, { instance: middleInstance(event) })

      fireEvent.click(screen.getByText('저장'))
      expect(await screen.findByText('이 일정만')).toBeInTheDocument()
      expect(screen.getByText('이후 전체')).toBeInTheDocument()
      expect(screen.getByText('전체 일정')).toBeInTheDocument()

      fireEvent.click(screen.getByText('취소'))
      expect(screen.queryByText('이 일정만')).not.toBeInTheDocument()
      expect(screen.getByText('저장')).toBeInTheDocument() // 폼으로 돌아옴
    })

    it('이 일정만 삭제: 원본에 제외일만 추가되고 새 일정은 생기지 않는다', async () => {
      const repo = new FakeRepository()
      const event = recurringEvent()
      repo.events.push(event)
      const { onClose } = renderEditor(repo, { instance: middleInstance(event) })

      fireEvent.click(screen.getByText('삭제'))
      fireEvent.click(await screen.findByText('이 일정만'))

      await waitFor(() => expect(repo.events).toHaveLength(1))
      expect(repo.events[0].excludedDates).toEqual(['2026-09-03'])
      expect(onClose).toHaveBeenCalled()
    })

    it('이후 전체 삭제(중간 회차): 원본이 그 전날까지로 잘린다', async () => {
      const repo = new FakeRepository()
      const event = recurringEvent()
      repo.events.push(event)
      renderEditor(repo, { instance: middleInstance(event) })

      fireEvent.click(screen.getByText('삭제'))
      fireEvent.click(await screen.findByText('이후 전체'))

      await waitFor(() => expect(repo.events[0].recurrence?.until).toBe('2026-09-02'))
      expect(repo.events).toHaveLength(1) // 삭제라 새 일정은 안 생김
    })

    it('이 일정만 삭제(첫 회차): 시리즈는 안 지워지고 그 회차만 제외된다', async () => {
      // 회귀 테스트: scope 체크 없이 isFirstOccurrence만 보면 첫 회차의 "이 일정만"이
      // "전체"로 잘못 떨어져 시리즈 전체가 삭제되던 버그(보스 리뷰에서 발견)
      const repo = new FakeRepository()
      const event = recurringEvent()
      repo.events.push(event)
      renderEditor(repo, { instance: firstInstance(event) })

      fireEvent.click(screen.getByText('삭제'))
      fireEvent.click(await screen.findByText('이 일정만'))

      await waitFor(() => expect(repo.events).toHaveLength(1))
      expect(repo.events[0]).toMatchObject({ id: 'series', excludedDates: ['2026-09-01'] })
    })

    it('이후 전체 삭제(첫 회차): 시리즈 전체가 삭제된다', async () => {
      const repo = new FakeRepository()
      const event = recurringEvent()
      repo.events.push(event)
      renderEditor(repo, { instance: firstInstance(event) })

      fireEvent.click(screen.getByText('삭제'))
      fireEvent.click(await screen.findByText('이후 전체'))

      await waitFor(() => expect(repo.events).toHaveLength(0))
    })

    it('전체 삭제: 시리즈 전체가 삭제된다', async () => {
      const repo = new FakeRepository()
      const event = recurringEvent()
      repo.events.push(event)
      renderEditor(repo, { instance: middleInstance(event) })

      fireEvent.click(screen.getByText('삭제'))
      fireEvent.click(await screen.findByText('전체 일정'))

      await waitFor(() => expect(repo.events).toHaveLength(0))
    })

    it('이 일정만 수정: 원본은 제외일만 추가, 편집 내용은 새 단발 일정으로 만든다', async () => {
      const repo = new FakeRepository()
      const event = recurringEvent()
      repo.events.push(event)
      renderEditor(repo, { instance: middleInstance(event) })

      fireEvent.change(screen.getByLabelText('제목'), { target: { value: '이번만 다르게' } })
      fireEvent.click(screen.getByText('저장'))
      fireEvent.click(await screen.findByText('이 일정만'))

      await waitFor(() => expect(repo.events).toHaveLength(2))
      expect(repo.events[0]).toMatchObject({ id: 'series', title: '반복 일정', excludedDates: ['2026-09-03'] })
      const created = repo.events[1]
      expect(created).toMatchObject({ title: '이번만 다르게', start: '2026-09-03', end: '2026-09-03' })
      expect(created.recurrence).toBeUndefined()
    })

    it('이 일정만 수정(첫 회차): 시리즈 전체가 아니라 그 회차만 새 단발 일정이 된다', async () => {
      // 회귀 테스트: 위 삭제 케이스와 같은 이유로, 첫 회차의 "이 일정만 수정"이 시리즈
      // 전체를 덮어쓰던 버그
      const repo = new FakeRepository()
      const event = recurringEvent()
      repo.events.push(event)
      renderEditor(repo, { instance: firstInstance(event) })

      fireEvent.change(screen.getByLabelText('제목'), { target: { value: '첫날만 다르게' } })
      fireEvent.click(screen.getByText('저장'))
      fireEvent.click(await screen.findByText('이 일정만'))

      await waitFor(() => expect(repo.events).toHaveLength(2))
      expect(repo.events[0]).toMatchObject({ id: 'series', title: '반복 일정', excludedDates: ['2026-09-01'] })
      const created = repo.events[1]
      expect(created).toMatchObject({ title: '첫날만 다르게', start: '2026-09-01', end: '2026-09-01' })
      expect(created.recurrence).toBeUndefined()
    })

    it('이후 전체 수정: 원본은 그 전날까지로 잘리고, 새 시리즈가 원래 패턴을 이어받는다', async () => {
      const repo = new FakeRepository()
      const event = recurringEvent() // daily, count 5 (09-01~09-05)
      repo.events.push(event)
      renderEditor(repo, { instance: middleInstance(event) })

      fireEvent.change(screen.getByLabelText('제목'), { target: { value: '이후로 변경' } })
      fireEvent.click(screen.getByText('저장'))
      fireEvent.click(await screen.findByText('이후 전체'))

      await waitFor(() => expect(repo.events).toHaveLength(2))
      expect(repo.events[0]).toMatchObject({ id: 'series', title: '반복 일정' })
      expect(repo.events[0].recurrence?.until).toBe('2026-09-02')
      const created = repo.events[1]
      expect(created).toMatchObject({ title: '이후로 변경', start: '2026-09-03', end: '2026-09-03' })
      // 원래 계열이 count:5로 09-05에 끝났으니, 새 시리즈도 같은 지점(09-05)에서 끝난다
      expect(created.recurrence).toEqual({ freq: 'daily', interval: 1, until: '2026-09-05', count: undefined })
    })

    it('전체 수정: 같은 id로 업데이트되고, 날짜를 안 건드렸으면 시리즈 앵커는 그대로다(회귀: 클릭한 회차 날짜로 튀던 버그)', async () => {
      const repo = new FakeRepository()
      const event = recurringEvent()
      repo.events.push(event)
      renderEditor(repo, { instance: middleInstance(event) })

      fireEvent.change(screen.getByLabelText('제목'), { target: { value: '전체 변경' } })
      fireEvent.click(screen.getByText('저장'))
      fireEvent.click(await screen.findByText('전체 일정'))

      await waitFor(() => expect(repo.events).toHaveLength(1))
      expect(repo.events[0]).toMatchObject({ id: 'series', title: '전체 변경', start: '2026-09-01', end: '2026-09-01' })
    })

    it('전체 수정: 종료 날짜만 줄이면(다일치→하루) 그 지속 시간이 시리즈 전체에 반영되고 앵커는 그대로다', async () => {
      const repo = new FakeRepository()
      // 종일 일정이 3일짜리(09-01~09-03)로 매일 반복되는 상황을 흉내낸다
      const event = recurringEvent({ start: '2026-09-01', end: '2026-09-03' })
      repo.events.push(event)
      // 3번째 회차(이 회차 자체도 09-03~09-05로 3일짜리)를 열어서 종료만 시작과 같게 줄인다
      renderEditor(repo, { instance: { event, start: '2026-09-03', end: '2026-09-05', instanceDate: '2026-09-03' } })

      fireEvent.change(screen.getByLabelText('종료'), { target: { value: '2026-09-03' } })
      fireEvent.click(screen.getByText('저장'))
      fireEvent.click(await screen.findByText('전체 일정'))

      await waitFor(() => expect(repo.events).toHaveLength(1))
      // 앵커(시작)는 원래 09-01 그대로, 지속 시간만 3일→하루로 줄어서 종료도 09-01
      expect(repo.events[0]).toMatchObject({ start: '2026-09-01', end: '2026-09-01' })
    })
  })

  it('종료가 시작보다 빠르면 에러를 보여준다', async () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '일정' } })
    fireEvent.change(screen.getByLabelText('종료'), { target: { value: '2026-09-10' } })
    fireEvent.click(screen.getByText('저장'))

    expect(await screen.findByText('종료 일시는 시작 일시보다 빠를 수 없어요.')).toBeInTheDocument()
    expect(repo.events).toHaveLength(0)
  })

  it('반복 종료를 "날짜까지"로 고르고 날짜를 안 정하면 저장이 막힌다(회귀: 기본값이 시작일과 같아 바로 끝나던 버그)', async () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '스탠드업' } })
    fireEvent.change(screen.getByLabelText('반복'), { target: { value: 'weekly' } })
    fireEvent.change(screen.getByLabelText('반복 종료'), { target: { value: 'until' } })
    expect(screen.getByLabelText('반복 종료일')).toHaveValue('')
    fireEvent.click(screen.getByText('저장'))

    expect(await screen.findByText('반복 종료일을 시작일 이후로 선택해 주세요.')).toBeInTheDocument()
    expect(repo.events).toHaveLength(0)
  })

  it('시작일을 종료일보다 늦게 바꾸면 종료일이 시작일에 맞춰 같이 올라간다', async () => {
    const repo = new FakeRepository()
    renderEditor(repo)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '일정' } })
    fireEvent.change(screen.getByLabelText('시작'), { target: { value: '2026-09-20' } })
    expect(screen.getByLabelText('종료')).toHaveValue('2026-09-20')

    fireEvent.click(screen.getByText('저장'))
    await waitFor(() => expect(repo.events).toHaveLength(1))
    expect(repo.events[0]).toMatchObject({ start: '2026-09-20', end: '2026-09-20' })
  })

  describe('19단계: 함께 일정', () => {
    function mockCalendar(overrides: Partial<ReturnType<typeof useCalendarModule.useCalendar>> = {}) {
      vi.spyOn(useCalendarModule, 'useCalendar').mockReturnValue({
        myCategories: [],
        currentUserId: 'me',
        sharedCalendars: [],
        addEvent: vi.fn().mockResolvedValue(undefined),
        updateEvent: vi.fn().mockResolvedValue(undefined),
        deleteEvent: vi.fn().mockResolvedValue(undefined),
        respondToEvent: vi.fn().mockResolvedValue(undefined),
        setEventParticipants: vi.fn().mockResolvedValue(undefined),
        ...overrides,
      } as unknown as ReturnType<typeof useCalendarModule.useCalendar>)
    }

    function toInstanceOf(event: CalendarEvent): EventInstance {
      return { event, start: event.start, end: event.end, instanceDate: event.start.slice(0, 10) }
    }

    it('공유 상대가 없으면 참여자 선택기가 안 보인다', () => {
      mockCalendar({ sharedCalendars: [] })
      render(<EventEditor instance={null} defaultDate="2026-09-15" onClose={vi.fn()} />)
      expect(screen.queryByText('함께할 사람')).not.toBeInTheDocument()
    })

    it('공유 상대가 있으면 참여자 선택기가 보이고, 고르면 초대 방식을 물어본다', async () => {
      mockCalendar({ sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }] })
      render(<EventEditor instance={null} defaultDate="2026-09-15" onClose={vi.fn()} />)

      expect(screen.getByText('함께할 사람')).toBeInTheDocument()
      expect(screen.queryByText('수락 요청')).not.toBeInTheDocument()

      fireEvent.click(screen.getByLabelText('partner@example.com'))
      expect(screen.getByLabelText(/수락 요청/)).toBeInTheDocument()
      expect(screen.getByLabelText(/바로 등록/)).toBeInTheDocument()
    })

    it('참여자를 골라 저장하면 일정 생성 후 설정한 방식으로 초대한다', async () => {
      const addEvent = vi.fn().mockResolvedValue(undefined)
      const setEventParticipants = vi.fn().mockResolvedValue(undefined)
      mockCalendar({
        sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }],
        addEvent,
        setEventParticipants,
      })
      const onClose = vi.fn()
      render(<EventEditor instance={null} defaultDate="2026-09-15" onClose={onClose} />)

      fireEvent.change(screen.getByLabelText('제목'), { target: { value: '저녁 약속' } })
      fireEvent.click(screen.getByLabelText('partner@example.com'))
      fireEvent.click(screen.getByLabelText(/바로 등록/))
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(addEvent).toHaveBeenCalled())
      const savedId = addEvent.mock.calls[0][0].id
      await waitFor(() =>
        expect(setEventParticipants).toHaveBeenCalledWith(savedId, [], [{ userId: 'partner-1', status: 'accepted' }]),
      )
      expect(onClose).toHaveBeenCalled()
    })

    it('참여자 초대 저장이 실패하면(네트워크 등) 사용자에게 알려준다(모달은 이미 닫힌 뒤라 조용히 묻히기 쉬움)', async () => {
      const addEvent = vi.fn().mockResolvedValue(undefined)
      const setEventParticipants = vi.fn().mockRejectedValue(new Error('boom'))
      mockCalendar({
        sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }],
        addEvent,
        setEventParticipants,
      })
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      render(<EventEditor instance={null} defaultDate="2026-09-15" onClose={vi.fn()} />)

      fireEvent.change(screen.getByLabelText('제목'), { target: { value: '저녁 약속' } })
      fireEvent.click(screen.getByLabelText('partner@example.com'))
      fireEvent.click(screen.getByLabelText(/바로 등록/))
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    })

    it('대기 중인 초대는 읽기 전용으로 보여주고 수락/거절 버튼만 있다', () => {
      const respondToEvent = vi.fn().mockResolvedValue(undefined)
      mockCalendar({ respondToEvent })
      const event: CalendarEvent = {
        id: 'e1',
        title: '저녁 약속',
        ownerId: 'owner-1',
        allDay: false,
        start: '2026-09-18T19:00',
        end: '2026-09-18T21:00',
        participants: [{ userId: 'me', email: 'me@example.com', status: 'pending' }],
      }
      const onClose = vi.fn()
      render(<EventEditor instance={toInstanceOf(event)} defaultDate="2026-09-15" onClose={onClose} />)

      expect(screen.getByText('함께하자는 초대')).toBeInTheDocument()
      expect(screen.queryByLabelText('제목')).not.toBeInTheDocument()
      // 거절은 "취소"와 똑같이 생기면 위험한 동작이라는 게 안 보인다(모바일 UX 감사에서 발견) — 위험 버튼 스타일이어야 한다
      expect(screen.getByText('거절').className).toContain(styles.buttonDanger)

      fireEvent.click(screen.getByText('수락'))
      expect(respondToEvent).toHaveBeenCalledWith('e1', 'accepted')
      expect(onClose).toHaveBeenCalled()
    })

    it('수락한 참여자는 범위 선택 없이 바로 저장하고, 카테고리는 안 보이고, 삭제 대신 참여 취소가 있다', async () => {
      const updateEvent = vi.fn().mockResolvedValue(undefined)
      const respondToEvent = vi.fn().mockResolvedValue(undefined)
      mockCalendar({ updateEvent, respondToEvent })
      const event: CalendarEvent = {
        id: 'e1',
        title: '저녁 약속',
        ownerId: 'owner-1',
        allDay: false,
        start: '2026-09-18T19:00',
        end: '2026-09-18T21:00',
        recurrence: { freq: 'weekly', interval: 1, count: 5 },
        participants: [{ userId: 'me', email: 'me@example.com', status: 'accepted' }],
      }
      render(<EventEditor instance={toInstanceOf(event)} defaultDate="2026-09-15" onClose={vi.fn()} />)

      expect(screen.queryByLabelText('카테고리')).not.toBeInTheDocument()
      expect(screen.queryByText('삭제')).not.toBeInTheDocument()
      expect(screen.getByText('참여 취소')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('제목'), { target: { value: '시간 변경' } })
      fireEvent.click(screen.getByText('저장'))

      // 범위 선택 화면 없이 바로 저장된다
      expect(screen.queryByText('이 일정만')).not.toBeInTheDocument()
      await waitFor(() => expect(updateEvent).toHaveBeenCalledWith(expect.objectContaining({ title: '시간 변경' })))

      fireEvent.click(screen.getByText('참여 취소'))
      expect(respondToEvent).toHaveBeenCalledWith('e1', 'declined')
    })

    it('작성자가 이미 함께인 반복 일정을 수정하면 범위 선택 없이 바로 전체 저장한다', async () => {
      const updateEvent = vi.fn().mockResolvedValue(undefined)
      mockCalendar({ updateEvent })
      const event: CalendarEvent = {
        id: 'e1',
        title: '스터디',
        ownerId: 'me',
        allDay: true,
        start: '2026-09-01',
        end: '2026-09-01',
        recurrence: { freq: 'weekly', interval: 1, count: 5 },
        participants: [{ userId: 'partner-1', email: 'partner@example.com', status: 'accepted' }],
      }
      render(<EventEditor instance={toInstanceOf(event)} defaultDate="2026-09-15" onClose={vi.fn()} />)

      fireEvent.change(screen.getByLabelText('제목'), { target: { value: '수정됨' } })
      fireEvent.click(screen.getByText('저장'))

      expect(screen.queryByText('이 일정만')).not.toBeInTheDocument()
      await waitFor(() => expect(updateEvent).toHaveBeenCalledWith(expect.objectContaining({ title: '수정됨' })))
    })

    it('작성자가 기존 반복 일정에 참여자를 처음 초대하면 범위 선택 없이 전체로 저장하고 참여자를 등록한다', async () => {
      const updateEvent = vi.fn().mockResolvedValue(undefined)
      const setEventParticipants = vi.fn().mockResolvedValue(undefined)
      mockCalendar({
        updateEvent,
        setEventParticipants,
        sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }],
      })
      const event: CalendarEvent = {
        id: 'e1',
        title: '스터디',
        ownerId: 'me',
        allDay: true,
        start: '2026-09-01',
        end: '2026-09-01',
        recurrence: { freq: 'weekly', interval: 1, count: 5 },
      }
      render(<EventEditor instance={toInstanceOf(event)} defaultDate="2026-09-15" onClose={vi.fn()} />)

      fireEvent.click(screen.getByLabelText('partner@example.com'))
      fireEvent.click(screen.getByLabelText(/수락 요청/))
      fireEvent.click(screen.getByText('저장'))

      expect(screen.queryByText('이 일정만')).not.toBeInTheDocument()
      await waitFor(() => expect(updateEvent).toHaveBeenCalled())
      await waitFor(() =>
        expect(setEventParticipants).toHaveBeenCalledWith('e1', [], [{ userId: 'partner-1', status: 'pending' }]),
      )
    })

    it('이미 초대된 사람은 후보 목록에 두 번 나오지 않는다', () => {
      mockCalendar({
        sharedCalendars: [{ ownerId: 'partner-1', ownerEmail: 'partner@example.com' }],
      })
      const event: CalendarEvent = {
        id: 'e1',
        title: '스터디',
        ownerId: 'me',
        allDay: true,
        start: '2026-09-01',
        end: '2026-09-01',
        participants: [{ userId: 'partner-1', email: 'partner@example.com', status: 'accepted' }],
      }
      render(<EventEditor instance={toInstanceOf(event)} defaultDate="2026-09-15" onClose={vi.fn()} />)

      expect(screen.getAllByLabelText(/partner@example\.com/)).toHaveLength(1)
    })
  })
})
