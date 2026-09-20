// 일정 생성/수정/삭제 모달
import { addDays, differenceInCalendarDays } from 'date-fns'
import { useState, type ReactNode } from 'react'
import { parseDateKey, parseDateTimeKey, toDateKey, toDateTimeKey } from '../lib/date'
import { excludeOccurrence, isFirstOccurrence, resolveRecurrenceUntil, truncateRecurrenceBefore } from '../lib/recurrence'
import { canEdit, isJoint, myJointStatus } from '../lib/together'
import { useCalendar } from '../state/useCalendar'
import { useMediaQuery } from '../state/useMediaQuery'
import type { EventInstance, ID, RecurrenceFreq, RecurrenceRule } from '../types'
import styles from './EventEditor.module.css'
import Overlay from './Overlay'
import RecurrenceFields, { type EndCondition } from './RecurrenceFields'
import { ParticipantList, ParticipantPicker, type InviteCandidate } from './TogetherFields'

// 카테고리를 안 골라도 일정이 배경과 구분되도록, 새 일정은 항상 이 색으로 시작한다
// (액션·선택에 쓰는 #0066ff와 겹치지 않게 고름)
const DEFAULT_EVENT_COLOR = '#6366f1'

interface EventEditorProps {
  instance: EventInstance | null // null이면 새 일정 생성. 있으면 클릭한 회차(실제 날짜·시간)를 수정
  defaultDate: string // 새 일정 생성 시 기본 날짜(YYYY-MM-DD)
  defaultHour?: number // 주/일 보기에서 특정 시간칸을 클릭해 생성할 때의 시작 시각
  onClose: () => void
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function splitDate(value: string): string {
  return value.slice(0, 10)
}

function splitTime(value: string): string {
  return value.includes('T') ? value.slice(11, 16) : '09:00'
}

// 함께 일정 쓰기는 저장(events)과 참여자 동기화(event_participants)가 별도 요청 두 번이라,
// 모달이 이미 닫힌 뒤 두 번째 요청이 실패하면 사용자는 아무 것도 모르고 지나간다 —
// DataBackup의 기존 관례(window.alert)를 따라 최소한 실패는 알려준다(혹독한 보스 리뷰에서 발견).
function alertOnFailure(promise: Promise<unknown>, message: string) {
  promise.catch(() => window.alert(message))
}

function EventEditor({ instance, defaultDate, defaultHour, onClose }: EventEditorProps) {
  const {
    myCategories,
    currentUserId,
    sharedCalendars,
    addEvent,
    updateEvent,
    deleteEvent,
    respondToEvent,
    setEventParticipants,
  } = useCalendar()
  const isMobile = useMediaQuery('(max-width: 767px)')
  // 터치 기기에서 열자마자 키보드가 올라와 시트 절반을 덮는 것을 막는다
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const event = instance?.event ?? null
  // 공유받은(남의) 일정은 RLS가 수정/삭제를 조용히 막아서 저장을 눌러도 반영 안 되던 버그가 있었다
  // (보스 리뷰에서 발견) — 아예 보기 전용으로 렌더링해서 시도조차 못 하게 막는다.
  // 함께 일정(19단계)에서 수락한 참여자는 예외로 수정할 수 있다.
  const readOnly = event ? !canEdit(event, currentUserId) : false
  const isOwner = !event?.ownerId || event.ownerId === currentUserId
  const myStatus = event ? myJointStatus(event, currentUserId) : undefined
  const joint = event ? isJoint(event) : false
  const currentParticipants = event?.participants ?? []

  // 초대 후보: 이미 초대된 사람(공유가 끊겼어도 빼낼 수 있게) + 아직 초대하지 않은 공유 상대
  const inviteCandidates: InviteCandidate[] = [
    ...currentParticipants.map((p) => ({ userId: p.userId, email: p.email, status: p.status })),
    ...sharedCalendars
      .filter((s) => !currentParticipants.some((p) => p.userId === s.ownerId))
      .map((s) => ({ userId: s.ownerId, email: s.ownerEmail })),
  ]
  const canInvite = isOwner && Boolean(currentUserId) && inviteCandidates.length > 0

  function nameFor(userId: ID | undefined): string {
    if (!userId || userId === currentUserId) return '나'
    return (
      currentParticipants.find((p) => p.userId === userId)?.email ??
      sharedCalendars.find((s) => s.ownerId === userId)?.ownerEmail ??
      '알 수 없음'
    )
  }

  const [title, setTitle] = useState(event?.title ?? '')
  const [memo, setMemo] = useState(event?.memo ?? '')
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? '')
  const [color, setColor] = useState(event?.color ?? DEFAULT_EVENT_COLOR)
  const [allDay, setAllDay] = useState(event?.allDay ?? defaultHour === undefined)
  // 수정 모드에서는 시리즈 템플릿(event)이 아니라 실제로 클릭한 회차(instance)의 날짜·시간을 보여준다
  const [startDate, setStartDate] = useState(instance ? splitDate(instance.start) : defaultDate)
  const [startTime, setStartTime] = useState(
    instance ? splitTime(instance.start) : defaultHour !== undefined ? `${pad2(defaultHour)}:00` : '09:00',
  )
  const [endDate, setEndDate] = useState(instance ? splitDate(instance.end) : defaultDate)
  const [endTime, setEndTime] = useState(
    instance
      ? splitTime(instance.end)
      : defaultHour !== undefined
        ? defaultHour + 1 >= 24
          ? '23:59' // 23시칸 클릭 시 자정을 넘기지 않도록 그날 안에서 마무리
          : `${pad2(defaultHour + 1)}:00`
        : '10:00',
  )
  const [freq, setFreq] = useState<RecurrenceFreq | 'none'>(event?.recurrence?.freq ?? 'none')
  const [interval, setInterval] = useState(event?.recurrence?.interval ?? 1)
  const [byWeekday, setByWeekday] = useState<number[]>(event?.recurrence?.byWeekday ?? [])
  const [endCondition, setEndCondition] = useState<EndCondition>(
    event?.recurrence?.until ? 'until' : event?.recurrence?.count ? 'count' : 'never',
  )
  // 시작일로 미리 채우면 사용자가 날짜를 안 건드리고 저장했을 때 반복이 바로 다음 회차에서
  // 끝나버린다(버그) — 빈 값으로 둬서 실제로 고르지 않으면 저장 시 검증에 걸리게 한다.
  const [until, setUntil] = useState(event?.recurrence?.until ?? '')
  const [count, setCount] = useState(event?.recurrence?.count ?? 5)
  const [error, setError] = useState('')
  // 반복 일정을 수정/삭제할 때만 "이 일정만/이후 전체/전체" 범위를 묻는다
  const [pendingAction, setPendingAction] = useState<'save' | 'delete' | null>(null)
  const [selectedIds, setSelectedIds] = useState<ID[]>(() => currentParticipants.map((p) => p.userId))
  const [inviteMode, setInviteMode] = useState<'pending' | 'accepted'>('pending')

