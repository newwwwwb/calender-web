// 할 일 목록: 완료 토글, 추가/수정/삭제. CategoryList의 인라인 편집 패턴을 따른다
import { useState } from 'react'
import { useCalendar } from '../state/useCalendar'
import type { Todo } from '../types'
import styles from './TodoList.module.css'

// 미완료 먼저(마감일 오름차순, 마감일 없는 건 뒤) → 완료는 아래
function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.localeCompare(b.dueDate)
  })
}

function TodoList() {
  const { todos, myCategories, addTodo, updateTodo, deleteTodo } = useCalendar()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDueDate, setDraftDueDate] = useState('')
  const [draftCategoryId, setDraftCategoryId] = useState('')

  function resetDraft() {
    setDraftTitle('')
    setDraftDueDate('')
    setDraftCategoryId('')
  }

  function startAdd() {
    setEditingId(null)
    setAdding(true)
    resetDraft()
  }

  function startEdit(todo: Todo) {
    setAdding(false)
    setEditingId(todo.id)
    setDraftTitle(todo.title)
    setDraftDueDate(todo.dueDate ?? '')
    setDraftCategoryId(todo.categoryId ?? '')
  }

  function cancel() {
    setAdding(false)
    setEditingId(null)
  }

  function draftToFields() {
    return {
      title: draftTitle.trim(),
      dueDate: draftDueDate || undefined,
      categoryId: draftCategoryId || undefined,
    }
  }

  function saveAdd() {
    const { title, dueDate, categoryId } = draftToFields()
    if (!title) return
    addTodo({ id: crypto.randomUUID(), title, done: false, dueDate, categoryId })
    setAdding(false)
  }

  function saveEdit(original: Todo) {
    const { title, dueDate, categoryId } = draftToFields()
    if (!title) return
    updateTodo({ ...original, title, dueDate, categoryId })
    setEditingId(null)
  }

  function remove(todo: Todo) {
    if (window.confirm(`'${todo.title}' 할 일을 삭제할까요?`)) deleteTodo(todo.id)
  }

  function editRow(onSave: () => void) {
    // 카테고리 이름 입력란과 같은 이유로 Enter로도 저장되게 한다(보스 리뷰에서 발견)
    function saveOnEnter(e: React.KeyboardEvent) {
      if (e.key === 'Enter') onSave()
    }
    return (
      <div className={styles.editRow}>
        <input
          className={styles.titleInput}
          placeholder="할 일"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={saveOnEnter}
          aria-label="할 일 제목"
          autoFocus
        />
        <input
          type="date"
          className={styles.dateInput}
          value={draftDueDate}
          onChange={(e) => setDraftDueDate(e.target.value)}
          onKeyDown={saveOnEnter}
          aria-label="마감일"
        />
        <select
          className={styles.categorySelect}
          value={draftCategoryId}
          onChange={(e) => setDraftCategoryId(e.target.value)}
          aria-label="카테고리"
        >
          <option value="">카테고리 없음</option>
          {myCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" className={styles.iconButton} onClick={onSave} aria-label="저장">
          ✓
        </button>
        <button type="button" className={styles.iconButton} onClick={cancel} aria-label="취소">
          ✕
        </button>
      </div>
    )
  }

  return (
    <div>
      <ul className={styles.list}>
        {sortTodos(todos).map((todo) =>
          editingId === todo.id ? (
            <li key={todo.id}>{editRow(() => saveEdit(todo))}</li>
          ) : (
            <li key={todo.id} className={styles.row}>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => updateTodo({ ...todo, done: !todo.done })}
                aria-label={`${todo.title} 완료`}
              />
              <button
                type="button"
                className={todo.done ? styles.titleButtonDone : styles.titleButton}
                onClick={() => startEdit(todo)}
              >
                {todo.title}
              </button>
              {todo.dueDate && <span className={styles.dueDate}>{todo.dueDate.slice(5)}</span>}
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => remove(todo)}
                aria-label={`${todo.title} 삭제`}
              >
                ×
              </button>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        editRow(saveAdd)
      ) : (
        <button type="button" className={styles.addButton} onClick={startAdd}>
          + 할 일 추가
        </button>
      )}
    </div>
  )
}

export default TodoList
