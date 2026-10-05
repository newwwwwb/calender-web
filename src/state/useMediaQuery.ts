// 미디어 쿼리 매치 여부를 구독하는 훅(뷰포트 폭에 따라 다른 모션을 고르는 데 사용). jsdom은
// matchMedia가 없어서 테스트 환경에서는 항상 false(데스크톱)로 동작한다.
import { useEffect, useState } from 'react'

// 모바일 레이아웃 조건: 900px 미만(태블릿 세로 포함 — 데스크톱 헤더는 사이드바 256px을 뺀 폭에서 주 보기가 ~900px부터 한 줄에 들어간다), 또는 가로로 눕힌 휴대폰(높이가 500px 이하인 터치 기기). 가로 모드는 데스크톱 레이아웃이 적용돼
// 사이드바가 256px을 차지하고 그리드가 1.5주만 보였다(25단계 UX 감사). CSS의 @media는 같은 조건을 직접 적는다 — 둘을 같이 고칠 것.
export const MOBILE_QUERY = '(max-width: 899px), (max-height: 500px) and (pointer: coarse)'

function getMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => getMatches(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
