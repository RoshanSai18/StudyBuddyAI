import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Express API runs on :4000; proxying keeps the browser on one origin (no CORS setup needed).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
})
