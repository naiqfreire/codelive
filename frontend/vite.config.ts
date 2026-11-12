import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // The backend mounts every route under /api, including the room WebSocket.
    // Keeping the same origin in dev means the httpOnly session cookie is sent
    // and the Origin header stays on the backend allow-list.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
