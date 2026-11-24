// 로그인 사용자 정보에서 계정 영역에 보일 이름·이메일·사진·이니셜·버튼 라벨을 뽑는 순수 함수(F-17, AC-17-10)
export interface AccountSource { email?: string | null; user_metadata?: Record<string, unknown> | null }
export interface AccountDisplay { name: string | null; email: string | null; photoUrl: string | null; initial: string; label: string }

// 키 순서대로 첫 번째 값만 쓴다. 문자열만 받고 앞뒤 공백은 지운다
function firstString(meta: Record<string, unknown>, keys: string[], accept: (s: string) => boolean = () => true): string | null {
  for (const k of keys) {
    const v = meta[k]
    if (typeof v === 'string' && v.trim() !== '' && accept(v.trim())) return v.trim()
  }
  return null
}

export function accountDisplay(user: AccountSource): AccountDisplay {
  const meta = user.user_metadata ?? {}
  const name = firstString(meta, ['full_name', 'name'])
  const email = typeof user.email === 'string' && user.email.trim() !== '' ? user.email.trim() : null
  const photoUrl = firstString(meta, ['avatar_url', 'picture'], (s) => s.startsWith('https:'))
  const base = name ?? email
  return { name, email, photoUrl, initial: base ? (Array.from(base)[0] as string).toUpperCase() : '?', label: base ? `계정 메뉴, ${base}` : '계정 메뉴' }
}
