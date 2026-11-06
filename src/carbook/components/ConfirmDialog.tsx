// 삭제 확인창(DLG-02, F-11): "삭제"를 누른 뒤에만 삭제 요청을 보내고, 취소·Esc·창 밖 클릭은 모두 취소다
import { useRef, useState } from 'react'
import Overlay from '../../components/Overlay'
import { MSG_13_CONFIRM_DELETE } from '../domain/messages'
import ui from './ui.module.css'

interface ConfirmDialogProps {
  target: string // 문구 MSG-13의 {대상}: "차량 출퇴근", "교체 항목 엔진오일"처럼 종류가 앞에 붙은 이름
  warning?: string // 차량 삭제의 MSG-14처럼 문구 아래에 덧붙이는 경고
  onConfirm: () => Promise<boolean> // true면 삭제됨(창을 닫는다). false면 실패 토스트는 훅이 띄우고 창은 그대로 둔다
  onClose: () => void
}

export default function ConfirmDialog({ target, warning, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false) // state는 같은 틱의 두 번째 클릭에 아직 반영되지 않아 ref로 막는다

  async function confirm() {
    if (inFlight.current) return // 중복 제출 방지: 삭제 요청은 한 번만(AC-10-2)
    inFlight.current = true
    setBusy(true)
    const done = await onConfirm()
    if (done) onClose()
    else {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <Overlay label="삭제 확인" onClose={onClose}>
      <div className={ui.dialogBody}>
        <h2 className={ui.dialogTitle}>삭제할까요?</h2>
        <p>{MSG_13_CONFIRM_DELETE(target)}</p>
        {warning && <p className={ui.warning}>{warning}</p>}
        <div className={ui.buttonRow}>
          <button type="button" className={`${ui.btn} ${ui.danger}`} disabled={busy} onClick={confirm}>
            삭제
          </button>
          {/* 확인창은 포커스가 "취소"에서 시작한다(실수로 Enter를 눌러도 지워지지 않게) */}
          <button type="button" className={`${ui.btn} ${ui.secondary}`} autoFocus onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </Overlay>
  )
}
