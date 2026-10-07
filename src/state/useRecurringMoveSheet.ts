// 반복 일정을 끌어 놓은 뒤 범위(이 일정만/이후/전체)를 묻고 저장하는 상태·흐름 — 주·일(TimeGridView)과 월(MonthView)이 함께 쓴다
import { useCallback, useState } from 'react'
import { canMoveEvent, DRAG_BLOCKED_MESSAGE } from '../lib/blockDrag'
import { isScopeSafe, planRecurringMove, type RecurrenceScope } from '../lib/recurrenceMove'
import { isJoint } from '../lib/together'
import type { EventInstance } from '../types'
import { useCalendar } from './useCalendar'
import { useToast } from './useToast'

export interface PendingRecurringMove<M> {
  instance: EventInstance // 놓을 때 잡아 둔 회차 — 선택 시점에 최신 회차로 다시 확인한다
  next: { start: string; end: string }
  meta: M // 호출한 뷰가 미리보기·토스트 문구에 쓰는 값(주·일: 드래그 모드, 월: 놓은 칸)
  choosing: boolean // 범위 시트가 열려 있는가(선택 뒤 저장이 끝날 때까지는 false로 두고 고스트만 유지)
}

interface Options<M> {
  instances: EventInstance[] // 지금 화면의 회차들(override 적용 후)
  currentUserId: string | undefined
  message: (instance: EventInstance, meta: M) => string // 저장 뒤 "되돌리기" 토스트 문구
  onApply?: (instance: EventInstance, next: { start: string; end: string }) => void // 범위를 골라 저장을 시작할 때(이동 뒤 포커스 복귀 요청용)
}

const JOINT_HINT = '함께하는 일정은 모든 반복 일정에만 적용할 수 있어요.'
const MONTHLY_HINT = "매달·매년 반복은 같은 달 안(28일까지)에서만 전체·이후로 옮길 수 있어요. 그 밖은 '이 일정만' 가능해요."
const BLOCKED_ALL_MESSAGE = '함께하는 매달·매년 반복 일정은 같은 달 안(28일까지)에서만 옮길 수 있어요.'

export function useRecurringMoveSheet<M>({ instances, currentUserId, message, onApply }: Options<M>) {
  const { updateEvent, applyEventEdits } = useCalendar()
  const { showToast } = useToast()
  const [pending, setPending] = useState<PendingRecurringMove<M> | null>(null)

  const open = useCallback(
    (instance: EventInstance, next: { start: string; end: string }, meta: M) => {
      // 고를 수 있는 범위가 하나도 없으면(함께 + 매달·매년이 다른 달로) 취소뿐인 막다른 시트 대신 이유를 알리고 원위치로 돌린다
      if ((['this', 'following', 'all'] as const).every((s) => !isScopeSafe(instance.event, instance, next, s))) {
        showToast({ message: BLOCKED_ALL_MESSAGE })
        return
      }
      setPending({ instance, next, meta, choosing: true })
    },
    [showToast],
  )
  const cancel = useCallback(() => setPending(null), [])

  // 범위 시트에서 막힌 범위(달마다 없는 날로 옮기는 매달·매년 반복의 '이후'·'전체' 등)
  const unsafeScopes: RecurrenceScope[] = pending
    ? (['this', 'following', 'all'] as const).filter((s) => !isScopeSafe(pending.instance.event, pending.instance, pending.next, s))
    : []

  // 막힌 범위가 있을 때 시트에 보여 줄 이유 — 함께 일정이면 참여자 때문, 아니면 매달·매년 규칙 때문
  // 함께+매달 규칙으로 막히면 세 범위가 모두 막혀 `open`이 시트를 열지 않으므로 두 문구가 함께 보일 일은 없다. 매달·매년 문구는 그 규칙 때문에 실제로 막힌 범위가 있을 때만 붙인다(함께 여부를 빼고 다시 판정)
  const joint = pending ? isJoint(pending.instance.event) : false
  const monthlyBlocked =
    pending !== null && (['following', 'all'] as const).some((s) => !isScopeSafe({ ...pending.instance.event, participants: undefined }, pending.instance, pending.next, s))
  const hint = [joint && JOINT_HINT, monthlyBlocked && MONTHLY_HINT].filter(Boolean).join(' ')

  function apply(scope: RecurrenceScope) {
    if (!pending) return
    const { next, meta } = pending
    // 시트는 오래 열려 있을 수 있어 그 사이 다른 기기에서 바뀌었을 수 있다 — 놓을 때 잡아 둔 스냅숏이 아니라 지금의 최신 회차로 다시 확인하고
    // 그 위에 시간만 덮는다(원격 수정을 지우지 않게). 지워졌거나 반복이 아니게 됐거나 옮길 수 없게 됐거나 시간이 바뀌었으면 저장하지 않는다
    const stale = pending.instance
    const instance = instances.find((i) => i.event.id === stale.event.id && i.instanceDate === stale.instanceDate)
    const plan =
      instance && instance.event.recurrence && canMoveEvent(instance.event, currentUserId) && instance.start === stale.start && instance.end === stale.end
        ? planRecurringMove(instance.event, instance, next, scope)
        : null
    if (!instance || !plan) {
      showToast({ message: DRAG_BLOCKED_MESSAGE })
      setPending(null)
      return
    }
    setPending({ ...pending, choosing: false })
    onApply?.(instance, next)
    const undo = { message: message(instance, meta), previous: instance.event }
    const saved = plan.add ? applyEventEdits(plan, undo) : updateEvent(plan.update, undo)
    void saved
      .catch(() => {}) // 저장 실패는 write가 이미 토스트로 알렸다
      .finally(() => setPending((cur) => (cur && cur.next === next ? null : cur))) // 그 사이 다른 이동이 시작됐으면 그 상태를 지우지 않는다
  }

  return { pending, open, cancel, apply, unsafeScopes, hint }
}
