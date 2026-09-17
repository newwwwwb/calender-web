// vitest에 jest-dom 커스텀 매처를 등록하고, 테스트마다 렌더링된 DOM을 정리하는 테스트 셋업 파일
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach } from 'vitest'

// exit 애니메이션 지연 때문에 "닫힘/언마운트" 단언이 타임아웃되지 않도록 테스트에서는 모션을 즉시 완료시킨다
MotionGlobalConfig.skipAnimations = true

afterEach(cleanup)
