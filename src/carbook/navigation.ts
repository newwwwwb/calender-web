// 라우터 없이 History API로 /car 주소를 다루는 훅과 이동 함수 (ADR-001)
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('popstate', onChange)
  }
}

// 현재 경로(pathname). pushState와 뒤로·앞으로 가기(popstate)에 모두 다시 그려진다
export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname)
}

// "/car"와 "/car/"만 차계부다(BR-01)
export function isCarPath(path: string): boolean {
  return path === '/car' || path === '/car/'
}

// 같은 경로면 기록을 쌓지 않는다(F-01 예외 흐름)
export function navigate(path: string): void {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  listeners.forEach((notify) => notify())
}