  const hasNewInvitee = selectedIds.some((id) => !currentParticipants.some((p) => p.userId === id))
  const participantsChanged = hasNewInvitee || currentParticipants.some((p) => !selectedIds.includes(p.userId))
  // 반복 일정의 "이 일정만/이후 전체"는 참여자 없는 새 일정을 만들어버리므로, 함께 일정이거나
  // 참여자를 넣는 중이면 저장 범위를 묻지 않고 시리즈 전체에 적용한다.
  const saveAppliesToWholeSeries = joint || selectedIds.length > 0

  function toggleParticipant(userId: ID) {
    setSelectedIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  function participantsToSave() {
    return selectedIds.map((userId) => ({ userId, status: inviteMode }))
  }

  function buildKey(date: string, time: string): string {
    return allDay ? date : `${date}T${time}`
  }

  function buildRecurrence(): RecurrenceRule | undefined {
    if (freq === 'none') return undefined
    return {
      freq,
      interval: Math.max(1, interval),
      byWeekday: freq === 'weekly' && byWeekday.length > 0 ? byWeekday : undefined,
      until: endCondition === 'until' ? until : undefined,
      count: endCondition === 'count' ? Math.max(1, count) : undefined,
    }
  }

  function toggleWeekday(day: number) {
    setByWeekday((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  // 카테고리를 고르면 그 카테고리 색으로 맞춰준다. 색상 칸은 그 뒤에도 직접 바꿀 수 있다.
  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId)
    const category = myCategories.find((c) => c.id === nextCategoryId)
    if (category) setColor(category.color)
  }

  function handleSaveClick() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('제목을 입력해 주세요.')
      return
    }
    if (buildKey(endDate, endTime) < buildKey(startDate, startTime)) {
      setError('종료 일시는 시작 일시보다 빠를 수 없어요.')
      return
    }
    if (freq !== 'none' && endCondition === 'until' && (!until || until < startDate)) {
      setError('반복 종료일을 시작일 이후로 선택해 주세요.')
      return
    }
    setError('')
    if (event?.recurrence && !saveAppliesToWholeSeries) {
      setPendingAction('save')
    } else {
      commitSave('all')
    }
  }

