// 반복 일정을 드래그로 옮기거나 길이를 바꾼 뒤 "이 일정만 / 이후 / 모든 반복 일정" 중 어디에 적용할지 묻는 시트
import { useId } from 'react'
import type { RecurrenceScope } from '../lib/recurrenceMove'
import { MOBILE_QUERY, useMediaQuery } from '../state/useMediaQuery'
import editorStyles from './EventEditor.module.css'
import Overlay from './Overlay'

interface RecurrenceScopeDialogProps {
  onChoose: (scope: RecurrenceScope) => void
  disabledScopes?: RecurrenceScope[] // 그 범위로는 옮길 수 없는 경우(매달·매년 반복의 달 경계·말일, 함께 일정) — 비활성 + 안내
  hint?: string // 막힌 이유(disabledScopes가 있을 때 보여 준다)
  onCancel: () => void // 취소·Esc·스크림·아래로 끌어 닫기 — 아무것도 바꾸지 않는다
}

// 편집기의 범위 선택(scopePicker)과 같은 문구·모양을 쓴다 — 같은 질문이 두 곳에서 다르게 보이지 않게
function RecurrenceScopeDialog({ onChoose, disabledScopes = [], hint, onCancel }: RecurrenceScopeDialogProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const hintId = useId()
  // 막힌 버튼을 읽을 때 이유가 함께 읽히게 안내 문구와 연결한다(스크린리더는 비활성 버튼에 포커스가 가지 않아 문구를 놓치기 쉽다)
  const describe = (scope: RecurrenceScope) => (disabledScopes.includes(scope) && hint ? hintId : undefined)
  return (
    <Overlay onClose={onCancel} label="반복 일정 적용 범위">
      <div className={editorStyles.scopePicker}>
        <p className={editorStyles.scopeQuestion}>어떤 일정에 적용할까요?</p>
        {disabledScopes.length > 0 && hint && (
          <p id={hintId} className={editorStyles.hint}>
            {hint}
          </p>
        )}
        <button type="button" className={editorStyles.scopeButton} disabled={disabledScopes.includes('this')} aria-describedby={describe('this')} onClick={() => onChoose('this')}>
          이 일정만
        </button>
        <button type="button" className={editorStyles.scopeButton} disabled={disabledScopes.includes('following')} aria-describedby={describe('following')} onClick={() => onChoose('following')}>
          이 일정과 이후 일정
        </button>
        <button type="button" className={editorStyles.scopeButton} disabled={disabledScopes.includes('all')} aria-describedby={describe('all')} onClick={() => onChoose('all')}>
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
