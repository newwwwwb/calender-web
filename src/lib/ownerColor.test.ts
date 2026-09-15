// ownerColorFor: 공유자 순서에 따라 안정적인 색을 배정하는지 확인
import { describe, expect, it } from 'vitest'
import { ownerColorFor } from './ownerColor'

describe('ownerColorFor', () => {
  it('같은 공유자 목록에서는 항상 같은 색을 반환한다', () => {
    const owners = ['owner-a', 'owner-b']
    expect(ownerColorFor('owner-a', owners)).toBe(ownerColorFor('owner-a', owners))
    expect(ownerColorFor('owner-a', owners)).not.toBe(ownerColorFor('owner-b', owners))
  })

  it('팔레트보다 공유자가 많으면 순환한다', () => {
    const owners = Array.from({ length: 8 }, (_, i) => `owner-${i}`)
    expect(ownerColorFor('owner-6', owners)).toBe(ownerColorFor('owner-0', owners))
  })
})
