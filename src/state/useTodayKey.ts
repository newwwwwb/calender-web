// 오늘 날짜 키('YYYY-MM-DD')를 돌려주고, 자정이 지나면 스스로 갱신해 다시 렌더시키는 훅.
// 예전엔 각 보기가 렌더 시점에 toDateKey(new Date())를 읽어서, 창을 켜 둔 채 자정이 지나면 다른 이유로 다시 렌더될 때까지
// 오늘 표시·지난 일정 흐림이 어제 기준으로 남았다(25단계 심사에서 "확인하지 못한 것"으로 남은 항목).
import { useEffect, useState } from 'react'
import { toDateKey } from '../lib/date'

// 자정에 맞춘 setTimeout 하나보다 1분 간격 확인이 튼튼하다 — 절전·최대 절전에서 깨어나거나 가려진 창의 타이머가 늦춰져도 따라잡는다.
// 날짜가 그대로면 같은 값이라 React가 다시 렌더하지 않는다.
const CHECK_MS = 60_000

export function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()))

  useEffect(() => {
    const check = () => setTodayKey(toDateKey(new Date()))
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check()
    }
    const interval = setInterval(check, CHECK_MS)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return todayKey
}
