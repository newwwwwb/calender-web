/// <reference types="vite/client" />

// Supabase 연동에 쓰는 환경변수 타입 (없으면 undefined, 로컬 저장 모드로 동작)
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
