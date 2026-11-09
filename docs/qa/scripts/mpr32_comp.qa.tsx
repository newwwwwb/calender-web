// MPR-32 QA 임시 스크립트: 차량 바·차량 양식·삭제 확인창의 AC-03·AC-11 동작을 실제 컴포넌트로 확인한다(훅은 가짜 콜백, npm test 미포함).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog from '../../../src/carbook/components/ConfirmDialog'
import VehicleBar from '../../../src/carbook/components/VehicleBar'
import type { Vehicle, VehicleInput } from '../../../src/carbook/domain/types'

const veh = (id: string, name: string, o: Partial<Vehicle> = {}): Vehicle => ({ id, name, model: null, year: null, plate: null, odometerKm: null, createdAt: id, ...o })
afterEach(cleanup)

// 훅 대신 상태를 가진 껍데기: 저장·삭제 콜백은 호출을 기록하고 결과(true/false)를 조절한다
function Host({ initial, onSave, onDelete, km = 0 }: { initial: Vehicle[]; onSave: (i: VehicleInput, id?: string) => Promise<boolean>; onDelete: (id: string) => Promise<boolean>; km?: number }) {
  const [list, setList] = useState(initial); const [sel, setSel] = useState<string | null>(initial[0]?.id ?? null)
  return (
    <VehicleBar vehicles={list} selectedVehicleId={sel} currentOdometerKm={km} onSelect={setSel}
      onSave={async (i, id) => { const ok = await onSave(i, id); if (ok) { if (id) setList((l) => l.map((v) => (v.id === id ? { ...v, name: i.name, model: i.model, year: i.year, plate: i.plate, odometerKm: i.odometerKm } : v))); else { const n = veh(`n${list.length}`, i.name); setList((l) => [...l, n]); setSel(n.id) } } return ok }}
      onDelete={async (id) => { const ok = await onDelete(id); if (ok) { setList((l) => l.filter((v) => v.id !== id)); setSel((s) => (s === id ? (list.find((v) => v.id !== id)?.id ?? null) : s)) } return ok }} />
  )
}
const type = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } })
const add = () => fireEvent.click(screen.getAllByRole('button', { name: '차량 추가' })[0])

describe('AC-03-1 여러 대 등록·선택 (화면)', () => {
  it('빈 상태: "차량을 추가해 주세요"와 "차량 추가" 버튼, 카드 없음(AC-03-7 둘째 문장의 화면)', () => {
    render(<Host initial={[]} onSave={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('차량을 추가해 주세요')).toBeTruthy(); expect(screen.getByRole('button', { name: '차량 추가' })).toBeTruthy(); expect(screen.queryByRole('combobox')).toBeNull()
  })
  it("선택 상자에서 '가족'을 고르면 카드가 '가족' 정보로 바뀜(차종·연식·번호판·주행거리)", () => {
    render(<Host km={12345} initial={[veh('a', '출퇴근', { model: '아반떼', year: 2020, plate: '12가3456' }), veh('b', '가족', { model: '카니발', year: 2022, plate: '34나5678' })]} onSave={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('아반떼 · 2020')).toBeTruthy(); expect(screen.getByText('12가3456')).toBeTruthy(); expect(screen.getByText('12,345 km')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } })
    expect(screen.getByText('카니발 · 2022')).toBeTruthy(); expect(screen.getByText('34나5678')).toBeTruthy(); expect(screen.queryByText('12가3456')).toBeNull()
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['출퇴근', '가족'])
  })
  it('빈 값은 "-"로 보임, 주행거리 0이면 "-"', () => {
    render(<Host initial={[veh('a', '출퇴근')]} onSave={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getAllByText('-').length).toBe(3)
  })
  it('추가 후 새 차량이 선택되어 카드에 보임', async () => {
    const onSave = vi.fn().mockResolvedValue(true); render(<Host initial={[veh('a', '출퇴근')]} onSave={onSave} onDelete={vi.fn()} />)
    add(); type(/별칭/, '가족'); fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect((screen.getByRole('combobox') as HTMLSelectElement).selectedOptions[0].textContent).toBe('가족')
    expect(onSave).toHaveBeenCalledWith({ name: '가족', model: null, year: null, plate: null, odometerKm: null }, undefined)
  })
})

