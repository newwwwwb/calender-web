// MPR-31 QA 임시 스크립트: CarbookApp의 로그인 게이트·세션 지연·불러오기 실패·하위 탭 유지를 모의 훅으로 확인한다(npm test 미포함).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = { user: null as null | { id: string }, loading: false, signInWithGoogle: vi.fn((_to?: string) => Promise.resolve()), signOut: vi.fn() }
const carbook = { loadState: 'ready' as 'loading' | 'ready' | 'error', retryLoad: vi.fn(), vehicles: [] as unknown[], selectedVehicleId: null as string | null, selectVehicle: vi.fn() }
const useCarbookSpy = vi.fn((_id: string) => carbook)
vi.mock('../../../src/state/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../../../src/carbook/state/useCarbook', () => ({ useCarbook: (id: string) => useCarbookSpy(id) }))

import CarbookApp from '../../../src/carbook/CarbookApp'

const veh = (id: string) => ({ id, name: id, model: null, year: null, plate: null, odometerKm: null, createdAt: '' })
beforeEach(() => {
  auth.user = null; auth.loading = false; auth.signInWithGoogle.mockClear(); auth.signInWithGoogle.mockImplementation(() => Promise.resolve())
  Object.assign(carbook, { loadState: 'ready', vehicles: [veh('a'), veh('b')], selectedVehicleId: 'a' }); carbook.retryLoad.mockClear(); useCarbookSpy.mockClear()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('AC-02-1 안내와 무요청', () => {
  it('비로그인: MSG-02 문구와 로그인 버튼, 하위 탭 없음, useCarbook 호출 0회', () => {
    render(<CarbookApp />)
    expect(screen.getByText('로그인하면 사용할 수 있습니다')).toBeTruthy()
    expect(screen.getByRole('button', { name: '로그인' })).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(useCarbookSpy).not.toHaveBeenCalled()
  })
  it('h1 "차계부"가 있고 main 영역이 하나', () => {
    render(<CarbookApp />)
    expect(screen.getByRole('heading', { level: 1, name: '차계부' })).toBeTruthy(); expect(screen.getAllByRole('main')).toHaveLength(1)
  })
})

describe('AC-02-2 / 02-3 로그인 복귀·실패', () => {
  it('로그인 버튼은 현재 주소(window.location.href)를 복귀 주소로 넘긴다', () => {
    window.history.pushState({}, '', '/car?x=1')
    render(<CarbookApp />); fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1); expect(auth.signInWithGoogle).toHaveBeenCalledWith(window.location.href)
    expect(window.location.href).toContain('/car?x=1')
  })
  it('로그인이 거절(reject)돼도 안내 화면이 그대로이고 데이터 훅 호출 0회', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    auth.signInWithGoogle.mockImplementation(() => Promise.reject(new Error('cancel')))
    render(<CarbookApp />); await act(async () => { fireEvent.click(screen.getByRole('button', { name: '로그인' })) })
    expect(screen.getByText('로그인하면 사용할 수 있습니다')).toBeTruthy(); expect(useCarbookSpy).not.toHaveBeenCalled(); expect(err).toHaveBeenCalled(); err.mockRestore()
  })
})

describe('AC-02-5 세션 복원 지연 (5초)', () => {
  it('복원 중에는 로딩 표시, 4.999초까지 유지, 5초에 로그인 안내', () => {
    vi.useFakeTimers(); auth.loading = true
    render(<CarbookApp />)
    expect(screen.getByRole('status')).toBeTruthy(); expect(screen.queryByText('로그인하면 사용할 수 있습니다')).toBeNull()
    act(() => { vi.advanceTimersByTime(4999) })
    expect(screen.getByRole('status')).toBeTruthy(); expect(screen.queryByRole('button', { name: '로그인' })).toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByRole('status')).toBeNull(); expect(screen.getByRole('button', { name: '로그인' })).toBeTruthy()
    expect(useCarbookSpy).not.toHaveBeenCalled()
  })
  it('5초 안에 세션이 복원되면(로그인 사용자) 안내 없이 차계부로 간다', () => {
    vi.useFakeTimers(); auth.loading = true
    const { rerender } = render(<CarbookApp />)
    act(() => { vi.advanceTimersByTime(2000) })
    auth.loading = false; auth.user = { id: 'u1' }; rerender(<CarbookApp />)
    expect(screen.queryByRole('button', { name: '로그인' })).toBeNull(); expect(screen.getByRole('tablist')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(10000) }); expect(screen.queryByRole('button', { name: '로그인' })).toBeNull()
  })
  it('5초 안에 세션이 없다고 확정되면(loading=false) 바로 안내', () => {
    vi.useFakeTimers(); auth.loading = true
    const { rerender } = render(<CarbookApp />); auth.loading = false; rerender(<CarbookApp />)
    expect(screen.getByRole('button', { name: '로그인' })).toBeTruthy()
  })
  it('5초 뒤 안내가 보인 다음 세션이 늦게 복원되면 차계부로 전환(안내가 남지 않음)', () => {
    vi.useFakeTimers(); auth.loading = true
    const { rerender } = render(<CarbookApp />); act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('button', { name: '로그인' })).toBeTruthy()
    auth.loading = false; auth.user = { id: 'u1' }; rerender(<CarbookApp />)
    expect(screen.queryByRole('button', { name: '로그인' })).toBeNull(); expect(screen.getByRole('tablist')).toBeTruthy()
  })
})

