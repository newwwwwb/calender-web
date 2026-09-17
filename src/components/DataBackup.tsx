// 사이드바: 일정·카테고리를 JSON으로 내보내기/가져오기 (Supabase 전환 전까지의 백업·이전 수단)
// 공유받은 남의 일정/카테고리는 삭제 권한이 없으므로(RLS) 내 것만 대상으로 한다
import { useRef } from 'react'
import { toDateKey } from '../lib/date'
import { useCalendar } from '../state/useCalendar'
import type { CalendarEvent, Category, Todo } from '../types'
import styles from './DataBackup.module.css'

interface BackupFile {
  events: CalendarEvent[]
  categories: Category[]
  todos?: Todo[] // 예전 백업 파일과 호환: 없으면 빈 배열로 취급
  exportedAt: string
}

function isBackupFile(value: unknown): value is BackupFile {
  const v = value as Partial<BackupFile> | null
  if (v === null || typeof v !== 'object' || !Array.isArray(v.events) || !Array.isArray(v.categories)) return false
  // 항목 단위 필수 필드도 확인 — 불량 항목이 그대로 저장되면 나중에 화면에서 크래시로 이어진다
  const eventsValid = v.events.every(
    (e) => e && typeof e.id === 'string' && typeof e.title === 'string' && typeof e.allDay === 'boolean' && typeof e.start === 'string' && typeof e.end === 'string',
  )
  const categoriesValid = v.categories.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.color === 'string')
  const todosValid = v.todos === undefined || (Array.isArray(v.todos) && v.todos.every((t) => t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.done === 'boolean'))
  return eventsValid && categoriesValid && todosValid
}

function DataBackup() {
  const { events, myCategories, todos, currentUserId, addEvent, deleteEvent, addCategory, deleteCategory, addTodo, deleteTodo } =
    useCalendar()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const myEvents = events.filter((e) => !e.ownerId || e.ownerId === currentUserId)
  // 할 일은 애초에 공유되지 않으므로(개인 전용) ownerId로 거를 필요 없음

  function handleExport() {
    // participants는 서버가 채우는 파생 데이터(누가 초대됐는지)라 백업 파일에 담을 이유가 없고,
    // 가져오기 때는 로컬 일정으로 복원돼 의미도 없다 — 상대 이메일까지 그대로 남기지 않는다.
    const exportableEvents = myEvents.map(({ participants: _participants, ...rest }) => rest)
    const backup: BackupFile = { events: exportableEvents, categories: myCategories, todos, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `calendar-backup-${toDateKey(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 선택해도 change 이벤트가 뜨도록 비워둔다
    if (!file) return

    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      window.alert('올바른 백업 파일이 아니에요.')
      return
    }
    if (!isBackupFile(parsed)) {
      window.alert('올바른 백업 파일이 아니에요.')
      return
    }

    const parsedTodos = parsed.todos ?? []
    // 함께 일정을 지우면 참여자에게 삭제 알림이 가고, 참여자 정보 자체도 복구되지 않는다 — 미리 알려준다
    const hasJointEvents = myEvents.some((e) => (e.participants?.length ?? 0) > 0)
    const ok = window.confirm(
      `현재 내 일정 ${myEvents.length}개, 카테고리 ${myCategories.length}개, 할 일 ${todos.length}개를 지우고 ` +
        `파일 내용(일정 ${parsed.events.length}개, 카테고리 ${parsed.categories.length}개, 할 일 ${parsedTodos.length}개)으로 바꿀까요?` +
        (hasJointEvents ? '\n\n함께 일정의 참여자 정보는 사라지고, 참여자에게 삭제 알림이 가요.' : ''),
    )
    if (!ok) return

    // 중간에 실패하면(네트워크 끊김 등) 삭제만 되고 새 데이터는 안 들어간 채 멈출 수 있다 —
    // 되돌릴 방법은 없지만 최소한 무슨 일이 있었는지는 알려준다(보스 리뷰에서 발견).
    try {
      for (const event of myEvents) await deleteEvent(event.id)
      for (const category of myCategories) await deleteCategory(category.id)
      for (const todo of todos) await deleteTodo(todo.id)
      for (const category of parsed.categories) await addCategory(category)
      for (const event of parsed.events) await addEvent(event)
      for (const todo of parsedTodos) await addTodo(todo)
    } catch {
      window.alert('가져오는 중 오류가 발생했어요. 일부만 반영됐을 수 있으니 데이터를 확인해주세요.')
    }
  }

  return (
    <div className={styles.row}>
      <button type="button" className={styles.link} onClick={handleExport}>
        내보내기
      </button>
      <button type="button" className={styles.link} onClick={() => fileInputRef.current?.click()}>
        가져오기
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        data-testid="import-file-input"
        onChange={handleFileChange}
      />
    </div>
  )
}

export default DataBackup
