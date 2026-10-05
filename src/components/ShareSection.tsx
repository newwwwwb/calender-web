// 사이드바 "공유 캘린더" 섹션: 겹쳐보기 토글(내 캘린더/받은 캘린더) + 초대 링크 생성·삭제·멤버 관리
import { useState } from 'react'
import { useCalendar } from '../state/useCalendar'
import { useShareLinks } from '../state/useShareLinks'
import { useToast } from '../state/useToast'
import styles from './ShareSection.module.css'
import { CloseIcon } from './icons'

function shareUrl(id: string): string {
  return `${window.location.origin}/share/${id}`
}

// "10월 1일"처럼 — 링크가 여러 개일 때 어느 것인지 구분하는 단서
function formatCreated(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function ShareSection() {
  const { currentUserId, sharedCalendars, hiddenOwnerIds, toggleOwnerVisible } = useCalendar()
  const { links, membersByShare, createLink, deleteLink, removeMember } = useShareLinks()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { showToast } = useToast()

  if (!currentUserId) {
    return <p className={styles.placeholder}>로그인하면 캘린더를 공유할 수 있어요.</p>
  }

  // 복사가 막힌 환경(권한·비보안 컨텍스트)에서는 아무 반응이 없어 복사된 줄 알았다 — 실패를 알린다. 성공 여부를 돌려준다.
  async function copyLink(id: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(shareUrl(id))
    } catch {
      showToast({ message: '링크를 복사하지 못했어요. 다시 시도해 주세요.', tone: 'error' })
      return false
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500)
    return true
  }

  // 만들자마자 복사해 준다 — 새 링크를 만들고 다시 "링크 복사"를 찾아 누르던 한 단계를 없앤다
  async function handleCreate() {
    const id = await createLink()
    if (id && (await copyLink(id))) showToast({ message: '링크를 만들고 복사했어요. 공유할 사람에게 보내 주세요.' })
  }

  // 되돌릴 수 없는 동작(상대의 열람 권한이 끊김)이라 묻는다
  function handleDeleteLink(id: string) {
    if (window.confirm('이 링크를 삭제할까요? 이 링크로 연결된 사람들은 더 이상 내 캘린더를 볼 수 없어요.')) deleteLink(id)
  }

  function handleRemoveMember(memberId: string, email: string) {
    if (window.confirm(`${email}님과 공유를 끊을까요? 이 사람은 더 이상 내 캘린더를 볼 수 없어요.`)) removeMember(memberId)
  }

  return (
    <div>
      <p className={styles.description}>링크를 수락한 사람과 서로의 캘린더를 볼 수 있어요.</p>
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
              <span className={styles.linkDate}>{formatCreated(link.createdAt)}에 만든 링크</span>
              <button type="button" className={styles.copyButton} onClick={() => copyLink(link.id)}>
                {copiedId === link.id ? '복사됨' : '링크 복사'}
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => handleDeleteLink(link.id)}
                aria-label="공유 링크 삭제"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            {(membersByShare[link.id] ?? []).length === 0 ? (
              <p className={styles.memberPlaceholder}>아직 아무도 수락하지 않았어요.</p>
            ) : (
              <ul className={styles.memberList}>
                {membersByShare[link.id].map((member) => (
                  <li key={member.id} className={styles.memberRow}>
                    <span className={styles.memberEmail}>{member.viewerEmail}</span>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => handleRemoveMember(member.id, member.viewerEmail)}
                      aria-label={`${member.viewerEmail} 공유 끊기`}
                    >
                      <CloseIcon size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className={styles.addButton} onClick={handleCreate}>
        + 공유 링크 만들기
      </button>
    </div>
  )
}

export default ShareSection
