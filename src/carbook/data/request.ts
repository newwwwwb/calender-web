// Supabase 요청에 20초 제한 시간을 걸고 실패를 timeout·network·conflict·unknown으로 분류하는 모듈
export type CarbookErrorKind = 'timeout' | 'network' | 'conflict' | 'unknown'
export const TIMEOUT_MS = 20000

export class CarbookError extends Error {
  readonly kind: CarbookErrorKind
  readonly code?: string
  constructor(kind: CarbookErrorKind, code?: string) {
    super(code ? `${kind}:${code}` : kind)
    this.kind = kind
    this.code = code
  }
}

interface QueryResult<T> { data: T | null; error: { code?: string; message?: string } | null; status?: number }

// 우리 신호가 중단됐으면 timeout, 23505·23503은 conflict, status 0 또는 5xx는 network, 그 밖은 unknown
function classify(error: { code?: string }, status: number | undefined, aborted: boolean): CarbookError {
  if (aborted) return new CarbookError('timeout')
  if (error.code === '23505' || error.code === '23503') return new CarbookError('conflict', error.code)
  if (status === 0 || (status !== undefined && status >= 500)) return new CarbookError('network', error.code)
  return new CarbookError('unknown', error.code)
}

// 요청 한 건을 실행한다. 20초 안에 끝나지 않으면 신호를 중단하고 timeout을 던진다(자동 재시도 없음)
export async function request<T>(action: string, build: (signal: AbortSignal) => PromiseLike<QueryResult<T>>): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  const aborted = new Promise<never>((_, reject) => ctl.signal.addEventListener('abort', () => reject(new CarbookError('timeout'))))
  try {
    const res = await Promise.race([Promise.resolve(build(ctl.signal)), aborted])
    if (res.error) throw classify(res.error, res.status, ctl.signal.aborted)
    return res.data as T
  } catch (e) {
    const err = e instanceof CarbookError ? e : new CarbookError(ctl.signal.aborted ? 'timeout' : 'network')
    console.error('[carbook]', action, err.code ?? err.kind) // 행 내용·번호판은 찍지 않는다(NFR-31)
    throw err
  } finally {
    clearTimeout(timer)
  }
}
