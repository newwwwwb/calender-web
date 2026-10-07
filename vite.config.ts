import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // 라이브러리를 앱 코드와 떼어 청크 하나가 500kB를 넘지 않게 하고, 앱만 바뀐 배포에서는 이 청크들의 캐시가 유지되게 한다
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\/](react|react-dom|scheduler)[\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\/](@supabase|iceberg-js|tslib)[\/]/ },
            { name: 'vendor-motion', test: /node_modules[\/](motion|framer-motion|motion-dom|motion-utils)[\/]/ },
            { name: 'vendor-date', test: /node_modules[\/]date-fns[\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
