// vitest에 jest-dom 커스텀 매처를 등록하고, 테스트마다 렌더링된 DOM을 정리하는 테스트 셋업 파일
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
