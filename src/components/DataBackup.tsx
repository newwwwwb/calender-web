// 사이드바: 일정·카테고리를 JSON으로 내보내기/가져오기 (Supabase 전환 전까지의 백업·이전 수단)
import { useRef } from 'react'
import { toDateKey } from '../lib/date'
import { useCalendar } from '../state/useCalendar'
import type { CalendarEvent, Category } from '../types'
import styles from './DataBackup.module.css'

interface BackupFile {
  events: CalendarEvent[]
  categories: Category[]
  exportedAt: string
}

function isBackupFile(value: unknown): value is BackupFile {
  const v = value as Partial<BackupFile> | null
  return v !== null && typeof v === 'object' && Array.isArray(v.events) && Array.isArray(v.categories)
}

function DataBackup() {
  const { events, categories, addEvent, deleteEvent, addCategory, deleteCategory } = useCalendar()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const backup: BackupFile = { events, categories, exportedAt: new Date().toISOString() }
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

    const ok = window.confirm(
      `현재 일정 ${events.length}개, 카테고리 ${categories.length}개를 지우고 ` +
        `파일 내용(일정 ${parsed.events.length}개, 카테고리 ${parsed.categories.length}개)으로 바꿀까요?`,
    )
    if (!ok) return

    for (const event of events) await deleteEvent(event.id)
    for (const category of categories) await deleteCategory(category.id)
    for (const category of parsed.categories) await addCategory(category)
    for (const event of parsed.events) await addEvent(event)
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
