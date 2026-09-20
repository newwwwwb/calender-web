// 캘린더 화면 상태(현재 날짜/선택일/이벤트·카테고리)와 CRUD 액션을 제공하는 Context
import { getDaysInMonth, isSameMonth } from 'date-fns'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isVisibleTo } from '../lib/together'
import { LocalEventRepository } from '../storage/localRepository'
import type { EventRepository } from '../storage/repository'
import { SupabaseEventRepository } from '../storage/supabaseRepository'
import { SupabaseShareRepository } from '../storage/supabaseShareRepository'
import { respondToEvent as requestRespondToEvent, setParticipants as requestSetParticipants } from '../storage/togetherRepository'
import type { CalendarEvent, CalendarView, Category, ID, Participant, SharedCalendar, Todo } from '../types'
import { useAuth } from './useAuth'
import { readDefaultView } from './useDefaultView'

// 사용자별로 따로 관리 — 공용 브라우저에서 계정이 바뀌면 다른 사람의 마이그레이션 여부와
// 섞이던 문제가 있었다(보스 리뷰에서 발견).
function migratedKeyFor(userId: string): string {
  return `calendar.migratedToSupabase.${userId}`
}

// 위 사용자별 키로 바꾸기 전에 쓰던 전역 키. 이미 이 키로 마이그레이션을 마친 사용자는
// 새 키가 없다고 다시 마이그레이션을 시도해 이미 Supabase에 있는 이벤트를 또 insert하려다
// unique 제약(중복 id) 위반으로 실패했다 — 옛 키도 같이 확인해서 재시도를 막는다.
const LEGACY_MIGRATED_KEY = 'calendar.migratedToSupabase'

// 웹과 바탕화면 위젯이 같은 DB를 보므로, 한쪽에서 바꾼 일정이 다른 쪽에 나타나도록 주기적으로 다시 불러온다.
// Realtime은 쓰지 않는다 — 반영 속도보다 이중 입력 방지가 목적이라 폴링으로 충분(YAGNI).
const REFRESH_MS = 60_000

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
  myCategories: Category[] // 공유받은(남의) 카테고리를 뺀 목록 — 관리 UI·선택 목록은 이걸 쓴다(RLS가 수정/삭제를 막는데 UI엔 남의 것도 보이던 버그 수정)
  loading: boolean
  reload: () => Promise<void>
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
  // 함께 일정(19단계): 로그아웃/로컬 모드에서는 아무 일도 하지 않는다(호출할 UI가 뜨지 않음)
  respondToEvent: (eventId: ID, status: 'accepted' | 'declined') => Promise<void>
  setEventParticipants: (
    eventId: ID,
    current: Participant[],
    next: { userId: ID; status: 'pending' | 'accepted' }[],
  ) => Promise<void>
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
  const [currentDate, setCurrentDateRaw] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [view, setView] = useState<CalendarView>(readDefaultView)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [sharedCalendars, setSharedCalendars] = useState<SharedCalendar[]>([])
  const [hiddenOwnerIds, setHiddenOwnerIds] = useState<Set<ID>>(new Set())

  // 월 보기에서 다른 달로 넘어가면 선택일도 그 달의 같은 날짜로 따라간다. 안 그러면 "10월"을 보면서
  // 선택일은 9월 20일로 남아, 모바일 월 보기의 일정 목록 제목이 다른 달을 가리키고 새 일정(FAB/N)도
  // 안 보이는 9월에 만들어졌다(보스 리뷰에서 발견). 다른 보기는 기존 동작 그대로.
  const setCurrentDate = useCallback(
    (date: Date) => {
      setCurrentDateRaw(date)
      if (view !== 'month') return
      setSelectedDate((prev) =>
        isSameMonth(prev, date)
          ? prev
          : new Date(date.getFullYear(), date.getMonth(), Math.min(prev.getDate(), getDaysInMonth(date))),
      )
    },
    [view],
  )

  const changeView = useCallback(
    (next: CalendarView) => {
      setView(next)
      setCurrentDateRaw(selectedDate)
    },
    [selectedDate],
  )

  const reloadSeqRef = useRef(0)
  const reload = useCallback(async () => {
    const seq = ++reloadSeqRef.current
    const [nextEvents, nextCategories, nextTodos] = await Promise.all([
      repo.listEvents(),
      repo.listCategories(),
      repo.listTodos(),
    ])
    // 그동안 더 늦게 시작한 reload(예: 방금 한 수정 직후 재로드)가 있으면 이 응답은 오래된 것이라 버린다
    if (seq !== reloadSeqRef.current) return
    setEvents(nextEvents)
    setCategories(nextCategories)
    setTodos(nextTodos)
  }, [repo])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  useEffect(() => {
    const refresh = () => {
      reload().catch(() => {}) // 일시적인 네트워크 오류는 다음 주기에 다시 시도한다
    }
    const interval = setInterval(refresh, REFRESH_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [reload])

  // repository가 명시적으로 주입되지 않은 경우에만 로그인 상태에 맞춰 저장소를 전환한다 (테스트는 repository로 고정)
  useEffect(() => {
    if (repository) return
    if (!user || !supabase) {
      setRepo(new LocalEventRepository())
      return
    }
    const supabaseRepo = new SupabaseEventRepository(supabase, user.id)
    const migratedKey = migratedKeyFor(user.id)
    if (localStorage.getItem(migratedKey) || localStorage.getItem(LEGACY_MIGRATED_KEY)) {
      localStorage.setItem(migratedKey, 'true')
      setRepo(supabaseRepo)
      return
    }
    migrateLocalDataToSupabase(supabaseRepo)
      .then(() => {
        localStorage.setItem(migratedKey, 'true')
        setRepo(supabaseRepo)
      })
      .catch((err) => {
        // 실패하면 플래그를 세우지 않아 다음 로그인 때 재시도된다 — 대신 로컬 저장소에 그대로
        // 머물러서 사용자가 빈 화면을 보게 되는 건 막는다(보스 리뷰에서 발견: 이전엔 조용히
        // 실패하고 아무 표시도 없었음).
        console.error('[migration] 로컬 데이터를 Supabase로 옮기는 데 실패했어요:', err)
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
    () => events.filter((event) => isVisibleTo(event, user?.id, hiddenOwnerIds)),
    [events, hiddenOwnerIds, user],
  )

  const myCategories = useMemo(
    () => categories.filter((c) => !c.ownerId || c.ownerId === user?.id),
    [categories, user],
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

  const respondToEvent = useCallback(
    async (eventId: ID, status: 'accepted' | 'declined') => {
      if (!supabase) return
      await requestRespondToEvent(supabase, eventId, status)
      await reload()
    },
    [reload],
  )
  const setEventParticipants = useCallback(
    async (eventId: ID, current: Participant[], next: { userId: ID; status: 'pending' | 'accepted' }[]) => {
      if (!supabase) return
      await requestSetParticipants(supabase, eventId, current, next)
      await reload()
    },
    [reload],
  )

  const value: CalendarContextValue = {
    currentDate,
    selectedDate,
    view,
    events,
    shownEvents,
    categories,
    myCategories,
    loading,
    reload,
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
    respondToEvent,
    setEventParticipants,
  }

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error('useCalendar는 CalendarProvider 안에서만 사용할 수 있습니다')
  return ctx
}
