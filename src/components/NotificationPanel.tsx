// 함께 일정 알림 패널: 헤더 종 아이콘으로 연다. 초대(수락 대기)는 바로 수락/거절할 수 있다
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { listItemMotion } from '../lib/motion'
import { useToast } from '../state/useToast'
import type { AppNotification } from '../types'
import styles from './NotificationPanel.module.css'
import Overlay from './Overlay'
import { CloseIcon } from './icons'

interface NotificationPanelProps {
  notifications: AppNotification[]
  onClose: () => void
  onRespond: (eventId: string, status: 'accepted' | 'declined') => void
}

// 문구에 명사 '일정'을 넣어 제목 끝 글자에 따라 달라지는 조사(을/를)를 피한다 — 예전엔 '치과'을처럼 받침 없는 제목에서 틀렸다.
// "누가 누구를"이 모호하던 '등록했어요'는 "나를 … 일정에 추가했어요"로 분명하게 쓴다(25단계 UX 감사).
function describe(n: AppNotification): string {
  const who = n.actorEmail || '알 수 없는 사용자'
  const title = `'${n.eventTitle}' 일정`
  switch (n.kind) {
    case 'invited':
      return n.status === 'pending' ? `${who}님이 ${title}에 초대했어요.` : `${who}님이 나를 ${title}에 추가했어요.`
    case 'updated':
      return `${who}님이 ${title}을 수정했어요.`
    case 'responded':
      return `${who}님이 ${title} 초대를 ${n.status === 'accepted' ? '수락' : '거절'}했어요.`
    case 'deleted':
      return `${who}님이 ${title}을 삭제했어요.`
  }
}

function NotificationPanel({ notifications, onClose, onRespond }: NotificationPanelProps) {
  const { showToast } = useToast()
  // 초대에 응답하면 respond_to_event만 상태를 바꿀 뿐 이 알림 행 자체는 그대로라, 패널을 닫았다
  // 다시 열면 respondedIds가 초기화돼 버튼이 다시 보인다 — 같은 상태로 또 눌러도 서버(respond_to_event)가
  // 멱등하게 처리해 알림이 중복으로 쌓이지는 않으므로 이 정도는 감수한다(YAGNI).
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set())

  function respond(n: AppNotification, status: 'accepted' | 'declined') {
    if (!n.eventId) return
    Promise.resolve(onRespond(n.eventId, status)).catch(() =>
      showToast({ message: '응답을 보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.', tone: 'error' }),
    )
    setRespondedIds((prev) => new Set(prev).add(n.id))
  }

  return (
    <Overlay
      onClose={onClose}
      label="알림"
      header={
        <div className={styles.header}>
          <h2 className={styles.heading}>알림</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>
      }
    >
      {notifications.length === 0 ? (
        <p className={styles.empty}>새 알림이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          <AnimatePresence initial={false}>
            {notifications.map((n) => {
              const showActions = n.kind === 'invited' && n.status === 'pending' && n.eventId && !respondedIds.has(n.id)
              return (
                <motion.li key={n.id} {...listItemMotion} className={styles.item}>
                  <p className={styles.text}>{describe(n)}</p>
                  {showActions && (
                    <div className={styles.actions}>
                      <button type="button" className={styles.buttonPrimary} onClick={() => respond(n, 'accepted')}>
                        수락
                      </button>
                      <button type="button" className={styles.buttonSecondary} onClick={() => respond(n, 'declined')}>
                        거절
                      </button>
                    </div>
                  )}
                  {respondedIds.has(n.id) && <p className={styles.done}>처리했어요</p>}
                  <span className={styles.when}>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ko })}</span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </Overlay>
  )
}

export default NotificationPanel
