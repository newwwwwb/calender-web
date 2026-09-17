// 함께 일정 입력 UI: 참여자 선택 + 초대 방식(수락 요청/바로 등록), 참여자 상태 목록 (EventEditor에서 분리)
import type { ID, ParticipantStatus } from '../types'
import styles from './EventEditor.module.css'

const STATUS_LABELS: Record<ParticipantStatus, string> = {
  pending: '응답 대기',
  accepted: '수락',
  declined: '거절',
}

export interface InviteCandidate {
  userId: ID
  email: string
  status?: ParticipantStatus // 이미 초대된 사람만 있음
}

interface ParticipantPickerProps {
  candidates: InviteCandidate[]
  selectedIds: ID[]
  onToggle: (userId: ID) => void
  inviteMode: 'pending' | 'accepted'
  onInviteModeChange: (mode: 'pending' | 'accepted') => void
  showInviteMode: boolean // 새로 초대하는 사람이 있을 때만 방식을 묻는다
}

export function ParticipantPicker({
  candidates,
  selectedIds,
  onToggle,
  inviteMode,
  onInviteModeChange,
  showInviteMode,
}: ParticipantPickerProps) {
  return (
    <fieldset className={styles.together}>
      <legend className={styles.label}>함께할 사람</legend>
      {candidates.map((c) => (
        <label key={c.userId} className={styles.checkboxRow}>
          <input type="checkbox" checked={selectedIds.includes(c.userId)} onChange={() => onToggle(c.userId)} />
          <span className={styles.participantName}>{c.email}</span>
          {c.status && <span className={styles[`status_${c.status}`]}>{STATUS_LABELS[c.status]}</span>}
        </label>
      ))}
      {showInviteMode && (
        <div className={styles.inviteMode} role="radiogroup" aria-label="초대 방식">
          <label className={styles.inviteModeOption}>
            <input
              type="radio"
              name="invite-mode"
              checked={inviteMode === 'pending'}
              onChange={() => onInviteModeChange('pending')}
            />
            <span>
              <strong>수락 요청</strong>
              <small>상대가 수락하면 확정돼요</small>
            </span>
          </label>
          <label className={styles.inviteModeOption}>
            <input
              type="radio"
              name="invite-mode"
              checked={inviteMode === 'accepted'}
              onChange={() => onInviteModeChange('accepted')}
            />
            <span>
              <strong>바로 등록</strong>
              <small>바로 확정하고 알림만 보내요</small>
            </span>
          </label>
        </div>
      )}
    </fieldset>
  )
}

interface ParticipantListProps {
  ownerName: string
  participants: { userId: ID; name: string; status: ParticipantStatus }[]
}

export function ParticipantList({ ownerName, participants }: ParticipantListProps) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>참여자</span>
      <ul className={styles.participantList}>
        <li>
          <span className={styles.participantName}>{ownerName}</span>
          <span className={styles.status_accepted}>작성자</span>
        </li>
        {participants.map((p) => (
          <li key={p.userId}>
            <span className={styles.participantName}>{p.name}</span>
            <span className={styles[`status_${p.status}`]}>{STATUS_LABELS[p.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
