// 바탕화면 위젯 창(?widget=1)으로 열렸는지 판별해 <html>에 widget 클래스를 붙인다. 스크롤바 숨김 스타일이 이 클래스에 걸린다.
export function applyWidgetMode(search: string = window.location.search): void {
  if (new URLSearchParams(search).get('widget') === '1') document.documentElement.classList.add('widget')
}

export function isWidgetMode(): boolean {
  return document.documentElement.classList.contains('widget')
}
