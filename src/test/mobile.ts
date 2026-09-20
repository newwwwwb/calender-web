// 테스트용 모바일 뷰포트 스텁: jsdom엔 matchMedia가 없어 기본이 데스크톱이므로, 모바일 분기는 이걸로 켠다.
// 사용 후 afterEach에서 vi.unstubAllGlobals()로 되돌린다.
import { vi } from 'vitest'

export function stubMobileViewport(coarsePointer = false) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width: 767px') || (coarsePointer && query.includes('pointer: coarse')),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}
