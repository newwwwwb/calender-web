// 확인창(DLG-02 삭제 확인, DLG-04 주행거리 감소 확인): 확인 버튼을 누른 뒤에만 요청을 보내고, 취소·Esc·창 밖 클릭은 모두 취소다
import { useRef, useState } from 'react'
import Overlay from '../../components/Overlay'
import { MSG_13_CONFIRM_DELETE } from '../domain/messages'
import ui from './ui.module.css'

// target 또는 message 중 정확히 하나는 있어야 한다(둘 다 없으면 "을(를) 삭제할까요?"가 나온다)
type Subject =
  | { target: string; message?: undefined } // 문구 MSG-13의 {대상}: "차량 출퇴근", "교체 항목 엔진오일"처럼 종류가 앞에 붙은 이름
  | { message: string; target?: undefined } // MSG-13 대신 보일 문구(예: DLG-04의 MSG-10)

interface BaseProps {
  title?: string // 기본 "삭제할까요?"
  label?: string // 대화상자의 접근 가능한 이름. 기본 "삭제 확인"
  confirmLabel?: string // 기본 "삭제"
  tone?: 'danger' | 'primary' // 확인 버튼 모양. 기본 danger(DLG-04는 primary)
  warning?: string // 차량 삭제의 MSG-14처럼 문구 아래에 덧붙이는 경고
  onConfirm: () => Promise<boolean> // true면 삭제됨(창을 닫는다). false면 실패 토스트는 훅이 띄우고 창은 그대로 둔다
  onClose: () => void
}

type ConfirmDialogProps = BaseProps & Subject

export default function ConfirmDialog({ target, message, title = '삭제할까요?', label = '삭제 확인', confirmLabel = '삭제', tone = 'danger', warning, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const closed = useRef(false)
  const inFlight = useRef(false) // state는 같은 틱의 두 번째 클릭에 아직 반영되지 않아 ref로 막는다

  async function confirm() {
    if (inFlight.current) return // 중복 제출 방지: 삭제 요청은 한 번만(AC-10-2)
    inFlight.current = true
    setBusy(true)
    let done = false
    try {
      done = await onConfirm()
    } catch (error) {
      console.error('[carbook] 삭제 요청 오류:', error) // 계약상 reject하지 않지만, 하더라도 창이 영구히 잠기지 않게 푼다
    }
    if (done && !closed.current) onClose()
    else if (!done) {
      inFlight.current = false
      setBusy(false)
    }
  }

  // 닫기는 막지 않는다 — 모바일 시트는 끌어 닫을 때 먼저 화면 밖으로 내려가므로 막으면 보이지 않는 창이 남아 앱이 잠긴다.
  // 요청 중에 이미 닫았다면 완료 뒤 onClose를 또 부르지 않는다(중복 요청은 inFlight가 막는다)
  const requestClose = () => {
    closed.current = true
    onClose()
  }

  return (
    <Overlay label={label} onClose={requestClose}>
      <div className={ui.dialogBody}>
        <h2 className={ui.dialogTitle}>{title}</h2>
        <p>{message ?? MSG_13_CONFIRM_DELETE(target ?? '')}</p>
        {warning && <p className={ui.warning}>{warning}</p>}
        <div className={ui.buttonRow}>
          <button type="button" className={`${ui.btn} ${tone === 'primary' ? ui.primary : ui.danger}`} disabled={busy} onClick={confirm}>
            {confirmLabel}
          </button>
          {/* 확인창은 포커스가 "취소"에서 시작한다(실수로 Enter를 눌러도 지워지지 않게) */}
          <button type="button" className={`${ui.btn} ${ui.secondary}`} autoFocus onClick={requestClose}>
            취소
          </button>
        </div>
      </div>
    </Overlay>
  )
}
