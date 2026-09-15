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
  return v !== null && typeof v === 'object' && Array.isArray(v.events) && Array.isArray(v.categories)
}

function DataBackup() {
  const { events, categories, todos, currentUserId, addEvent, deleteEvent, addCategory, deleteCategory, addTodo, deleteTodo } =
    useCalendar()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const myEvents = events.filter((e) => !e.ownerId || e.ownerId === currentUserId)
  const myCategories = categories.filter((c) => !c.ownerId || c.ownerId === currentUserId)
  // 할 일은 애초에 공유되지 않으므로(개인 전용) ownerId로 거를 필요 없음

  function handleExport() {
    const backup: BackupFile = { events: myEvents, categories: myCategories, todos, exportedAt: new Date().toISOString() }
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
    const ok = window.confirm(
      `현재 내 일정 ${myEvents.length}개, 카테고리 ${myCategories.length}개, 할 일 ${todos.length}개를 지우고 ` +
        `파일 내용(일정 ${parsed.events.length}개, 카테고리 ${parsed.categories.length}개, 할 일 ${parsedTodos.length}개)으로 바꿀까요?`,
    )
    if (!ok) return

    for (const event of myEvents) await deleteEvent(event.id)
    for (const category of myCategories) await deleteCategory(category.id)
    for (const todo of todos) await deleteTodo(todo.id)
    for (const category of parsed.categories) await addCategory(category)
    for (const event of parsed.events) await addEvent(event)
    for (const todo of parsedTodos) await addTodo(todo)
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
