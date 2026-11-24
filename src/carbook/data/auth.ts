// 차계부의 로그인·로그아웃 실패를 알기 위해 supabase.auth를 얇게 감싸는 모듈(ADR-008)
import { supabase } from '../../lib/supabaseClient'
import { CarbookError } from './request'

type AuthError = { status?: number; name?: string; code?: string } | null

function fail(error: NonNullable<AuthError>): never {
  const network = error.status === 0 || error.name === 'AuthRetryableFetchError'
  throw new CarbookError(network ? 'network' : 'unknown', error.code)
}

function client() {
  if (!supabase) throw new CarbookError('unknown', 'no_client')
  return supabase
}

// 인자 없이 호출해 모든 기기에서 로그아웃한다(AC-18-4). 상태 변화는 useAuth가 onAuthStateChange로 받는다
export async function signOutAll(): Promise<void> {
  const { error } = await client().auth.signOut()
  if (error) fail(error)
}

// 구글 로그인으로 이동한다. 성공하면 브라우저가 공급자 페이지로 바뀐다
export async function startGoogleLogin(redirectTo: string): Promise<void> {
  const { error } = await client().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  if (error) fail(error)
}

// 로그인 복귀 주소(검색·해시)에 error 또는 error_description 키가 있는지만 본다. 값은 읽지 않는다
export function readLoginRedirectError(loc: Pick<Location, 'search' | 'hash'>): boolean {
  const has = (raw: string) => {
    const p = new URLSearchParams(raw.replace(/^[?#]/, ''))
    return p.has('error') || p.has('error_description')
  }
  return has(loc.search) || has(loc.hash)
}
