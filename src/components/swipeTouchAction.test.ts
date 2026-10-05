// 회귀 가드: 보기 안에 스크롤 컨테이너(overflow)가 있으면 touch-action을 직접 지정해야 모바일 좌우 스와이프가 산다.
// 스크롤 컨테이너는 바깥 SwipeableViewport의 touch-action(pan-y)을 이어받지 않아 브라우저가 가로 팬을 가져가 pointercancel이 난다
// (25단계 최종 심사에서 월 보기가 이렇게 죽었다). jsdom은 touch-action을 실행하지 못해 CSS 문자열로 지킨다.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// CSS 모듈은 vitest가 클래스 맵으로 바꿔 버려서 ?raw·new URL로 못 읽는다 — 파일을 그대로 읽는다
const read = (name: string) => readFileSync(`src/components/${name}`, 'utf-8') // vitest는 프로젝트 루트에서 실행된다
const agenda = read('AgendaView.module.css')
const month = read('MonthView.module.css')
const timeGrid = read('TimeGridView.module.css')

function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

describe('스와이프되는 보기의 스크롤 컨테이너는 touch-action: pan-y를 갖는다', () => {
  it.each([
    ['MonthView .container', month, '.container'],
    ['MonthView .dayList', month, '.dayList'],
    ['TimeGridView .scrollArea', timeGrid, '.scrollArea'],
    ['AgendaView .container', agenda, '.container'],
  ])('%s', (_name, css, selector) => {
    const body = rule(css, selector)
    expect(body).toContain('overflow-y: auto')
    expect(body).toMatch(/touch-action:\s*pan-y/)
  })
})
