import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend dev server proxies API + static image calls to the FastAPI backend
// (uvicorn app.main:app --port 8000), so the browser can use same-origin paths.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/static': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