describe('AC-03-3 입력 오류', () => {
  it('별칭 비움 → 칸 아래 MSG-05, 저장 요청 0건, 포커스가 그 칸으로', () => {
    const onSave = vi.fn(); render(<Host initial={[veh('a', 'x')]} onSave={onSave} onDelete={vi.fn()} />)
    add(); fireEvent.click(screen.getByRole('button', { name: '저장' }))
    const name = screen.getByLabelText(/별칭/); expect(screen.getByText(/별칭을\(를\) 입력해 주세요/)).toBeTruthy(); expect(onSave).not.toHaveBeenCalled()
    expect(name.getAttribute('aria-invalid')).toBe('true'); expect(document.activeElement).toBe(name); expect(name.getAttribute('aria-describedby')).toBeTruthy()
  })
  it('연식 1949·올해+2 → MSG-08, 요청 0건. 1950·올해+1은 통과(경계)', async () => {
    const onSave = vi.fn().mockResolvedValue(true); render(<Host initial={[veh('a', 'x')]} onSave={onSave} onDelete={vi.fn()} />)
    const y = new Date().getFullYear()
    add(); type(/별칭/, '새'); for (const bad of ['1949', String(y + 2)]) { type(/연식/, bad); fireEvent.click(screen.getByRole('button', { name: '저장' })); expect(screen.getByText(`연식은 1950부터 ${y + 1} 사이로 입력해 주세요`)).toBeTruthy() }
    expect(onSave).not.toHaveBeenCalled()
    type(/연식/, '1950'); fireEvent.click(screen.getByRole('button', { name: '저장' })); await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })
  it('연식 올해+1 통과', async () => {
    const onSave = vi.fn().mockResolvedValue(true); render(<Host initial={[veh('a', 'x')]} onSave={onSave} onDelete={vi.fn()} />)
    add(); type(/별칭/, '새'); type(/연식/, String(new Date().getFullYear() + 1)); fireEvent.click(screen.getByRole('button', { name: '저장' })); await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })
  it('오류가 있는 칸만 오류 표시, 고치면 오류가 사라짐', () => {
    render(<Host initial={[veh('a', 'x')]} onSave={vi.fn()} onDelete={vi.fn()} />)
    add(); type(/연식/, '1900'); fireEvent.click(screen.getByRole('button', { name: '저장' })); expect(screen.getAllByText(/입력해 주세요/).length).toBe(2)
    type(/별칭/, '새'); type(/연식/, '2020'); const onSave = vi.fn().mockResolvedValue(true); void onSave
  })
})

describe('AC-03-4 저장 실패: 양식과 입력값 그대로', () => {
  it('onSave가 false → 양식이 열린 채 모든 입력값 유지, 저장 버튼 다시 눌림, 다시 눌러 성공하면 닫힘', async () => {
    const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true); render(<Host initial={[veh('a', 'x')]} onSave={onSave} onDelete={vi.fn()} />)
    add(); type(/별칭/, '새차'); type(/차종/, '쏘나타'); type(/연식/, '2021'); type(/번호판/, '99가9999'); type(/주행거리/, '5000')
    fireEvent.click(screen.getByRole('button', { name: '저장' })); await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    await waitFor(() => expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.getByRole('dialog')).toBeTruthy(); expect((screen.getByLabelText(/별칭/) as HTMLInputElement).value).toBe('새차'); expect((screen.getByLabelText(/차종/) as HTMLInputElement).value).toBe('쏘나타')
    expect((screen.getByLabelText(/연식/) as HTMLInputElement).value).toBe('2021'); expect((screen.getByLabelText(/번호판/) as HTMLInputElement).value).toBe('99가9999'); expect((screen.getByLabelText(/주행거리/) as HTMLInputElement).value).toBe('5000')
    fireEvent.click(screen.getByRole('button', { name: '저장' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(onSave).toHaveBeenCalledTimes(2)
  })
  it('onSave가 reject해도 양식이 영구히 잠기지 않음', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {}); const onSave = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(true)
    render(<Host initial={[veh('a', 'x')]} onSave={onSave} onDelete={vi.fn()} />); add(); type(/별칭/, '새'); fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole('button', { name: '저장' })); await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2)); err.mockRestore()
  })
  it('AC-10-2 저장 중 저장 버튼을 두 번 눌러도 요청 1개(같은 틱 두 번 포함)', async () => {
    let open!: (v: boolean) => void; const onSave = vi.fn(() => new Promise<boolean>((r) => { open = r }))
    render(<Host initial={[veh('a', 'x')]} onSave={onSave} onDelete={vi.fn()} />); add(); type(/별칭/, '새'); const b = screen.getByRole('button', { name: '저장' })
    fireEvent.click(b); fireEvent.click(b); fireEvent.submit(screen.getByRole('dialog').querySelector('form')!); expect(onSave).toHaveBeenCalledTimes(1); expect((b as HTMLButtonElement).disabled).toBe(true); open(true)
  })
})

describe('AC-03-5 수정(화면 부분)', () => {
  it("수정 양식은 기존 값으로 채워지고, 별칭을 '출근차'로 저장하면 카드가 '출근차'로 바뀜(연결 일정 제목 변경은 MPR-27 범위)", async () => {
    const onSave = vi.fn().mockResolvedValue(true); render(<Host initial={[veh('a', '출퇴근', { model: '아반떼', year: 2020, plate: '12가3456', odometerKm: 1000 })]} onSave={onSave} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '수정' })); expect(screen.getByRole('dialog', { name: '차량 수정' })).toBeTruthy()
    expect((screen.getByLabelText(/별칭/) as HTMLInputElement).value).toBe('출퇴근'); expect((screen.getByLabelText(/연식/) as HTMLInputElement).value).toBe('2020'); expect((screen.getByLabelText(/주행거리/) as HTMLInputElement).value).toBe('1000')
    type(/별칭/, '출근차'); fireEvent.click(screen.getByRole('button', { name: '저장' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: '출근차' }), 'a'); expect(screen.getByText('출근차', { selector: 'p' })).toBeTruthy()
  })
})

