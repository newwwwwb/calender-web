// 사이드바 카테고리 목록: 추가/수정/삭제와 색상 선택
import { useState } from 'react'
import { useCalendar } from '../state/useCalendar'
import type { Category } from '../types'
import styles from './CategoryList.module.css'

const DEFAULT_COLOR = '#0066ff'

function CategoryList() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCalendar()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftColor, setDraftColor] = useState(DEFAULT_COLOR)

  function startAdd() {
    setEditingId(null)
    setAdding(true)
    setDraftName('')
    setDraftColor(DEFAULT_COLOR)
  }

  function startEdit(category: Category) {
    setAdding(false)
    setEditingId(category.id)
    setDraftName(category.name)
    setDraftColor(category.color)
  }

  function cancel() {
    setAdding(false)
    setEditingId(null)
  }

  function saveAdd() {
    const name = draftName.trim()
    if (!name) return
    addCategory({ id: crypto.randomUUID(), name, color: draftColor })
    setAdding(false)
  }

  function saveEdit() {
    const name = draftName.trim()
    if (!name || !editingId) return
    updateCategory({ id: editingId, name, color: draftColor })
    setEditingId(null)
  }

  function remove(category: Category) {
    const ok = window.confirm(
      `'${category.name}' 카테고리를 삭제할까요? 이 카테고리를 쓰던 일정은 남지만 카테고리 색은 사라져요.`,
    )
    if (ok) deleteCategory(category.id)
  }

  return (
    <div>
      <ul className={styles.list}>
        {categories.map((category) =>
          editingId === category.id ? (
            <li key={category.id} className={styles.editRow}>
              <input
                type="color"
                value={draftColor}
                onChange={(e) => setDraftColor(e.target.value)}
                aria-label="카테고리 색"
              />
              <input
                className={styles.nameInput}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                aria-label="카테고리 이름"
                autoFocus
              />
              <button type="button" className={styles.iconButton} onClick={saveEdit} aria-label="저장">
                ✓
              </button>
              <button type="button" className={styles.iconButton} onClick={cancel} aria-label="취소">
                ✕
              </button>
            </li>
          ) : (
            <li key={category.id} className={styles.row}>
              <span className={styles.swatch} style={{ background: category.color }} />
              <button type="button" className={styles.nameButton} onClick={() => startEdit(category)}>
                {category.name}
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => remove(category)}
                aria-label={`${category.name} 삭제`}
              >
                ×
              </button>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <div className={styles.editRow}>
          <input
            type="color"
            value={draftColor}
            onChange={(e) => setDraftColor(e.target.value)}
            aria-label="카테고리 색"
          />
          <input
            className={styles.nameInput}
            placeholder="카테고리 이름"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            aria-label="카테고리 이름"
            autoFocus
          />
          <button type="button" className={styles.iconButton} onClick={saveAdd} aria-label="추가">
            ✓
          </button>
          <button type="button" className={styles.iconButton} onClick={cancel} aria-label="취소">
            ✕
          </button>
        </div>
      ) : (
        <button type="button" className={styles.addButton} onClick={startAdd}>
          + 카테고리 추가
        </button>
      )}
    </div>
  )
}

export default CategoryList
