// 사이드바 "공유 캘린더" 섹션: 겹쳐보기 토글(내 캘린더/받은 캘린더) + 초대 링크 생성·삭제·멤버 관리
import { useState } from 'react'
import { useCalendar } from '../state/useCalendar'
import { useShareLinks } from '../state/useShareLinks'
import styles from './ShareSection.module.css'

function shareUrl(id: string): string {
  return `${window.location.origin}/share/${id}`
}

function ShareSection() {
  const { currentUserId, sharedCalendars, hiddenOwnerIds, toggleOwnerVisible } = useCalendar()
  const { links, membersByShare, createLink, deleteLink, removeMember } = useShareLinks()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (!currentUserId) {
    return <p className={styles.placeholder}>로그인하면 캘린더를 공유할 수 있어요</p>
  }

  async function copyLink(id: string) {
    await navigator.clipboard.writeText(shareUrl(id))
    setCopiedId(id)
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500)
  }

  return (
    <div>
      <ul className={styles.toggleList}>
        <li className={styles.toggleRow}>
          <label>
            <input
              type="checkbox"
              checked={!hiddenOwnerIds.has(currentUserId)}
              onChange={() => toggleOwnerVisible(currentUserId)}
            />
            내 캘린더
          </label>
        </li>
        {sharedCalendars.map((shared) => (
          <li key={shared.ownerId} className={styles.toggleRow}>
            <label>
              <input
                type="checkbox"
                checked={!hiddenOwnerIds.has(shared.ownerId)}
                onChange={() => toggleOwnerVisible(shared.ownerId)}
              />
              {shared.ownerEmail}
            </label>
          </li>
        ))}
      </ul>

      <p className={styles.sectionTitle}>공유 링크</p>
      <ul className={styles.linkList}>
        {links.map((link) => (
          <li key={link.id} className={styles.linkRow}>
            <div className={styles.linkHeader}>
              <button type="button" className={styles.copyButton} onClick={() => copyLink(link.id)}>
                {copiedId === link.id ? '복사됨' : '링크 복사'}
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => deleteLink(link.id)}
                aria-label="공유 링크 삭제"
              >
                ×
              </button>
            </div>
            {(membersByShare[link.id] ?? []).length === 0 ? (
              <p className={styles.memberPlaceholder}>아직 아무도 수락하지 않았어요</p>
            ) : (
              <ul className={styles.memberList}>
                {membersByShare[link.id].map((member) => (
                  <li key={member.id} className={styles.memberRow}>
                    <span className={styles.memberEmail}>{member.viewerEmail}</span>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => removeMember(member.id)}
                      aria-label={`${member.viewerEmail} 공유 취소`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className={styles.addButton} onClick={createLink}>
        + 공유 링크 만들기
      </button>
    </div>
  )
}

export default ShareSection
