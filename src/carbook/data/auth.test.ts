// data/auth.ts: 전 기기 로그아웃(AC-18-4), 로그인 시작 실패 전달, 복귀 주소 오류 판별을 확인하는 테스트
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ client: true, signOut: vi.fn(), signIn: vi.fn() }))
vi.mock('../../lib/supabaseClient', () => ({
  get supabase() { return h.client ? { auth: { signOut: h.signOut, signInWithOAuth: h.signIn } } : null },
}))

import { readLoginRedirectError, signOutAll, startGoogleLogin } from './auth'

beforeEach(() => { h.client = true; h.signOut.mockReset(); h.signIn.mockReset() })

describe('signOutAll', () => {
  it('인자 없이 signOut을 부른다(전 기기, AC-18-4)', async () => {
    h.signOut.mockResolvedValue({ error: null })
    await expect(signOutAll()).resolves.toBeUndefined()
    expect(h.signOut).toHaveBeenCalledWith()
  })

  it('error면 던지고 종류는 network 또는 unknown이다', async () => {
    h.signOut.mockResolvedValueOnce({ error: { status: 0, name: 'AuthRetryableFetchError' } })
    await expect(signOutAll()).rejects.toMatchObject({ kind: 'network' })
    h.signOut.mockResolvedValueOnce({ error: { status: 400, code: 'x' } })
    await expect(signOutAll()).rejects.toMatchObject({ kind: 'unknown', code: 'x' })
  })

  it('클라이언트가 없으면 no_client로 던진다', async () => {
    h.client = false
    await expect(signOutAll()).rejects.toMatchObject({ kind: 'unknown', code: 'no_client' })
  })
})

describe('startGoogleLogin', () => {
  it('구글 공급자와 redirectTo로 시작한다', async () => {
    h.signIn.mockResolvedValue({ error: null })
    await startGoogleLogin('http://localhost:5173/car')
    expect(h.signIn).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'http://localhost:5173/car' } })
  })

  it('error면 던진다', async () => {
    h.signIn.mockResolvedValue({ error: { status: 500 } })
    await expect(startGoogleLogin('x')).rejects.toMatchObject({ kind: 'unknown' })
  })
})

describe('readLoginRedirectError', () => {
  it.each([
    [{ search: '?error=access_denied&error_description=x', hash: '' }, true],
    [{ search: '', hash: '#error=server_error' }, true],
    [{ search: '?error_description=x', hash: '' }, true],
    [{ search: '', hash: '#access_token=abc' }, false],
    [{ search: '', hash: '' }, false],
    [{ search: '?errors=1', hash: '' }, false],
  ])('%j → %s', (loc, expected) => {
    expect(readLoginRedirectError(loc)).toBe(expected)
  })
})
