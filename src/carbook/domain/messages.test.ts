// 차계부 문구가 03_spec 1.2 표와 글자 그대로인지 확인하는 테스트
import { describe, expect, it } from 'vitest'
import * as m from './messages'

describe('messages', () => {
  it('고정 문구는 표와 같다', () => {
    expect(m.MSG_01_SAVE_FAILED).toBe('저장하지 못했습니다. 다시 시도해 주세요')
    expect(m.MSG_03_DELETE_FAILED).toBe('삭제하지 못했습니다. 다시 시도해 주세요')
    expect(m.MSG_04_LOAD_FAILED).toBe('차계부 데이터를 불러오지 못했습니다')
    expect(m.MSG_09_INTERVAL).toBe('교체 주기는 km 또는 개월 중 하나 이상 입력해 주세요')
    expect(m.MSG_18_NO_ODOMETER_DATA).toBe('주행거리 기록 부족')
    expect(m.MSG_20_LAST_DATE_FUTURE).toBe('마지막 교체일은 오늘 또는 그 이전 날짜로 입력해 주세요')
  })

  it('자리표시자 문구는 값을 채운다', () => {
    expect(m.MSG_05_REQUIRED('금액')).toBe('금액을(를) 입력해 주세요')
    expect(m.MSG_08_YEAR(2027)).toBe('연식은 1950부터 2027 사이로 입력해 주세요')
    expect(m.MSG_10_ODOMETER_DROP(12345)).toBe('주행거리가 이전 최대 기록(12,345km)보다 작습니다. 그래도 저장할까요?')
    expect(m.MSG_16_TOO_LONG('별칭', 20)).toBe('별칭은(는) 20자 이하로 입력해 주세요')
    expect(m.MSG_17_TOO_BIG('금액', '999,999,999')).toBe('금액은(는) 999,999,999 이하로 입력해 주세요')
  })
})
