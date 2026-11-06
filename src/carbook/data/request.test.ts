// request()의 오류 분류와 20초 제한 시간(AC-10-9)을 가짜 타이머로 확인하는 테스트
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CarbookError, request, TIMEOUT_MS } from './request'

const fail = (code: string, status?: number) => Promise.resolve({ data: null, error: { code }, status })

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('request', () => {
  it('성공하면 data를 돌려준다', async () => {
    await expect(request('t', () => Promise.resolve({ data: { a: 1 }, error: null }))).resolves.toEqual({ a: 1 })
  })

  it.each([
    ['23505', 400, 'conflict'],
    ['23503', 409, 'conflict'],
    ['', 0, 'network'],
    ['PGRST000', 503, 'network'],
    ['42501', 403, 'unknown'],
    ['23514', 400, 'unknown'],
  ])('error.code %s·status %s → %s', async (code, status, kind) => {
    await expect(request('t', () => fail(code, status))).rejects.toMatchObject({ kind, ...(code ? { code } : {}) })
  })

  it('던져진 예외는 network로 본다', async () => {
    await expect(request('t', () => Promise.reject(new TypeError('Failed to fetch')))).rejects.toMatchObject({ kind: 'network' })
  })

  it('응답이 없으면 20초 뒤 timeout이고 신호가 중단된다(AC-10-9)', async () => {
    let signal!: AbortSignal
    const p = request('t', (s) => { signal = s; return new Promise<never>(() => {}) })
    const assertion = expect(p).rejects.toBeInstanceOf(CarbookError)
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1)
    expect(signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await assertion
    expect(signal.aborted).toBe(true)
    await expect(p).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('중단 신호가 선 뒤 온 오류는 timeout이다', async () => {
    const p = request('t', (s) => new Promise<{ data: null; error: { code: string } }>((resolve) => s.addEventListener('abort', () => resolve({ data: null, error: { code: '20' } }))))
    const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await assertion
  })

  it('로그에는 동작 이름과 코드만 남긴다(NFR-31)', async () => {
    await request('saveRecord', () => fail('42501', 403)).catch(() => {})
    expect(console.error).toHaveBeenCalledWith('[carbook]', 'saveRecord', '42501')
  })
})
