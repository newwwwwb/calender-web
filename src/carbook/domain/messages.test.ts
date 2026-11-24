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

  it('v0.2 문구 MSG-22~32는 표와 글자 그대로다', () => {
    expect(m.MSG_22_LOGOUT_CONFIRM).toBe('로그아웃할까요? 모든 기기에서 로그아웃됩니다')
    expect(m.MSG_23_LOGOUT_FAILED).toBe('로그아웃하지 못했습니다. 다시 시도해 주세요')
    expect(m.MSG_24_NO_RESET).toBe('추천 주기와 다른 항목이 없습니다')
    expect(m.MSG_25_RESET_CONFIRM(3)).toBe('추천 교체 주기로 되돌릴까요? 주기가 바뀌는 항목 3개. 마지막 교체일·주행거리와 직접 추가한 항목은 그대로입니다')
    expect(m.MSG_26_LAST_DATE_UNSET).toBe('마지막 교체일을 입력하세요')
    expect(m.MSG_27_COMPLETE_HINT).toBe('비용은 기록 탭에서 정비로 추가하세요')
    expect(m.MSG_28_KM_BASIS_MEMO).toBe('주행거리 기준 추정 날짜입니다. 기록이 쌓이면 바뀝니다')
    expect(m.MSG_29_LOGIN_FAILED).toBe('로그인하지 못했습니다. 다시 시도해 주세요')
    expect(m.MSG_30_AUTH_EXPIRED).toBe('로그인이 만료됐습니다. 다시 로그인해 주세요')
    expect(m.MSG_31_EVENT_SAVED('2027-01-04')).toBe('캘린더에 2027-01-04 일정으로 추가했습니다')
    expect(m.MSG_32_SAVED).toBe('저장했습니다')
  })

  it('자리표시자 문구는 값을 채운다', () => {
    expect(m.MSG_05_REQUIRED('금액')).toBe('금액을(를) 입력해 주세요')
    expect(m.MSG_08_YEAR(2027)).toBe('연식은 1950부터 2027 사이로 입력해 주세요')
    expect(m.MSG_10_ODOMETER_DROP(12345)).toBe('주행거리가 이전 최대 기록(12,345km)보다 작습니다. 그래도 저장할까요?')
    expect(m.MSG_16_TOO_LONG('별칭', 20)).toBe('별칭은(는) 20자 이하로 입력해 주세요')
    expect(m.MSG_17_TOO_BIG('금액', '999,999,999')).toBe('금액은(는) 999,999,999 이하로 입력해 주세요')
  })
})