  function handleLeaveClick() {
    if (!event) return
    if (!window.confirm(`'${event.title}' 일정에서 빠질까요?`)) return
    alertOnFailure(respondToEvent(event.id, 'declined'), '처리에 실패했어요. 다시 시도해 주세요.')
    onClose()
  }

  function handleRespond(status: 'accepted' | 'declined') {
    if (!event) return
    alertOnFailure(respondToEvent(event.id, status), '처리에 실패했어요. 다시 시도해 주세요.')
    onClose()
  }

  function handleDeleteClick() {
    if (!event) return
    // 카테고리·할 일 삭제는 confirm이 있는데 일정만 없어서 바로 지워지던 버그(보스 리뷰에서 발견)
    if (!window.confirm(`'${event.title}' 일정을 삭제할까요?`)) return
    if (event.recurrence) {
      setPendingAction('delete')
    } else {
      commitDelete('all')
    }
  }

  // scope: 'this'=이 회차만, 'following'=이 회차부터 이후 전체, 'all'=시리즈 전체(또는 반복 없음/신규)
  function commitSave(scope: 'this' | 'following' | 'all') {
    if (!event) {
      const id = crypto.randomUUID()
      const participants = participantsToSave()
      // 참여자 행은 events 행을 참조하므로 일정이 저장된 뒤에 넣는다
      const saved = addEvent({
        id,
        title: title.trim(),
        memo: memo.trim() || undefined,
        categoryId: categoryId || undefined,
        color,
        allDay,
        start: buildKey(startDate, startTime),
        end: buildKey(endDate, endTime),
        recurrence: buildRecurrence(),
      }).then(() => (participants.length > 0 ? setEventParticipants(id, [], participants) : undefined))
      alertOnFailure(saved, '일정 저장에 실패했어요. 다시 시도해 주세요.')
      onClose()
      return
    }

    const occurrenceDate = instance?.instanceDate ?? ''
    const isMidSeriesAllEdit = scope === 'all' && Boolean(event.recurrence) && !isFirstOccurrence(event, occurrenceDate)

    let start = buildKey(startDate, startTime)
    let end = buildKey(endDate, endTime)
    if (isMidSeriesAllEdit && instance) {
      // 반복 중인 시리즈를 중간 회차에서 "전체 일정"으로 저장하면, 폼에는 그 회차의 실제 날짜가
      // 채워져 있다. 이 날짜를 그대로 시리즈 앵커로 쓰면 시리즈 전체가 그 날짜로 튀어버린다(버그).
      // 대신 사용자가 실제로 옮긴 일수(델타)만 원래 앵커(event.start)에 반영하고, 지속 시간
      // (종료-시작)은 폼에서 편집한 값을 시리즈 전체에 그대로 적용한다 — 날짜를 안 건드리면
      // 시리즈가 그대로 유지되고, 지속 시간만 줄이면(예: 종일 일정이 여러 날에 걸쳐 있던 걸
      // 하루로 줄이는 경우) 그 변경이 전체 회차에 반영된다.
      const dayDelta = differenceInCalendarDays(parseDateKey(startDate), parseDateKey(splitDate(instance.start)))
      const anchorDate = toDateKey(addDays(parseDateKey(splitDate(event.start)), dayDelta))
      const durationMs = parseDateTimeKey(end).getTime() - parseDateTimeKey(start).getTime()
      start = buildKey(anchorDate, startTime)
      const endDateTime = new Date(parseDateTimeKey(start).getTime() + durationMs)
      end = allDay ? toDateKey(endDateTime) : toDateTimeKey(endDateTime)
    }

    const common = {
      title: title.trim(),
      memo: memo.trim() || undefined,
      categoryId: categoryId || undefined,
      color,
      allDay,
      start,
      end,
    }

    // "이후 전체"가 첫 회차부터 시작하면 "전체"와 같다 — 그 경우에만 all 분기로 합친다.
    // scope 체크 없이 isFirstOccurrence만 보면 "이 일정만"도 여기로 떨어져 시리즈 전체가 바뀌는 버그였음.
    if (scope === 'all' || !event.recurrence || (scope === 'following' && isFirstOccurrence(event, occurrenceDate))) {
      // 반복 규칙 변경은 '전체 일정' 범위에서만 반영된다 (이 일정만/이후 전체는 원래 패턴을 유지)
      updateEvent({ ...event, ...common, recurrence: buildRecurrence() })
      if (isOwner && participantsChanged) {
        alertOnFailure(setEventParticipants(event.id, currentParticipants, participantsToSave()), '참여자 변경에 실패했어요. 다시 시도해 주세요.')
      }
    } else if (scope === 'this') {
      updateEvent(excludeOccurrence(event, occurrenceDate))
      addEvent({ id: crypto.randomUUID(), ...common, recurrence: undefined })
    } else {
      const effectiveUntil = resolveRecurrenceUntil(event)
      updateEvent(truncateRecurrenceBefore(event, occurrenceDate))
      addEvent({
        id: crypto.randomUUID(),
        ...common,
        recurrence: { ...event.recurrence, until: effectiveUntil, count: undefined },
      })
    }
    setPendingAction(null)
    onClose()
  }