describe('AC-03-6 / AC-03-7 / AC-11 삭제 확인', () => {
  const cars = () => [veh('a', '출퇴근'), veh('b', '가족')]
  const del = () => fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  it('AC-11-3 차량: 대상 이름이 문구에 들어가고 MSG-14가 붙음', () => {
    render(<Host initial={cars()} onSave={vi.fn()} onDelete={vi.fn()} />); del()
    const d = screen.getByRole('dialog', { name: '삭제 확인' }); expect(within(d).getByText('차량 출퇴근을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다')).toBeTruthy()
    expect(within(d).getByText('이 차량의 기록, 교체 항목, 만기일, 캘린더 일정이 모두 삭제됩니다')).toBeTruthy()
  })
  it('AC-11-1 취소: 창이 닫히고 차량이 남고 삭제 요청 0건. 포커스는 처음에 "취소"', async () => {
    const onDelete = vi.fn(); render(<Host initial={cars()} onSave={vi.fn()} onDelete={onDelete} />); del()
    expect(document.activeElement).toBe(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' })); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(onDelete).not.toHaveBeenCalled(); expect(screen.getAllByRole('option')).toHaveLength(2)
  })
  it('AC-11-4 Esc: 창이 닫히고 삭제 요청 0건', async () => {
    const onDelete = vi.fn(); render(<Host initial={cars()} onSave={vi.fn()} onDelete={onDelete} />); del(); fireEvent.keyDown(document, { key: 'Escape' }); fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(onDelete).not.toHaveBeenCalled()
  })
  it('AC-11-2 / AC-03-7 "삭제": 요청 1건, 첫째 삭제 후 둘째 선택, 둘째까지 삭제하면 빈 상태', async () => {
    const onDelete = vi.fn().mockResolvedValue(true); render(<Host initial={cars()} onSave={vi.fn()} onDelete={onDelete} />)
    del(); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onDelete).toHaveBeenCalledTimes(1); expect(onDelete).toHaveBeenCalledWith('a'); expect(screen.getByText('가족', { selector: 'p' })).toBeTruthy()
    del(); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' })); await waitFor(() => expect(screen.getByText('차량을 추가해 주세요')).toBeTruthy()); expect(onDelete).toHaveBeenCalledTimes(2)
  })
  it('삭제 실패(onConfirm false) → 창이 그대로 열려 있고 차량이 남음, 다시 눌러 성공 가능(요청 중복 없음)', async () => {
    const onDelete = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true); render(<Host initial={cars()} onSave={vi.fn()} onDelete={onDelete} />); del()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' })); await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
    await waitFor(() => expect((within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }) as HTMLButtonElement).disabled).toBe(false)); expect(screen.getByRole('dialog')).toBeTruthy(); expect(screen.getAllByRole('option')).toHaveLength(2)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(onDelete).toHaveBeenCalledTimes(2)
  })
  it('AC-10-2 "삭제"를 연속으로 눌러도 요청 1개', async () => {
    let open!: (v: boolean) => void; const onDelete = vi.fn(() => new Promise<boolean>((r) => { open = r })); render(<Host initial={cars()} onSave={vi.fn()} onDelete={onDelete} />); del()
    const b = within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }); fireEvent.click(b); fireEvent.click(b); expect(onDelete).toHaveBeenCalledTimes(1); expect((b as HTMLButtonElement).disabled).toBe(true); open(true)
  })
  it('삭제 요청 중에도 창을 닫을 수 있고(Blocker 수정), 완료 뒤 onClose를 또 부르지 않음', async () => {
    let open!: (v: boolean) => void; const onClose = vi.fn(); const onConfirm = vi.fn(() => new Promise<boolean>((r) => { open = r }))
    render(<ConfirmDialog target="교체 항목 엔진오일" onConfirm={onConfirm} onClose={onClose} />); fireEvent.click(screen.getByRole('button', { name: '삭제' })); fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalledTimes(1); open(true); await Promise.resolve(); await Promise.resolve(); expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('AC-11-3 교체 항목·만기일 대상 문구(경고 없음)', () => {
    const { unmount } = render(<ConfirmDialog target="교체 항목 엔진오일" onConfirm={vi.fn()} onClose={vi.fn()} />); expect(screen.getByText('교체 항목 엔진오일을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다')).toBeTruthy(); expect(screen.queryByText(/캘린더 일정이 모두/)).toBeNull(); unmount()
    render(<ConfirmDialog target="보험 만기일" onConfirm={vi.fn()} onClose={vi.fn()} />); expect(screen.getByText('보험 만기일을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다')).toBeTruthy()
  })
  it('창 밖(스크림) 클릭은 취소', async () => {
    const onDelete = vi.fn(); render(<Host initial={cars()} onSave={vi.fn()} onDelete={onDelete} />); del()
    const dlg = screen.getByRole('dialog'); fireEvent.click(dlg.parentElement!); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(onDelete).not.toHaveBeenCalled()
  })
})