describe('AC-10-7 불러오기 실패', () => {
  beforeEach(() => { auth.user = { id: 'u1' } })
  it('MSG-04와 "다시 시도" 버튼이 보이고, 누르면 retryLoad 1회', () => {
    carbook.loadState = 'error'
    render(<CarbookApp />)
    expect(screen.getByText('차계부 데이터를 불러오지 못했습니다')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' })); expect(carbook.retryLoad).toHaveBeenCalledTimes(1)
  })
  it('다시 읽는 동안 로딩 표시, 성공하면 하위 탭, 또 실패하면 다시 MSG-04', () => {
    carbook.loadState = 'error'; const { rerender } = render(<CarbookApp />)
    carbook.loadState = 'loading'; rerender(<CarbookApp />)
    expect(screen.getByRole('status')).toBeTruthy(); expect(screen.queryByText('차계부 데이터를 불러오지 못했습니다')).toBeNull()
    carbook.loadState = 'ready'; rerender(<CarbookApp />); expect(screen.getByRole('tablist')).toBeTruthy()
    carbook.loadState = 'error'; rerender(<CarbookApp />); expect(screen.getByText('차계부 데이터를 불러오지 못했습니다')).toBeTruthy()
  })
  it('실패 화면에 하위 탭이 없고 role=alert', () => {
    carbook.loadState = 'error'; render(<CarbookApp />)
    expect(screen.queryByRole('tablist')).toBeNull(); expect(screen.getByRole('alert')).toBeTruthy()
  })
  it('다시 시도 후 포커스가 main(#main-content)으로 옮겨짐(포커스 유실 방지)', () => {
    carbook.loadState = 'error'; render(<CarbookApp />)
    const b = screen.getByRole('button', { name: '다시 시도' }); b.focus(); fireEvent.click(b)
    expect(document.activeElement).toBe(document.getElementById('main-content'))
  })
  it('로딩 중에는 하위 탭이 없고 role=status', () => {
    carbook.loadState = 'loading'; render(<CarbookApp />)
    expect(screen.queryByRole('tablist')).toBeNull(); expect(screen.getByRole('status')).toBeTruthy()
  })
})

describe('AC-03-9 차량을 바꿔도 하위 탭 유지, 새로고침(재마운트)하면 기록', () => {
  beforeEach(() => { auth.user = { id: 'u1' } })
  const sel = () => screen.getAllByRole('tab').findIndex((t) => t.getAttribute('aria-selected') === 'true')
  it('탭 4개 이름과 기본 선택 "기록"', () => {
    render(<CarbookApp />); expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['기록', '교체 알림', '만기일', '통계']); expect(sel()).toBe(0)
  })
  it('"통계" 선택 후 선택 차량이 바뀌어 다시 그려져도 "통계"가 그대로', () => {
    const { rerender } = render(<CarbookApp />); fireEvent.click(screen.getByRole('tab', { name: '통계' })); expect(sel()).toBe(3)
    Object.assign(carbook, { selectedVehicleId: 'b' }); rerender(<CarbookApp />); expect(sel()).toBe(3)
    expect(screen.getByRole('heading', { name: '통계', hidden: false })).toBeTruthy()
  })
  it('차량 목록이 바뀌어도(1대→2대) 탭 유지', () => {
    carbook.vehicles = [veh('a')]; const { rerender } = render(<CarbookApp />); fireEvent.click(screen.getByRole('tab', { name: '만기일' }))
    carbook.vehicles = [veh('a'), veh('b')]; rerender(<CarbookApp />); expect(sel()).toBe(2)
  })
  it('재마운트(새로고침)하면 "기록"', () => {
    const r = render(<CarbookApp />); fireEvent.click(screen.getByRole('tab', { name: '통계' })); r.unmount()
    render(<CarbookApp />); expect(sel()).toBe(0)
  })
  it('계정이 바뀌면(key=user.id) 이전 계정의 탭 상태를 넘기지 않음', () => {
    const { rerender } = render(<CarbookApp />); fireEvent.click(screen.getByRole('tab', { name: '통계' }))
    auth.user = { id: 'u2' }; rerender(<CarbookApp />); expect(sel()).toBe(0); expect(useCarbookSpy).toHaveBeenLastCalledWith('u2')
  })
  it('경계: 차량 0대면 하위 탭이 없음(빈 상태는 MPR-32 범위)', () => {
    carbook.vehicles = []; render(<CarbookApp />); expect(screen.queryByRole('tablist')).toBeNull()
  })
  it('패널은 선택된 것만 보임(나머지 hidden), 탭-패널 aria 연결', () => {
    render(<CarbookApp />); fireEvent.click(screen.getByRole('tab', { name: '교체 알림' }))
    const tabs = screen.getAllByRole('tab')
    tabs.forEach((t, i) => { const p = document.getElementById(t.getAttribute('aria-controls')!)!; expect(p.getAttribute('aria-labelledby')).toBe(t.id); expect(p.hidden).toBe(i !== 1) })
  })
  it('키보드: →/←/Home/End, 마지막→처음 순환, Alt/Shift 조합은 무시', () => {
    render(<CarbookApp />); const list = screen.getByRole('tablist')
    fireEvent.keyDown(list, { key: 'ArrowRight' }); expect(sel()).toBe(1)
    fireEvent.keyDown(list, { key: 'End' }); expect(sel()).toBe(3)
    fireEvent.keyDown(list, { key: 'ArrowRight' }); expect(sel()).toBe(0)
    fireEvent.keyDown(list, { key: 'ArrowLeft' }); expect(sel()).toBe(3)
    fireEvent.keyDown(list, { key: 'Home' }); expect(sel()).toBe(0)
    fireEvent.keyDown(list, { key: 'ArrowRight', altKey: true }); expect(sel()).toBe(0)
    fireEvent.keyDown(list, { key: 'ArrowRight', shiftKey: true }); expect(sel()).toBe(0)
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([0, -1, -1, -1])
  })
})