  function commitDelete(scope: 'this' | 'following' | 'all') {
    if (!event) return
    const occurrenceDate = instance?.instanceDate ?? ''
    // commitSave와 동일한 이유로 scope === 'following'일 때만 all과 합친다.
    if (scope === 'all' || !event.recurrence || (scope === 'following' && isFirstOccurrence(event, occurrenceDate))) {
      deleteEvent(event.id)
    } else if (scope === 'this') {
      updateEvent(excludeOccurrence(event, occurrenceDate))
    } else {
      updateEvent(truncateRecurrenceBefore(event, occurrenceDate))
    }
    setPendingAction(null)
    onClose()
  }

  // 종일 + 여러 날에 걸친 일정 + 반복이 함께 쓰이면 회차마다 그 기간 전체가 표시되어 누적
  // 중첩되기 쉽다(실사용 사고: 종료를 반복종료일과 헷갈려 3개월짜리 종일 일정을 매주 반복시킴).
  const spanDays = allDay ? differenceInCalendarDays(parseDateKey(endDate), parseDateKey(startDate)) : 0
  const showMultiDaySpanWarning = allDay && freq !== 'none' && spanDays > 0

  const participantList = joint && event && (
    <ParticipantList
      ownerName={nameFor(event.ownerId)}
      participants={currentParticipants.map((p) => ({ userId: p.userId, name: nameFor(p.userId), status: p.status }))}
    />
  )

