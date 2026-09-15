// 캘린더 화면 상태(현재 날짜/선택일/이벤트·카테고리)와 CRUD 액션을 제공하는 Context
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { LocalEventRepository } from '../storage/localRepository'
import type { EventRepository } from '../storage/repository'
import { SupabaseEventRepository } from '../storage/supabaseRepository'
import { SupabaseShareRepository } from '../storage/supabaseShareRepository'
import type { CalendarEvent, CalendarView, Category, ID, SharedCalendar, Todo } from '../types'
import { useAuth } from './useAuth'
import { readDefaultView } from './useDefaultView'

const MIGRATED_KEY = 'calendar.migratedToSupabase'

// 로그인 첫 순간에만 로컬 데이터를 Supabase로 올린다 (이후 재로그인 시에는 건너뜀)
async function migrateLocalDataToSupabase(target: EventRepository) {
  const local = new LocalEventRepository()
  const [events, categories, todos] = await Promise.all([local.listEvents(), local.listCategories(), local.listTodos()])
  for (const category of categories) await target.addCategory(category)
  for (const event of events) await target.addEvent(event)
  for (const todo of todos) await target.addTodo(todo)
}

export type { CalendarView } from '../types'

interface CalendarContextValue {
  currentDate: Date
  selectedDate: Date
  view: CalendarView
  events: CalendarEvent[]
  shownEvents: CalendarEvent[] // hiddenOwnerIds로 겹쳐보기에서 숨긴 캘린더를 뺀 이벤트 (뷰 렌더링은 이걸 쓴다)
  categories: Category[]
  loading: boolean
  setCurrentDate: (date: Date) => void
  setSelectedDate: (date: Date) => void
  setView: (view: CalendarView) => void
  changeView: (view: CalendarView) => void // 보기를 바꾸면서 선택된 날짜를 기준으로 이동한다 (Header/단축키가 공유)
  addEvent: (event: CalendarEvent) => Promise<void>
  updateEvent: (event: CalendarEvent) => Promise<void>
  deleteEvent: (id: ID) => Promise<void>
  addCategory: (category: Category) => Promise<void>
  updateCategory: (category: Category) => Promise<void>
  deleteCategory: (id: ID) => Promise<void>
  todos: Todo[]
  addTodo: (todo: Todo) => Promise<void>
  updateTodo: (todo: Todo) => Promise<void>
  deleteTodo: (id: ID) => Promise<void>
  currentUserId?: ID
  sharedCalendars: SharedCalendar[] // 나에게 공유된 캘린더 목록(소유자 정보)
  hiddenOwnerIds: Set<ID> // 겹쳐보기에서 숨긴 캘린더의 소유자 id (내 캘린더도 포함 가능)
  toggleOwnerVisible: (ownerId: ID) => void
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

interface CalendarProviderProps {
  children: ReactNode
  repository?: EventRepository // 테스트나 8단계 Supabase 전환 시 주입
}

export function CalendarProvider({ children, repository }: CalendarProviderProps) {
  const { user } = useAuth()
  // 렌더마다 새 인스턴스가 생기지 않도록 최초 한 번만 생성
  const [repo, setRepo] = useState<EventRepository>(() => repository ?? new LocalEventRepository())
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [view, setView] = useState<CalendarView>(readDefaultView)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [sharedCalendars, setSharedCalendars] = useState<SharedCalendar[]>([])
  const [hiddenOwnerIds, setHiddenOwnerIds] = useState<Set<ID>>(new Set())

  const changeView = useCallback(
    (next: CalendarView) => {
      setView(next)
      setCurrentDate(selectedDate)
    },
    [selectedDate],
  )

  const reload = useCallback(async () => {
    const [nextEvents, nextCategories, nextTodos] = await Promise.all([
      repo.listEvents(),
      repo.listCategories(),
      repo.listTodos(),
    ])
    setEvents(nextEvents)
    setCategories(nextCategories)
    setTodos(nextTodos)
  }, [repo])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  // repository가 명시적으로 주입되지 않은 경우에만 로그인 상태에 맞춰 저장소를 전환한다 (테스트는 repository로 고정)
  useEffect(() => {
    if (repository) return
    if (!user || !supabase) {
      setRepo(new LocalEventRepository())
      return
    }
    const supabaseRepo = new SupabaseEventRepository(supabase, user.id)
    if (localStorage.getItem(MIGRATED_KEY)) {
      setRepo(supabaseRepo)
      return
    }
    migrateLocalDataToSupabase(supabaseRepo).then(() => {
      localStorage.setItem(MIGRATED_KEY, 'true')
      setRepo(supabaseRepo)
    })
  }, [user, repository])

  // 나에게 공유된 캘린더 목록 — 로그인 상태가 아니면 항상 비워둔다(공유는 Supabase 모드 전용 기능)
  useEffect(() => {
    if (repository) return
    if (!user || !supabase) {
      setSharedCalendars([])
      return
    }
    new SupabaseShareRepository(supabase, user.id, user.email ?? '').listSharedWithMe().then(setSharedCalendars)
  }, [user, repository])

  const shownEvents = useMemo(
    () => events.filter((event) => !hiddenOwnerIds.has(event.ownerId ?? user?.id ?? '')),
    [events, hiddenOwnerIds, user],
  )

  const toggleOwnerVisible = useCallback((ownerId: ID) => {
    setHiddenOwnerIds((prev) => {
      const next = new Set(prev)
      if (next.has(ownerId)) next.delete(ownerId)
      else next.add(ownerId)
      return next
    })
  }, [])

  const addEvent = useCallback(
    async (event: CalendarEvent) => {
      await repo.addEvent(event)
      await reload()
    },
    [repo, reload],
  )
  const updateEvent = useCallback(
    async (event: CalendarEvent) => {
      await repo.updateEvent(event)
      await reload()
    },
    [repo, reload],
  )
  const deleteEvent = useCallback(
    async (id: ID) => {
      await repo.deleteEvent(id)
      await reload()
    },
    [repo, reload],
  )
  const addCategory = useCallback(
    async (category: Category) => {
      await repo.addCategory(category)
      await reload()
    },
    [repo, reload],
  )
  const updateCategory = useCallback(
    async (category: Category) => {
      await repo.updateCategory(category)
      await reload()
    },
    [repo, reload],
  )
  const deleteCategory = useCallback(
    async (id: ID) => {
      await repo.deleteCategory(id)
      await reload()
    },
    [repo, reload],
  )
  const addTodo = useCallback(
    async (todo: Todo) => {
      await repo.addTodo(todo)
      await reload()
    },
    [repo, reload],
  )
  const updateTodo = useCallback(
    async (todo: Todo) => {
      await repo.updateTodo(todo)
      await reload()
    },
    [repo, reload],
  )
  const deleteTodo = useCallback(
    async (id: ID) => {
      await repo.deleteTodo(id)
      await reload()
    },
    [repo, reload],
  )

  const value: CalendarContextValue = {
    currentDate,
    selectedDate,
    view,
    events,
    shownEvents,
    categories,
    loading,
    setCurrentDate,
    setSelectedDate,
    setView,
    changeView,
    addEvent,
    updateEvent,
    deleteEvent,
    addCategory,
    updateCategory,
    deleteCategory,
    todos,
    addTodo,
    updateTodo,
    deleteTodo,
    currentUserId: user?.id,
    sharedCalendars,
    hiddenOwnerIds,
    toggleOwnerVisible,
  }

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error('useCalendar는 CalendarProvider 안에서만 사용할 수 있습니다')
  return ctx
}
