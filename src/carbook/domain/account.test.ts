// 계정 표시값(이름·이메일·사진·이니셜·버튼 라벨) 규칙 테스트(AC-17-10, Q-V1)
import { describe, expect, it } from 'vitest'
import { accountDisplay } from './account'

describe('accountDisplay', () => {
  it('이름이 있으면 라벨은 "계정 메뉴, 이름"이고 이니셜은 첫 글자다(AC-17-10)', () => {
    const d = accountDisplay({ email: 'carbook@example.com', user_metadata: { full_name: '김차계' } })
    expect(d).toEqual({ name: '김차계', email: 'carbook@example.com', photoUrl: null, initial: '김', label: '계정 메뉴, 김차계' })
  })

  it('이름이 없으면 이메일로 라벨과 영문 대문자 이니셜을 만든다(AC-17-10)', () => {
    const d = accountDisplay({ email: 'carbook@example.com', user_metadata: {} })
    expect(d).toMatchObject({ name: null, initial: 'C', label: '계정 메뉴, carbook@example.com' })
  })

  it('이름 키는 full_name → name 순이고 공백만 있거나 문자열이 아니면 건너뛴다', () => {
    expect(accountDisplay({ user_metadata: { full_name: ' Tae ', name: 'x' } }).name).toBe('Tae')
    expect(accountDisplay({ user_metadata: { full_name: '  ', name: 'kim' } })).toMatchObject({ name: 'kim', initial: 'K' })
    expect(accountDisplay({ email: 'a@b.c', user_metadata: { full_name: 123, name: null } }).name).toBeNull()
  })

  it('사진은 avatar_url → picture 중 https: 로 시작하는 문자열만 쓴다', () => {
    expect(accountDisplay({ user_metadata: { avatar_url: 'https://x/a.png', picture: 'https://x/b.png' } }).photoUrl).toBe('https://x/a.png')
    expect(accountDisplay({ user_metadata: { avatar_url: 'http://x/a.png', picture: 'https://x/b.png' } }).photoUrl).toBe('https://x/b.png')
    expect(accountDisplay({ user_metadata: { avatar_url: 'javascript:alert(1)', picture: 'data:image/png;base64,AA' } }).photoUrl).toBeNull()
    expect(accountDisplay({ user_metadata: { avatar_url: 42 } }).photoUrl).toBeNull()
  })

  it('이름·이메일이 모두 없고 메타데이터가 비어도 죽지 않는다', () => {
    expect(accountDisplay({})).toEqual({ name: null, email: null, photoUrl: null, initial: '?', label: '계정 메뉴' })
    expect(accountDisplay({ email: null, user_metadata: null }).initial).toBe('?')
  })
})
