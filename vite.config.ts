import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.VERCEL ? '/' : './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api/local-llm': {
        target: 'http://127.0.0.1:4041',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/local-llm/, '/v1'),
      },
    },
  },
})
