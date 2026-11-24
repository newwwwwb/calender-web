// 차계부 화면 문구 MSG-01~20을 03_spec 1.2 글자 그대로 보관하는 파일
const won = (n: number) => n.toLocaleString('en-US')

export const MSG_01_SAVE_FAILED = '저장하지 못했습니다. 다시 시도해 주세요'
export const MSG_02_LOGIN_REQUIRED = '로그인하면 사용할 수 있습니다'
export const MSG_03_DELETE_FAILED = '삭제하지 못했습니다. 다시 시도해 주세요'
export const MSG_04_LOAD_FAILED = '차계부 데이터를 불러오지 못했습니다'
export const MSG_05_REQUIRED = (label: string) => `${label}을(를) 입력해 주세요`
export const MSG_06_INTEGER = (label: string) => `${label}은(는) 0 이상의 정수로 입력해 주세요`
export const MSG_07_LITERS = '주유량은 0 이상의 숫자(소수 둘째 자리까지)로 입력해 주세요'
export const MSG_08_YEAR = (maxYear: number) => `연식은 1950부터 ${maxYear} 사이로 입력해 주세요`
export const MSG_09_INTERVAL = '교체 주기는 km 또는 개월 중 하나 이상 입력해 주세요'
export const MSG_10_ODOMETER_DROP = (maxKm: number) => `주행거리가 이전 최대 기록(${won(maxKm)}km)보다 작습니다. 그래도 저장할까요?`
export const MSG_11_CALENDAR_RETRY = '캘린더 반영 실패, 다시 시도'
export const MSG_12_INTERVAL_HINT = '참고용 값입니다. 차량 매뉴얼을 우선하세요'
export const MSG_13_CONFIRM_DELETE = (target: string) => `${target}을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다`
export const MSG_14_VEHICLE_DELETE = '이 차량의 기록, 교체 항목, 만기일, 캘린더 일정이 모두 삭제됩니다'
export const MSG_15_DATE = (label: string) => `${label}을(를) 올바른 날짜로 입력해 주세요`
export const MSG_16_TOO_LONG = (label: string, max: number) => `${label}은(는) ${max}자 이하로 입력해 주세요`
export const MSG_17_TOO_BIG = (label: string, max: string) => `${label}은(는) ${max} 이하로 입력해 주세요`
export const MSG_18_NO_ODOMETER_DATA = '주행거리 기록 부족'
export const MSG_19_LAST_ODOMETER = '마지막 교체 주행거리를 입력해 주세요'
export const MSG_20_LAST_DATE_FUTURE = '마지막 교체일은 오늘 또는 그 이전 날짜로 입력해 주세요'
export const MSG_21_INTERVAL_FORMAT = (label: string) => `${label}은(는) 1 이상의 정수로 입력해 주세요`
export const MSG_22_LOGOUT_CONFIRM = '로그아웃할까요? 모든 기기에서 로그아웃됩니다'
export const MSG_23_LOGOUT_FAILED = '로그아웃하지 못했습니다. 다시 시도해 주세요'
export const MSG_24_NO_RESET = '추천 주기와 다른 항목이 없습니다'
export const MSG_25_RESET_CONFIRM = (count: number) => `추천 교체 주기로 되돌릴까요? 주기가 바뀌는 항목 ${count}개. 마지막 교체일·주행거리와 직접 추가한 항목은 그대로입니다`
export const MSG_26_LAST_DATE_UNSET = '마지막 교체일을 입력하세요'
export const MSG_27_COMPLETE_HINT = '비용은 기록 탭에서 정비로 추가하세요'
export const MSG_28_KM_BASIS_MEMO = '주행거리 기준 추정 날짜입니다. 기록이 쌓이면 바뀝니다'
export const MSG_29_LOGIN_FAILED = '로그인하지 못했습니다. 다시 시도해 주세요'
export const MSG_30_AUTH_EXPIRED = '로그인이 만료됐습니다. 다시 로그인해 주세요'
export const MSG_31_EVENT_SAVED = (date: string) => `캘린더에 ${date} 일정으로 추가했습니다`
export const MSG_32_SAVED = '저장했습니다'
