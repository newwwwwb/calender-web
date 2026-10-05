// 할 일 목록: 완료 토글, 추가/수정/삭제. CategoryList의 인라인 편집 패턴을 따른다
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { toDateKey } from '../lib/date'
import { listItemMotion, springDefault, springSnappy } from '../lib/motion'
import { useCalendar } from '../state/useCalendar'
import type { Todo } from '../types'
import styles from './TodoList.module.css'
import { CheckIcon, CloseIcon } from './icons'

// 미완료 먼저(마감일 오름차순, 마감일 없는 건 뒤) → 완료는 아래
// 화면에는 "9월 28일"처럼 쓴다 — ISO(09-28)는 앱의 다른 날짜 표기와 달랐다(25단계 UX 감사)
function formatDue(dueDate: string): string {
  return `${Number(dueDate.slice(5, 7))}월 ${Number(dueDate.slice(8, 10))}일`
}

// 체크한 뒤 행이 자리를 옮기기까지 머무는 시간 — 체크·취소선 애니메이션을 볼 틈을 준다(바로 점프하면 무슨 일이 일어났는지 놓친다)
const SETTLE_MS = 500

// settling: 방금 토글해서 아직 옮기지 않은 항목의 "토글 전" 완료 상태. 정렬만 이 값을 쓰고 화면(체크·취소선)은 실제 상태를 바로 보여준다
function sortTodos(todos: Todo[], settling: ReadonlyMap<string, boolean>): Todo[] {
  const doneOf = (t: Todo) => settling.get(t.id) ?? t.done
  return [...todos].sort((a, b) => {
    if (doneOf(a) !== doneOf(b)) return doneOf(a) ? 1 : -1
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
  const reduceMotion = useReducedMotion()

  // 완료 토글 후 잠깐 머물다 옮기기: settling(정렬용 이전 상태)과 reorderTick(이때만 레이아웃 보간을 켜는 신호)
  const [settling, setSettling] = useState<ReadonlyMap<string, boolean>>(new Map())
  const [reorderTick, setReorderTick] = useState(0)
  const settleTimers = useRef(new Map<string, number>())
  useEffect(() => {
    const timers = settleTimers.current
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])

  function toggleDone(todo: Todo) {
    const wasDone = todo.done
    window.clearTimeout(settleTimers.current.get(todo.id))
    // 연속으로 눌러도 "처음 상태"를 유지해야 하므로 이미 머무는 중이면 덮어쓰지 않는다
    setSettling((prev) => (prev.has(todo.id) ? prev : new Map(prev).set(todo.id, wasDone)))
    updateTodo({ ...todo, done: !wasDone })
    if (!wasDone) navigator.vibrate?.(8) // 지원하는 기기(Android)에서만 완료 순간에 짧게
    settleTimers.current.set(
      todo.id,
      window.setTimeout(() => {
        setSettling((prev) => {
          const next = new Map(prev)
          next.delete(todo.id)
          return next
        })
        setReorderTick((t) => t + 1)
      }, SETTLE_MS),
    )
  }

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

  // 삭제는 확인창 없이 바로 하고 "되돌리기" 토스트(useCalendar.deleteTodo)가 실수를 막는다
  function remove(todo: Todo) {
    deleteTodo(todo.id)
  }

  function editRow(onSave: () => void) {
    // 카테고리 이름 입력란과 같은 이유로 Enter로도 저장되게 한다(보스 리뷰에서 발견)
    function saveOnEnter(e: React.KeyboardEvent) {
      if (e.key === 'Enter') onSave()
      if (e.key === 'Escape') {
        // 입력줄 안에서 Esc는 입력만 접는다 — 시트(TodoSheet)까지 같이 닫히지 않게 전파를 끊는다
        e.stopPropagation()
        cancel()
      }
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
          <CheckIcon size={16} />
        </button>
        <button type="button" className={styles.iconButton} onClick={cancel} aria-label="취소">
          <CloseIcon size={16} />
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* 할 일이 하나도 없으면 빈 목록 위에 추가 버튼만 덩그러니 있었다 */}
      {todos.length === 0 && !adding && <p className={styles.empty}>할 일이 없어요.</p>}
      <ul className={styles.list}>
        <AnimatePresence initial={false}>
          {sortTodos(todos, settling).map((todo) =>
            editingId === todo.id ? (
              <motion.li key={todo.id} {...listItemMotion}>
                {editRow(() => saveEdit(todo))}
              </motion.li>
            ) : (
              <motion.li
                key={todo.id}
                {...listItemMotion}
                // 재정렬만 부드럽게 옮긴다. layout을 항상 켜면 추가·삭제 때 목록 밖 요소(추가 버튼·다음 섹션)가 즉시 움직여
                // 서로 겹쳤다(24.10 보스 실측) — layoutDependency가 바뀔 때(완료 토글 후 자리 이동)만 측정·보간한다.
                layout="position"
                layoutDependency={reorderTick}
                transition={{ default: springDefault, layout: springSnappy }}
                className={styles.row}
              >
                <span className={styles.check}>
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => toggleDone(todo)}
                    aria-label={`${todo.title} 완료`}
                  />
                  {/* 체크 표시는 완료되는 순간 그려진다(pathLength 0→1). 입력은 진짜 checkbox라 키보드·스크린리더는 그대로 */}
                  <motion.svg viewBox="0 0 24 24" aria-hidden="true" className={styles.checkMark}>
                    <motion.path
                      d="m5 12.5 4.5 4.5L19 7.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={false}
                      animate={{ pathLength: todo.done ? 1 : 0, opacity: todo.done ? 1 : 0 }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
                    />
                  </motion.svg>
                </span>
                <button
                  type="button"
                  className={todo.done ? styles.titleButtonDone : styles.titleButton}
                  onClick={() => startEdit(todo)}
                >
                  <span className={styles.titleText}>{todo.title}</span>
                </button>
                {todo.dueDate && (
                  <span className={!todo.done && todo.dueDate < toDateKey(new Date()) ? styles.dueDateOverdue : styles.dueDate}>
                    {formatDue(todo.dueDate)}
                  </span>
                )}
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => remove(todo)}
                  aria-label={`${todo.title} 삭제`}
                >
                  <CloseIcon size={16} />
                </button>
              </motion.li>
            ),
          )}
        </AnimatePresence>
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