  const readOnlyDetails = event && (
    <>
      <div className={styles.field}>
        <span className={styles.label}>제목</span>
        <p>{event.title}</p>
      </div>
      <div className={styles.field}>
        <span className={styles.label}>{allDay ? '날짜' : '일시'}</span>
        <p>
          {startDate}
          {!allDay && ` ${startTime}`} ~ {endDate}
          {!allDay && ` ${endTime}`}
        </p>
      </div>
      {memo && (
        <div className={styles.field}>
          <span className={styles.label}>메모</span>
          <p>{memo}</p>
        </div>
      )}
      {participantList}
    </>
  )

  const heading = !event ? '새 일정' : myStatus === 'pending' ? '함께하자는 초대' : readOnly ? '일정 보기' : '일정 수정'

  // 모바일(iOS 방식): 시트 맨 위 고정 바에 [취소] 제목 [저장]. 저장/취소가 시트 맨 아래에 있으면
  // 처음엔 화면 밖이고 키보드가 올라오면 가려진다. 데스크톱 모달은 기존 배치 그대로.
  const topButton = (label: string, onClick: () => void, primary = false) => (
    <button type="button" className={primary ? styles.topButtonPrimary : styles.topButton} onClick={onClick}>
      {label}
    </button>
  )
  let barTitle = heading
  let barLeft: ReactNode = null
  let barRight: ReactNode = null
  if (event && myStatus === 'pending') {
    barLeft = topButton('닫기', onClose)
  } else if (readOnly && event) {
    barRight = topButton('닫기', onClose)
  } else if (pendingAction) {
    barTitle = '범위 선택'
    barLeft = topButton('뒤로', () => setPendingAction(null))
  } else {
    barLeft = topButton('취소', onClose)
    barRight = topButton('저장', handleSaveClick, true)
  }
  const topBar = isMobile ? (
    <>
      <div className={styles.topBar}>
        <div className={styles.topLeft}>{barLeft}</div>
        <span className={styles.topTitle}>{barTitle}</span>
        <div className={styles.topRight}>{barRight}</div>
      </div>
      {/* 검증 오류를 본문 맨 아래에 두면 저장을 눌러도 아무 일도 안 일어난 것처럼 보인다(키보드가 올라오면 특히) */}
      {error && !pendingAction && (
        <p className={styles.topError} role="alert">
          {error}
        </p>
      )}
    </>
  ) : undefined

