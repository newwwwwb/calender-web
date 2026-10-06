// 반복 일정을 드래그로 옮기거나 길이를 바꾼 뒤 "이 일정만 / 이후 / 모든 반복 일정" 중 어디에 적용할지 묻는 시트
import type { RecurrenceScope } from '../lib/recurrenceMove'
import { MOBILE_QUERY, useMediaQuery } from '../state/useMediaQuery'
import editorStyles from './EventEditor.module.css'
import Overlay from './Overlay'

interface RecurrenceScopeDialogProps {
  onChoose: (scope: RecurrenceScope) => void
  disabledScopes?: RecurrenceScope[] // 그 범위로는 옮길 수 없는 경우(매달·매년 반복에서 달마다 없는 날로) — 비활성 + 안내
  onCancel: () => void // 취소·Esc·스크림·아래로 끌어 닫기 — 아무것도 바꾸지 않는다
}

// 편집기의 범위 선택(scopePicker)과 같은 문구·모양을 쓴다 — 같은 질문이 두 곳에서 다르게 보이지 않게
function RecurrenceScopeDialog({ onChoose, disabledScopes = [], onCancel }: RecurrenceScopeDialogProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  return (
    <Overlay onClose={onCancel} label="반복 일정 적용 범위">
      <div className={editorStyles.scopePicker}>
        <p className={editorStyles.scopeQuestion}>어떤 일정에 적용할까요?</p>
        {disabledScopes.length > 0 && (
          <p className={editorStyles.hint}>매달·매년 반복은 같은 달 안(28일까지)에서만 전체·이후로 옮길 수 있어요. 그 밖은 '이 일정만' 가능해요.</p>
        )}
        <button type="button" className={editorStyles.scopeButton} disabled={disabledScopes.includes('this')} onClick={() => onChoose('this')}>
          이 일정만
        </button>
        <button type="button" className={editorStyles.scopeButton} disabled={disabledScopes.includes('following')} onClick={() => onChoose('following')}>
          이 일정과 이후 일정
        </button>
        <button type="button" className={editorStyles.scopeButton} disabled={disabledScopes.includes('all')} onClick={() => onChoose('all')}>
          모든 반복 일정
        </button>
        {!isMobile && (
          <button type="button" className={editorStyles.buttonSecondary} onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </Overlay>
  )
}

export default RecurrenceScopeDialog
