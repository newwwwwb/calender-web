// 함께 일정 알림(19단계): 앱을 열 때/60초마다/창에 포커스가 돌아올 때 새로고침한다.
// Realtime은 쓰지 않는다 — 개인용 앱 규모에서 서버 구독까지는 과함(YAGNI).
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { listNotifications, markAllRead as requestMarkAllRead } from '../storage/togetherRepository'
import type { AppNotification, ID } from '../types'

const POLL_MS = 60_000

interface UseNotificationsOptions {
  userId: ID | undefined
  onChanged?: () => void // 안 읽은 알림이 새로 생기면 호출된다(캘린더를 다시 불러오는 용도)
}

export function useNotifications({ userId, onChanged }: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const signatureRef = useRef('')
  const loadedOnceRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!supabase || !userId) return
    const next = await listNotifications(supabase)
    const unreadCount = next.filter((n) => !n.readAt).length
    const signature = `${unreadCount}:${next[0]?.createdAt ?? ''}`
    const changed = signature !== signatureRef.current
    signatureRef.current = signature
    setNotifications(next)
    // 최초 로드에서는 항상 "바뀐" 것으로 보이므로 그때는 onChanged를 부르지 않는다
    if (changed && loadedOnceRef.current) onChanged?.()
    loadedOnceRef.current = true
  }, [userId, onChanged])

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      signatureRef.current = ''
      loadedOnceRef.current = false
      return
    }
    refresh()
    const interval = setInterval(refresh, POLL_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [userId, refresh])

  const markAllRead = useCallback(async () => {
    if (!supabase) return
    await requestMarkAllRead(supabase)
    await refresh()
  }, [refresh])

  const unreadCount = notifications.filter((n) => !n.readAt).length

  return { notifications, unreadCount, refresh, markAllRead }
}