  return (
    <Overlay onClose={onClose} header={topBar}>
      {!isMobile && <span className={styles.heading}>{heading}</span>}

      {event && myStatus === 'pending' ? (
        <>
          <p className={styles.scopeQuestion}>{nameFor(event.ownerId)}님이 이 일정을 함께하자고 초대했어요.</p>
          {readOnlyDetails}
          <div className={styles.actions}>
            {!isMobile && (
              <button type="button" className={styles.buttonSecondary} onClick={onClose}>
                닫기
              </button>
            )}
            <button type="button" className={styles.buttonDanger} onClick={() => handleRespond('declined')}>
              거절
            </button>
            <button type="button" className={styles.buttonPrimary} onClick={() => handleRespond('accepted')}>
              수락
            </button>
          </div>
        </>
      ) : readOnly && event ? (
        <>
          <p className={styles.scopeQuestion}>공유받은 일정은 보기만 가능해요.</p>
          {readOnlyDetails}
          {!isMobile && (
            <button type="button" className={styles.buttonSecondary} onClick={onClose}>
              닫기
            </button>
          )}
        </>
      ) : pendingAction ? (
        <div className={styles.scopePicker}>
          <p className={styles.scopeQuestion}>
            반복 일정이에요. {pendingAction === 'delete' ? '삭제' : '저장'} 범위를 선택해 주세요.
          </p>
          <button
            type="button"
            className={styles.scopeButton}
            onClick={() => (pendingAction === 'delete' ? commitDelete('this') : commitSave('this'))}
          >
            이 일정만
          </button>
          <button
            type="button"
            className={styles.scopeButton}
            onClick={() => (pendingAction === 'delete' ? commitDelete('following') : commitSave('following'))}
          >
            이후 전체
          </button>
          <button
            type="button"
            className={styles.scopeButton}
            onClick={() => (pendingAction === 'delete' ? commitDelete('all') : commitSave('all'))}
          >
            전체 일정
          </button>
          {!isMobile && (
            <button type="button" className={styles.buttonSecondary} onClick={() => setPendingAction(null)}>
              취소
            </button>
          )}
        </div>
      ) : (
        <>
          <label className={styles.field}>
            <span className={styles.label}>제목</span>
            {/* 모달을 열자마자 바로 입력할 수 있게 자동 포커스 */}
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus={!coarsePointer}
            />
          </label>

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            종일
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>시작</span>
              <input
                type="date"
                className={styles.input}
                value={startDate}
                onChange={(e) => {
                  const value = e.target.value
                  setStartDate(value)
                  // 시작일을 종료일보다 늦게 바꾸면 종료일이 시작일보다 빨라져 저장이 막히므로,
                  // 종료일을 시작일에 맞춰 같이 올려준다
                  if (value > endDate) setEndDate(value)
                }}
              />
            </label>
            {!allDay && (
              <label className={styles.field}>
                <span className={styles.label}>시작 시간</span>
                <input
                  type="time"
                  className={styles.input}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
            )}
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>종료</span>
              <input
                type="date"
                className={styles.input}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            {!allDay && (
              <label className={styles.field}>
                <span className={styles.label}>종료 시간</span>
                <input
                  type="time"
                  className={styles.input}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>
            )}
          </div>

          {showMultiDaySpanWarning && (
            <p className={styles.warning}>
              이 일정은 {spanDays + 1}일간 지속돼요. 반복과 함께 쓰면 여러 회차가 겹쳐 보일 수 있어요.
            </p>
          )}

          <RecurrenceFields
            freq={freq}
            onFreqChange={setFreq}
            interval={interval}
            onIntervalChange={setInterval}
            byWeekday={byWeekday}
            onToggleWeekday={toggleWeekday}
            endCondition={endCondition}
            onEndConditionChange={setEndCondition}
            until={until}
            onUntilChange={setUntil}
            count={count}
            onCountChange={setCount}
            showChangeHint={Boolean(event?.recurrence)}
          />

          {isOwner ? (
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>카테고리</span>
                <select
                  className={styles.select}
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="">없음</option>
                  {myCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>색상</span>
                <input type="color" className={styles.input} value={color} onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>
          ) : (
            participantList
          )}

          {canInvite && (
            <ParticipantPicker
              candidates={inviteCandidates}
              selectedIds={selectedIds}
              onToggle={toggleParticipant}
              inviteMode={inviteMode}
              onInviteModeChange={setInviteMode}
              showInviteMode={hasNewInvitee}
            />
          )}

          <label className={styles.field}>
            <span className={styles.label}>메모</span>
            <textarea className={styles.textarea} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>

          {error && !isMobile && <span className={styles.error}>{error}</span>}

          <div className={styles.actions}>
            {event && isOwner && (
              <button type="button" className={styles.buttonDanger} onClick={handleDeleteClick}>
                삭제
              </button>
            )}
            {event && !isOwner && (
              <button type="button" className={styles.buttonDanger} onClick={handleLeaveClick}>
                참여 취소
              </button>
            )}
            {!isMobile && (
              <>
                <button type="button" className={styles.buttonSecondary} onClick={onClose}>
                  취소
                </button>
                <button type="button" className={styles.buttonPrimary} onClick={handleSaveClick}>
                  저장
                </button>
              </>
            )}
          </div>
        </>
      )}
    </Overlay>
  )
}

export default EventEditor
