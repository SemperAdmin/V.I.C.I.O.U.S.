import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // GitHub Pages deployment - use /Process-Point/ for production builds, root for dev
  const base = command === 'build' ? (env.VITE_BASE_PATH || '/Process-Point/') : '/'
  return {
    base,
    plugins: [react()],
    server: {
      host: true,
      port: 5173
    },
    preview: {
      host: true,
      port: 5173
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
