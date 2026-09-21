// 바탕화면 위젯 창(?widget=1)으로 열렸는지 판별해 <html>에 widget 클래스를 붙인다. 스크롤바 숨김 스타일이 이 클래스에 걸린다.
// 구글 로그인 리다이렉트로 ?widget=1이 사라져도 같은 탭에서는 위젯 모드를 유지하도록 sessionStorage에 표시한다
// (localStorage가 아닌 이유: 일반 브라우저에서 한 번 열었다고 계속 위젯 모드로 남지 않게).
const WIDGET_KEY = 'calendar.widget'

export function applyWidgetMode(search: string = window.location.search): void {
  if (new URLSearchParams(search).get('widget') === '1') sessionStorage.setItem(WIDGET_KEY, '1')
  if (sessionStorage.getItem(WIDGET_KEY) === '1') document.documentElement.classList.add('widget')
}

export function isWidgetMode(): boolean {
  return document.documentElement.classList.contains('widget')
}
