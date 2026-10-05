// 설정 모달: 카테고리 + 공유 캘린더 + 데이터 내보내기/가져오기 + 기본 보기 + 디자인 테마 선택. 데스크탑/모바일 어디서든 Header 버튼으로 연다
// 카테고리·공유 캘린더는 Sidebar에도 있지만, Sidebar가 768px 미만에서 숨어서 모바일은 여기가 유일한 접근 경로다(보스 리뷰에서 발견).
import { useAuth } from '../state/useAuth'
import { MOBILE_QUERY, useMediaQuery } from '../state/useMediaQuery'
import AuthButton from './AuthButton'
import CategoryList from './CategoryList'
import DataBackup from './DataBackup'
import DefaultViewSelect from './DefaultViewSelect'
import Overlay from './Overlay'
import ShareSection from './ShareSection'
import styles from './SettingsModal.module.css'
import ShortcutsToggle from './ShortcutsToggle'
import ThemeToggle from './ThemeToggle'
import { CloseIcon } from './icons'

interface SettingsModalProps {
  onClose: () => void
}

function SettingsModal({ onClose }: SettingsModalProps) {
  // 모바일 헤더에는 로그인/로그아웃 버튼 자리가 없어 계정은 여기서 다룬다
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const { user } = useAuth()
  // 헤더에 로그인 버튼이 없는 폭(모바일·태블릿 세로)에서는 설정이 계정 진입점이다
  const headerHasNoAuth = useMediaQuery('(max-width: 1023px)')
  return (
    <Overlay
      onClose={onClose}
      label="설정"
      header={
        <div className={styles.header}>
          <h2 className={styles.heading}>설정</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>
      }
    >
      {(isMobile || headerHasNoAuth) && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>계정</h3>
          {/* 저장 위치가 어디인지 어디에도 안 보였다(모바일은 로그인 이메일이 title 툴팁뿐이라 볼 수 없었다) */}
          <p className={styles.accountNote}>
            {user ? `${user.email ?? '로그인한 계정'}으로 로그인했어요.` : '이 기기에만 저장 중이에요. 로그인하면 다른 기기와 동기화되고 공유할 수 있어요.'}
          </p>
          <AuthButton />
        </div>
      )}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>화면</h3>
        <ThemeToggle />
      </div>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>기본 보기</h3>
        <DefaultViewSelect />
      </div>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>카테고리</h3>
        <CategoryList />
      </div>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>공유 캘린더</h3>
        <ShareSection />
      </div>
      {/* 키보드가 없는 모바일에는 의미 없는 섹션이라 데스크톱에서만 */}
      {!isMobile && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>키보드 단축키</h3>
          <ShortcutsToggle />
        </div>
      )}
      {/* 설정 순서: 자주 바꾸는 것(화면·보기)이 위, 한 번에 많이 바뀌는 위험한 동작(데이터 복원)이 맨 아래 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>데이터</h3>
        <DataBackup />
      </div>
    </Overlay>
  )
}

export default SettingsModal
