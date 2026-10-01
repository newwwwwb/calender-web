// 헤더 등에서 쓰는 선형 SVG 아이콘(이모지 대신 OS와 무관하게 같은 모양·색을 보장)
const common = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function SearchIcon() {
  return (
    <svg {...common}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function SettingsIcon() {
  return (
    <svg {...common}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function TodoIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  )
}

export function BellIcon() {
  return (
    <svg {...common}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg {...common} width={24} height={24} strokeWidth={2.5}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function SidebarIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  )
}

// 글자 기호(✕ ✓ ‹ › ▾ ×)는 OS·폰트마다 굵기와 기준선이 달라 SVG로 통일한다. 기본 18px, 보조 동작(닫기·삭제)은 16px, 작은 화살표는 14px.
interface SizeProps {
  size?: number
}

export function CloseIcon({ size = 18 }: SizeProps) {
  return (
    <svg {...common} width={size} height={size}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function CheckIcon({ size = 18 }: SizeProps) {
  return (
    <svg {...common} width={size} height={size}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 18 }: SizeProps) {
  return (
    <svg {...common} width={size} height={size}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 18 }: SizeProps) {
  return (
    <svg {...common} width={size} height={size}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 18 }: SizeProps) {
  return (
    <svg {...common} width={size} height={size}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
